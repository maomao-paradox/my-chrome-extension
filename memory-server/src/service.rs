//! 业务服务层：检索编排、上下文装配、observe 自动提取、导入导出。
//!
//! 与扩展端 `services/memory/memory-service.ts` + `memory-exporter.ts` 逐一对应：
//! - 混合排序 `0.5×RAG + 0.3×保留率 + 0.2×重要度`，三态分流，仅入选条目写回复活；
//! - 上下文装配预算 2000 字符，工具角色返回空 assembledContext；
//! - observe 三规则：明示偏好 / 具体事实 / 对话语料（寒暄过滤 + Jaccard 去重）；
//! - 导入导出与扩展端备份文件（schemaVersion: 1）完全兼容。

use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, Mutex};

use regex::Regex;

use crate::decay::{
    classify_decay_state, compute_retention, normalize_entry, reactivate_entry,
};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ms, generate_memory_id, ChatMessage, EntryPatch, IdentityMemory, ImportMode,
    ImportResult, MemoryCategory, MemoryDecayState, MemoryEntry, MemoryExportPayload,
    MemoryImportance, MemoryQueryResult, ShortTermSnapshot,
};
use crate::rag::{tokenize, Bm25Index};
use crate::store::SqliteMemoryStore;

/// 上下文构建时的字符预算（对应 TS CONTEXT_BUDGET）
const CONTEXT_BUDGET: usize = 2000;

/// 混合排序权重：RAG 相关性 / 遗忘保留率 / 重要度
const SCORE_WEIGHT_RAG: f64 = 0.5;
const SCORE_WEIGHT_RETENTION: f64 = 0.3;
const SCORE_WEIGHT_IMPORTANCE: f64 = 0.2;

/// RAG 命中阈值 —— 归一化分达到即视为「用户提起了这条记忆」，触发复活
const RAG_REACTIVATE_THRESHOLD: f64 = 0.15;

/// 单角色记忆软上限 —— 超出按「保留率 × 重要度」淘汰
const MAX_ENTRIES_PER_ROLE: usize = 1500;

/// 对话语料单条最大字符数（用户段 / AI 段）
const CONVERSATION_USER_CHARS: usize = 150;
const CONVERSATION_AI_CHARS: usize = 250;

/// 太琐碎的一轮对话不值得入库（双方合计字符数下限）
const MIN_CONVERSATION_CHARS: usize = 12;

/// 去重时回看的最近对话条目数
const CONVERSATION_DEDUP_WINDOW: usize = 8;

/// Jaccard 相似度阈值 —— 超过判定为重复对话
const CONVERSATION_DUP_THRESHOLD: f64 = 0.85;

/// 短期摘要截取的消息条数与单条字符数
const SHORT_TERM_RECENT_MESSAGES: usize = 6;
const SHORT_TERM_CONTENT_CHARS: usize = 100;

/// 长期记忆块最多注入的条目数
const CONTEXT_MAX_ENTRIES: usize = 8;

/// 寒暄类噪声回复 —— 这类文本没有检索价值（忽略大小写）
static TRIVIAL_REPLY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(好的?|嗯+|哦+|谢谢|收到|明白了?|ok|okay)[。.！!~～\s]*$")
        .expect("寒暄正则编译失败")
});

/// 规则 1：用户明示偏好（按顺序匹配，命中即停，一轮一条）
static PREFERENCE_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    [
        r"记住[：:]?\s*(.+)",
        r"我(?:喜|爱)欢[：:]?\s*(.+)",
        r"我(?:讨厌|不喜欢|反感)[：:]?\s*(.+)",
        r"我(?:叫|是)[：:]?\s*(.+)",
        r"我的(?:名字|网名|昵称)[是为][：:]?\s*(.+)",
    ]
    .iter()
    .map(|p| Regex::new(p).expect("偏好正则编译失败"))
    .collect()
});

/// 规则 2：用户提到具体事实（按顺序匹配，命中即停，一轮一条；取整体匹配）
static FACT_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    [
        r"(?:项目|仓库)[：:]?\s*(\S+)",
        r"(?:框架|技术|语言)[：:]?\s*(\S+)",
        r"(?:版本)[：:]?([\w.\-]+)",
        r"(?i)(?:ubuntu|windows|macOS|centos)\s*[\d.]*",
        r"https?://\S+",
    ]
    .iter()
    .map(|p| Regex::new(p).expect("事实正则编译失败"))
    .collect()
});

/// 归一化的重要度权重 ∈ [0, 1] —— 混排打分与容量淘汰时使用
fn importance_weight(imp: MemoryImportance) -> f64 {
    match imp {
        MemoryImportance::Critical => 1.0,
        MemoryImportance::High => 0.7,
        MemoryImportance::Medium => 0.4,
        MemoryImportance::Low => 0.15,
    }
}

/// 判定某个角色是否为纯工具类（非聊天角色）。
///
/// 工具类角色不应出现在聊天角色列表里，也不走记忆上下文注入链路，
/// 避免 JSON/工具输出污染对话历史。与 TS 版 `isFunctionalRole` 一致：
/// 固定集合 + `translator_` 动态前缀。
pub fn is_functional_role(role: &str) -> bool {
    const KNOWN_FUNCTIONAL_ROLES: [&str; 3] = [
        "graph_extractor",
        "textarea_ai_autofill",
        "table_data_generator",
    ];
    if KNOWN_FUNCTIONAL_ROLES.contains(&role) {
        return true;
    }
    role.starts_with("translator_")
}

/// MemoryService —— 业务语义层
///
/// 持有存储句柄与按角色缓存的 BM25 索引；索引以条目集合签名判断是否需要重建。
pub struct MemoryService {
    store: SqliteMemoryStore,
    /// RAG 索引缓存：role → (条目集合签名, 索引)
    rag_cache: Mutex<HashMap<String, (String, Bm25Index)>>,
}

impl MemoryService {
    /// 基于既有存储构造服务
    pub fn new(store: SqliteMemoryStore) -> Self {
        Self {
            store,
            rag_cache: Mutex::new(HashMap::new()),
        }
    }

    /// 暴露内部存储（供路由层做计数等轻量查询）
    pub fn store(&self) -> &SqliteMemoryStore {
        &self.store
    }

    // ─── 身份记忆 ─── //

    /// 注册或更新角色身份：存在则 version + 1，否则 version = 1
    pub async fn upsert_identity(
        &self,
        role: &str,
        display_name: String,
        system_prompt_template: String,
        persona_description: Option<String>,
    ) -> AppResult<IdentityMemory> {
        let existing = self.store.get_identity(role).await?;
        let now = now_ms();

        let identity = IdentityMemory {
            role: role.to_string(),
            display_name,
            system_prompt_template,
            persona_description,
            version: existing.map(|e| e.version + 1).unwrap_or(1),
            updated_at: now,
        };

        self.store.save_identity(&identity).await?;
        Ok(identity)
    }

    /// 获取角色身份
    pub async fn get_identity(&self, role: &str) -> AppResult<Option<IdentityMemory>> {
        Ok(self.store.get_identity(role).await?)
    }

    // ─── 记忆条目 CRUD ─── //

    /// 新增一条长期记忆：补全遗忘曲线字段后写库，并触发容量淘汰
    pub async fn add_entry(
        &self,
        role: &str,
        content: &str,
        category: Option<MemoryCategory>,
        importance: Option<MemoryImportance>,
        source: Option<String>,
        tags: Option<Vec<String>>,
    ) -> AppResult<MemoryEntry> {
        let now = now_ms();
        let base = MemoryEntry {
            id: generate_memory_id(),
            role: role.to_string(),
            category: category.unwrap_or(MemoryCategory::Fact),
            content: content.trim().to_string(),
            importance: importance.unwrap_or(MemoryImportance::Medium),
            source,
            tags,
            created_at: now,
            last_accessed_at: now,
            access_count: 1,
            stability: None,
            last_reactivated_at: None,
            decay_state: None,
            retention: None,
        };

        // 补全遗忘曲线字段：按 importance 取初始稳定性 S
        let entry = normalize_entry(&base);

        self.store.save_entries(std::slice::from_ref(&entry)).await?;
        self.invalidate_rag_index(role);

        // 容量控制：超出软上限时按「保留率 × 重要度」淘汰最不重要的
        self.prune_if_needed(role).await?;

        Ok(entry)
    }

    /// 局部更新记忆条目（content / importance / category / tags）；不存在返回 None
    pub async fn update_entry(&self, id: &str, patch: &EntryPatch) -> AppResult<Option<MemoryEntry>> {
        let Some(mut entry) = self.store.get_entry(id).await? else {
            return Ok(None);
        };

        if let Some(content) = &patch.content {
            entry.content = content.clone();
        }
        if let Some(importance) = patch.importance {
            entry.importance = importance;
        }
        if let Some(category) = patch.category {
            entry.category = category;
        }
        if let Some(tags) = &patch.tags {
            entry.tags = Some(tags.clone());
        }

        self.store.save_entries(std::slice::from_ref(&entry)).await?;
        self.invalidate_rag_index(&entry.role);
        Ok(Some(entry))
    }

    /// 删除记忆条目；role 未知时整体失效 RAG 缓存
    pub async fn remove_entry(&self, id: &str) -> AppResult<bool> {
        let deleted = self.store.delete_entry(id).await?;
        self.rag_cache
            .lock()
            .expect("RAG 缓存锁中毒")
            .clear();
        Ok(deleted)
    }

    /// 列出某角色记忆：运行时计算 retention / decay_state，支持类目、状态过滤与分页
    ///
    /// 排序按 created_at DESC（与 TS 存储层一致），分页在过滤之后应用。
    pub async fn list_entries(
        &self,
        role: &str,
        category: Option<MemoryCategory>,
        state: Option<MemoryDecayState>,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<MemoryEntry>> {
        let raw = match category {
            Some(cat) => self.store.list_by_category(role, cat).await?,
            None => self.store.list_entries(role).await?,
        };
        let now = now_ms();

        let mut entries: Vec<MemoryEntry> = raw
            .iter()
            .map(|e| {
                let mut entry = normalize_entry(e);
                let retention = compute_retention(&entry, now);
                entry.retention = Some(retention);
                entry.decay_state = Some(classify_decay_state(&entry, now));
                entry
            })
            .filter(|e| state.is_none() || e.decay_state == state)
            .collect();

        // 防御性排序：存储层已按 created_at DESC，这里保持一致
        entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        let start = offset.unwrap_or(0).min(entries.len());
        let sliced: Vec<MemoryEntry> = match limit {
            Some(n) => entries[start..].iter().take(n).cloned().collect(),
            None => entries[start..].to_vec(),
        };
        Ok(sliced)
    }

    /// 手动「想起来」一条记忆：S × 2.2，计时重置，回到 active；找不到返回 None
    pub async fn recall_entry(&self, id: &str) -> AppResult<Option<MemoryEntry>> {
        let Some(found) = self.store.get_entry(id).await? else {
            return Ok(None);
        };

        let revived = reactivate_entry(&normalize_entry(&found), now_ms(), 2.2);
        self.store.save_entries(std::slice::from_ref(&revived)).await?;
        self.invalidate_rag_index(&revived.role);
        Ok(Some(revived))
    }

    /// 列出角色；chat_only = true 时过滤纯工具角色
    pub async fn list_roles(&self, chat_only: bool) -> AppResult<Vec<String>> {
        let all = self.store.list_all_roles().await?;
        if chat_only {
            Ok(all.into_iter().filter(|r| !is_functional_role(r)).collect())
        } else {
            Ok(all)
        }
    }

    /// 清除某角色所有记忆（忘记一切）
    pub async fn forget_all(&self, role: &str) -> AppResult<()> {
        self.store.clear_role(role).await?;
        self.invalidate_rag_index(role);
        Ok(())
    }

    // ─── 检索与排序 ─── //

    /// 检索相关记忆 —— RAG(BM25) 相关性 × 遗忘曲线保留率 × 重要度 混合排序
    ///
    /// 三态分流规则：
    ///   active    正常参与排序
    ///   fading    仅高重要度（high/critical）或 RAG 命中时保留
    ///   forgotten 默认不注入 —— 若 RAG 命中（用户又提起了）则复活并带回上下文
    ///
    /// 只有真正被返回的条目才会刷新 lastReactivatedAt，
    /// 避免「每检索一次所有记忆都变新鲜」导致遗忘曲线失效。
    pub async fn retrieve(
        &self,
        role: &str,
        query: Option<&str>,
        limit: usize,
    ) -> AppResult<Vec<MemoryEntry>> {
        let raw_entries = self.store.list_entries(role).await?;
        if raw_entries.is_empty() {
            return Ok(Vec::new());
        }

        // 旧数据迁移：补全 stability / lastReactivatedAt
        let all: Vec<MemoryEntry> = raw_entries.iter().map(normalize_entry).collect();
        let now = now_ms();

        // 1. RAG 检索 —— 索引覆盖全部条目（含已遗忘的，才能「提起就想起」）
        let rag_map = self.search_with_index(role, &all, query, limit * 3);

        // 2. 逐条打分 + 三态分流
        struct Candidate {
            entry: MemoryEntry,
            score: f64,
            rag: f64,
            /// 检索时刻的遗忘状态（复活前的原始状态）
            state: MemoryDecayState,
            is_rag_hit: bool,
            should_reactivate: bool,
        }

        let mut candidates: Vec<Candidate> = Vec::new();

        for entry in all {
            let retention = compute_retention(&entry, now);
            let state = classify_decay_state(&entry, now);
            let rag = rag_map.get(&entry.id).copied().unwrap_or(0.0);
            let is_rag_hit = rag >= RAG_REACTIVATE_THRESHOLD;
            let is_high_value = matches!(
                entry.importance,
                MemoryImportance::Critical | MemoryImportance::High
            );

            // 三态分流：不该出现的记忆直接跳过
            if state == MemoryDecayState::Forgotten && !is_rag_hit {
                continue;
            }
            if state == MemoryDecayState::Fading && !is_high_value && !is_rag_hit {
                continue;
            }

            let score = SCORE_WEIGHT_RAG * rag
                + SCORE_WEIGHT_RETENTION * retention
                + SCORE_WEIGHT_IMPORTANCE * importance_weight(entry.importance);

            candidates.push(Candidate {
                entry,
                score,
                rag,
                state,
                is_rag_hit,
                // 只有「被真正想起」才强化稳定性：RAG 命中 或 本就被正常使用
                should_reactivate: is_rag_hit || state == MemoryDecayState::Active,
            });
        }

        if candidates.is_empty() {
            return Ok(Vec::new());
        }

        // 按综合分降序取 top limit；平分按 id 升序兜底，保证输出确定性
        candidates.sort_by(|a, b| {
            b.score
                .total_cmp(&a.score)
                .then_with(|| a.entry.id.cmp(&b.entry.id))
        });
        let top: Vec<Candidate> = candidates.into_iter().take(limit).collect();

        // 3. 只对最终入选的条目做间隔重复强化 + 写回
        let updated: Vec<MemoryEntry> = top
            .into_iter()
            .map(|c| {
                // 弱命中（RAG 分数偏低）用较小的增长系数，避免过度强化
                let growth = if c.rag >= 0.5 {
                    2.2
                } else if c.should_reactivate {
                    1.5
                } else {
                    1.2
                };
                let mut reactivated = reactivate_entry(&c.entry, now, growth);
                // 用户明确提起 → 视为完整回忆（active）；
                // 否则保留检索时的状态，让 AI 知道这是「印象模糊」的旧记忆
                reactivated.decay_state = Some(if c.is_rag_hit {
                    MemoryDecayState::Active
                } else {
                    c.state
                });
                reactivated
            })
            .collect();

        self.store.save_entries(&updated).await?;

        // 返回时带上最新计算的遗忘状态（便于 UI 展示）
        Ok(updated)
    }

    /// 取用（或重建）某角色的 RAG 索引，并执行检索
    ///
    /// 返回 entryId → 归一化相关度 [0, 1]
    fn search_with_index(
        &self,
        role: &str,
        entries: &[MemoryEntry],
        query: Option<&str>,
        k: usize,
    ) -> HashMap<String, f64> {
        let Some(query) = query else {
            return HashMap::new();
        };
        if query.trim().is_empty() {
            return HashMap::new();
        }

        let signature = Bm25Index::compute_index_signature(entries);
        let mut cache = self.rag_cache.lock().expect("RAG 缓存锁中毒");

        let needs_rebuild = match cache.get(role) {
            Some((cached_sig, _)) => cached_sig != &signature,
            None => true,
        };
        if needs_rebuild {
            let mut index = Bm25Index::new();
            index.build(entries);
            cache.insert(role.to_string(), (signature, index));
        }

        let (_, index) = cache.get(role).expect("刚写入的缓存必然存在");
        index
            .search(query, k)
            .into_iter()
            .map(|r| (r.id, r.normalized))
            .collect()
    }

    /// 失效某角色的 RAG 索引缓存
    fn invalidate_rag_index(&self, role: &str) {
        self.rag_cache
            .lock()
            .expect("RAG 缓存锁中毒")
            .remove(role);
    }

    /// 容量控制 —— 超出软上限时淘汰「保留率 × 重要度」最低的条目
    /// critical / identity 类目豁免，不参与淘汰
    async fn prune_if_needed(&self, role: &str) -> AppResult<()> {
        let count = self.store.count(role).await?;
        if count <= 0 || (count as usize) <= MAX_ENTRIES_PER_ROLE {
            return Ok(());
        }

        let entries = self.store.list_entries(role).await?;
        let now = now_ms();
        let excess = entries.len() - MAX_ENTRIES_PER_ROLE;

        let mut evictable: Vec<(&MemoryEntry, f64)> = entries
            .iter()
            .filter(|e| {
                e.importance != MemoryImportance::Critical
                    && e.category != MemoryCategory::Identity
            })
            // 越接近遗忘、越不重要的越先淘汰
            .map(|e| (e, compute_retention(e, now) * importance_weight(e.importance)))
            .collect();
        evictable.sort_by(|a, b| a.1.total_cmp(&b.1).then_with(|| a.0.id.cmp(&b.0.id)));

        let mut removed = 0usize;
        for (entry, _) in evictable.into_iter().take(excess) {
            self.store.delete_entry(&entry.id).await?;
            removed += 1;
        }

        if removed > 0 {
            self.invalidate_rag_index(role);
        }
        Ok(())
    }

    // ─── 上下文构建 ─── //

    /// 构建注入 system prompt 的记忆上下文（身份 + 短期快照 + 长期 RAG 检索片段）
    ///
    /// 纯工具角色直接返回空 assembledContext —— 它们是一次性任务，
    /// 「你记得的关于用户的事」只会产生噪音；identity 仍正常返回。
    pub async fn build_context(
        &self,
        role: &str,
        query: Option<&str>,
    ) -> AppResult<MemoryQueryResult> {
        let identity = self.store.get_identity(role).await?;

        if is_functional_role(role) {
            return Ok(MemoryQueryResult {
                entries: Vec::new(),
                identity,
                short_term: None,
                assembled_context: String::new(),
            });
        }

        let short_term = self.store.get_short_term(role).await?;
        let long_term_entries = self.retrieve(role, query, 15).await?;

        let assembled_context = assemble_prompt_context(
            identity.as_ref(),
            short_term.as_ref(),
            &long_term_entries,
        );

        Ok(MemoryQueryResult {
            entries: long_term_entries,
            identity,
            short_term,
            assembled_context,
        })
    }

    // ─── 观察与学习 ─── //

    /// 观察一轮对话，自动提取值得记住的内容
    ///
    /// 三条规则：
    ///   规则 1  用户明显示意（记住/我喜欢/我叫…）→ preference（high）
    ///   规则 2  用户提到具体事实（URL/版本号/技术栈）→ fact（medium）
    ///   规则 3  整轮对话入语料库（category: conversation）→ 供 RAG 检索回忆
    pub async fn observe(&self, role: &str, user_message: &str, ai_response: &str) -> AppResult<()> {
        // 规则 1：用户说「记住XXX」或「我喜欢XXX」—— 捕获为 preference（一轮只取一条）
        for pattern in PREFERENCE_PATTERNS.iter() {
            if let Some(caps) = pattern.captures(user_message) {
                if let Some(m) = caps.get(1) {
                    self.add_entry(
                        role,
                        m.as_str().trim(),
                        Some(MemoryCategory::Preference),
                        Some(MemoryImportance::High),
                        Some(user_message.to_string()),
                        None,
                    )
                    .await?;
                    break;
                }
            }
        }

        // 规则 2：用户提到具体事实（URL、版本号、技术名）—— 捕获为 fact（一轮只取一条）
        for pattern in FACT_PATTERNS.iter() {
            if let Some(m) = pattern.find(user_message) {
                self.add_entry(
                    role,
                    m.as_str().trim(),
                    Some(MemoryCategory::Fact),
                    Some(MemoryImportance::Medium),
                    Some(user_message.to_string()),
                    None,
                )
                .await?;
                break;
            }
        }

        // 规则 3：整轮对话入 RAG 语料库
        self.record_conversation_turn(role, user_message, ai_response)
            .await
    }

    /// 把一整轮对话切块后存入长期记忆，作为 RAG 可检索语料
    ///
    /// 过滤策略：
    ///   - AI 回复为空 / 任一方是寒暄 → 跳过（没有检索价值）
    ///   - 与最近 N 条对话高度相似（Jaccard ≥ 0.85）→ 跳过（避免复读刷库）
    async fn record_conversation_turn(
        &self,
        role: &str,
        user_message: &str,
        ai_response: &str,
    ) -> AppResult<()> {
        let Some(chunk) = build_conversation_chunk(user_message, ai_response) else {
            return Ok(());
        };

        if self.is_duplicate_conversation(role, &chunk).await? {
            return Ok(());
        }

        self.add_entry(
            role,
            &chunk,
            Some(MemoryCategory::Conversation),
            Some(MemoryImportance::Medium),
            Some("auto:conversation".to_string()),
            None,
        )
        .await?;
        Ok(())
    }

    /// 判断该对话是否与最近几条重复 —— bigram Jaccard 相似度
    async fn is_duplicate_conversation(&self, role: &str, chunk: &str) -> AppResult<bool> {
        let mut recent = self
            .store
            .list_by_category(role, MemoryCategory::Conversation)
            .await?;
        recent.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        recent.truncate(CONVERSATION_DEDUP_WINDOW);

        if recent.is_empty() {
            return Ok(false);
        }

        let new_tokens: HashSet<String> = tokenize(chunk).into_iter().collect();
        if new_tokens.is_empty() {
            return Ok(false);
        }

        for entry in &recent {
            let old_tokens: HashSet<String> = tokenize(&entry.content).into_iter().collect();
            if old_tokens.is_empty() {
                continue;
            }
            let intersection = new_tokens.intersection(&old_tokens).count();
            let union = new_tokens.len() + old_tokens.len() - intersection;
            if union > 0 && intersection as f64 / union as f64 >= CONVERSATION_DUP_THRESHOLD {
                return Ok(true);
            }
        }
        Ok(false)
    }

    // ─── 短期记忆 ─── //

    /// 读取角色短期记忆快照
    pub async fn get_short_term(&self, role: &str) -> AppResult<Option<ShortTermSnapshot>> {
        Ok(self.store.get_short_term(role).await?)
    }

    /// 直接写入短期记忆摘要
    pub async fn save_short_term_direct(
        &self,
        role: &str,
        summary: String,
        covered_message_count: u32,
    ) -> AppResult<ShortTermSnapshot> {
        let snapshot = ShortTermSnapshot {
            summary,
            covered_message_count,
            updated_at: now_ms(),
        };
        self.store.save_short_term(role, &snapshot).await?;
        Ok(snapshot)
    }

    /// 从消息列表自动生成短期摘要：取最近 6 条，每条截断 100 字符
    pub async fn update_short_term_from_messages(
        &self,
        role: &str,
        messages: &[ChatMessage],
    ) -> AppResult<Option<ShortTermSnapshot>> {
        if messages.is_empty() {
            return Ok(None);
        }

        let recent = &messages[messages.len().saturating_sub(SHORT_TERM_RECENT_MESSAGES)..];
        let summary = recent
            .iter()
            .map(|m| {
                let label = if m.role == "user" { "用户" } else { "AI" };
                let content: String = m.content.chars().take(SHORT_TERM_CONTENT_CHARS).collect();
                format!("{label}：{content}")
            })
            .collect::<Vec<_>>()
            .join("\n");

        let snapshot = ShortTermSnapshot {
            summary,
            covered_message_count: messages.len() as u32,
            updated_at: now_ms(),
        };
        self.store.save_short_term(role, &snapshot).await?;
        Ok(Some(snapshot))
    }

    // ─── 导入导出 ─── //

    /// 导出记忆数据（schemaVersion: 1，与扩展端备份文件兼容）
    ///
    /// role 为 None 时导出全部角色，否则仅导出指定角色。
    pub async fn export_memories(&self, role: Option<&str>) -> AppResult<MemoryExportPayload> {
        let roles = match role {
            Some(r) => vec![r.to_string()],
            None => self.store.list_all_roles().await?,
        };

        let mut identities: Vec<IdentityMemory> = Vec::new();
        let mut entries: Vec<MemoryEntry> = Vec::new();
        let mut short_term: HashMap<String, ShortTermSnapshot> = HashMap::new();

        for r in &roles {
            if let Some(identity) = self.store.get_identity(r).await? {
                identities.push(identity);
            }
            entries.extend(self.store.list_entries(r).await?);
            if let Some(snapshot) = self.store.get_short_term(r).await? {
                short_term.insert(r.clone(), snapshot);
            }
        }

        Ok(MemoryExportPayload {
            schema_version: 1,
            exported_at: iso8601_utc_now(),
            identities,
            entries,
            short_term,
        })
    }

    /// 从 JSON 对象恢复记忆数据
    ///
    /// mode = merge  与现有数据合并
    /// mode = replace 先清除涉及角色再写入
    pub async fn import_memories(
        &self,
        payload: MemoryExportPayload,
        mode: ImportMode,
    ) -> AppResult<ImportResult> {
        // 1. 校验 schemaVersion
        if payload.schema_version != 1 {
            return Err(AppError::BadRequest(format!(
                "不支持的导出版本: {}",
                payload.schema_version
            )));
        }

        // 2. 汇总本次导入涉及的所有角色（身份 / 条目 / 短期摘要任一来源都算）
        let mut involved_roles: HashSet<String> = HashSet::new();
        for id in &payload.identities {
            involved_roles.insert(id.role.clone());
        }
        for e in &payload.entries {
            involved_roles.insert(e.role.clone());
        }
        for role in payload.short_term.keys() {
            involved_roles.insert(role.clone());
        }

        // 3. replace 模式下，先清除所有涉及到的 role
        let mut roles_cleared = 0usize;
        if mode == ImportMode::Replace {
            for role in &involved_roles {
                self.store.clear_role(role).await?;
                roles_cleared += 1;
            }
        }

        // 4. 自动补全角色身份 —— 备份里只有记忆条目、没有身份设定的角色，
        //    自动创建一个默认身份（displayName 用角色名），已有身份不覆盖
        let now = now_ms();
        let identity_roles: HashSet<&str> =
            payload.identities.iter().map(|id| id.role.as_str()).collect();
        let mut auto_identities: Vec<IdentityMemory> = Vec::new();
        for role in &involved_roles {
            if identity_roles.contains(role.as_str()) {
                continue;
            }
            if self.store.get_identity(role).await?.is_some() {
                continue;
            }
            auto_identities.push(IdentityMemory {
                role: role.clone(),
                display_name: role.clone(),
                system_prompt_template: String::new(),
                persona_description: None,
                version: 1,
                updated_at: now,
            });
        }

        // 5. 写入 identities（payload + 自动补全）/ entries / short_term
        for identity in payload.identities.iter().chain(auto_identities.iter()) {
            self.store.save_identity(identity).await?;
        }
        self.store.save_entries(&payload.entries).await?;
        for (role, snapshot) in &payload.short_term {
            self.store.save_short_term(role, snapshot).await?;
        }

        // 6. 清空 RAG 缓存，使后续读取拿到新数据
        self.rag_cache
            .lock()
            .expect("RAG 缓存锁中毒")
            .clear();

        let mut roles_imported: Vec<String> = involved_roles.into_iter().collect();
        roles_imported.sort();

        Ok(ImportResult {
            identities_imported: payload.identities.len() + auto_identities.len(),
            entries_imported: payload.entries.len(),
            short_term_imported: payload.short_term.len(),
            roles_cleared,
            roles_imported,
        })
    }
}

/// 构造对话语料块 —— 用户段与 AI 段各自截断，保证单条不会过长
///
/// 不值得入库（AI 没说话 / 寒暄 / 太短）时返回 None
fn build_conversation_chunk(user_message: &str, ai_response: &str) -> Option<String> {
    let user = user_message.trim();
    let ai = ai_response.trim();

    // AI 没说话 or 只是寒暄 → 不构成有价值语料
    if ai.is_empty() || TRIVIAL_REPLY.is_match(ai) {
        return None;
    }
    if TRIVIAL_REPLY.is_match(user) {
        return None;
    }

    // 双方合计太短（如「在吗」「在的」）
    if user.chars().count() + ai.chars().count() < MIN_CONVERSATION_CHARS {
        return None;
    }

    let user_part: String = user.chars().take(CONVERSATION_USER_CHARS).collect();
    let ai_part: String = ai.chars().take(CONVERSATION_AI_CHARS).collect();
    Some(format!("用户：{user_part}\nAI：{ai_part}"))
}

/// 把检索结果拼接成 AI 能理解的文本
/// —— 按分块组织，控制在 CONTEXT_BUDGET 字符内（块间以 "\n\n" 连接，预算扣减 +2 算换行）
fn assemble_prompt_context(
    identity: Option<&IdentityMemory>,
    short_term: Option<&ShortTermSnapshot>,
    long_term_entries: &[MemoryEntry],
) -> String {
    let mut chunks: Vec<String> = Vec::new();
    let mut budget = CONTEXT_BUDGET;

    // 1. 角色身份 —— 最高优先级（只放 personaDescription，systemPromptTemplate 走另一条路）
    if let Some(persona) = identity.and_then(|id| id.persona_description.as_ref()) {
        let persona_block = format!("[角色身份]\n{persona}");
        let block_len = persona_block.chars().count();
        if block_len <= budget {
            budget -= block_len + 2;
            chunks.push(persona_block);
        }
    }

    // 2. 短期记忆摘要 —— 次优先级
    if let Some(st) = short_term {
        if !st.summary.is_empty() {
            let st_block = format!("[近期对话摘要]\n{}", st.summary);
            let block_len = st_block.chars().count();
            if block_len <= budget {
                budget -= block_len + 2;
                chunks.push(st_block);
            }
        }
    }

    // 3. 长期记忆 —— 保持 retrieve() 的混合排序结果（RAG × 保留率 × 重要度）
    let mut entry_lines: Vec<String> = Vec::new();
    for entry in long_term_entries {
        // 模糊记忆加标注，让 AI 知道这是「隐约记得」而非确定事实
        let blur_mark = if entry.decay_state == Some(MemoryDecayState::Fading) {
            "（印象模糊）"
        } else {
            ""
        };
        let line = format!(
            "- [{}] {}{blur_mark}",
            category_label(entry.category),
            entry.content
        );
        let line_len = line.chars().count();
        if line_len + 1 > budget {
            break;
        }
        budget -= line_len + 1;
        entry_lines.push(line);
        if entry_lines.len() >= CONTEXT_MAX_ENTRIES {
            break; // 最多 8 条，避免 prompt 太臃肿
        }
    }

    if !entry_lines.is_empty() {
        chunks.push(format!("[你记得的关于用户的事]\n{}", entry_lines.join("\n")));
    }

    chunks.join("\n\n")
}

/// 记忆类目的中文标签（用于上下文装配）
fn category_label(category: MemoryCategory) -> &'static str {
    match category {
        MemoryCategory::Identity => "身份",
        MemoryCategory::Conversation => "对话片段",
        MemoryCategory::Preference => "用户偏好",
        MemoryCategory::Fact => "事实信息",
        MemoryCategory::Episodic => "情景回忆",
    }
}

/// 当前 UTC 时间的 ISO8601 字符串（毫秒精度，形如 2026-11-03T12:00:00.000Z）
///
/// 不引入 chrono 依赖，用 std::time 手工换算（格里高利历，UTC 无闰秒）。
fn iso8601_utc_now() -> String {
    let ms = now_ms();
    let total_secs = ms.div_euclid(1000);
    let millis = ms.rem_euclid(1000);

    let days = total_secs.div_euclid(86_400);
    let secs_of_day = total_secs.rem_euclid(86_400);
    let hour = secs_of_day / 3600;
    let minute = (secs_of_day % 3600) / 60;
    let second = secs_of_day % 60;

    // 1970-01-01 起的天数 → 年月日（Howard Hinnant 算法）
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };

    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::decay::HOUR_MS;
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::SqlitePool;

    /// 构造内存库 + 迁移 + MemoryService 的测试辅助
    ///
    /// 内存库每个连接独立，必须 max_connections(1) 保证同一连接复用同一数据库
    async fn test_service() -> MemoryService {
        let pool: SqlitePool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("内存库连接失败");
        SqliteMemoryStore::run_migrations(&pool)
            .await
            .expect("内存库迁移失败");
        MemoryService::new(SqliteMemoryStore::new(pool))
    }

    /// 构造一条测试条目并直接写库（绕过 add_entry，便于定制时间字段）
    async fn insert_entry(
        service: &MemoryService,
        id: &str,
        role: &str,
        category: MemoryCategory,
        importance: MemoryImportance,
        content: &str,
        anchor_ms: i64,
    ) -> MemoryEntry {
        let entry = MemoryEntry {
            id: id.to_string(),
            role: role.to_string(),
            category,
            content: content.to_string(),
            importance,
            source: None,
            created_at: anchor_ms,
            last_accessed_at: anchor_ms,
            access_count: 1,
            tags: None,
            stability: None,
            last_reactivated_at: None,
            decay_state: None,
            retention: None,
        };
        service
            .store()
            .save_entries(std::slice::from_ref(&entry))
            .await
            .expect("写入测试条目失败");
        entry
    }

    // ---------- 1. add_entry 默认值与稳定性补全 ----------

    #[tokio::test]
    async fn add_entry_默认值与稳定性补全() {
        let svc = test_service().await;
        let before = now_ms();
        let entry = svc
            .add_entry("miku", "  主人喜欢猫  ", None, None, None, None)
            .await
            .expect("新增失败");

        // 默认值：category=fact、importance=medium、content trim、accessCount=1
        assert_eq!(entry.category, MemoryCategory::Fact);
        assert_eq!(entry.importance, MemoryImportance::Medium);
        assert_eq!(entry.content, "主人喜欢猫");
        assert_eq!(entry.access_count, 1);
        assert!(entry.created_at >= before);
        assert_eq!(entry.created_at, entry.last_accessed_at);
        // 稳定性补全：medium → 168h，计时起点 = lastAccessedAt
        assert_eq!(entry.stability, Some(168.0));
        assert_eq!(entry.last_reactivated_at, Some(entry.last_accessed_at));

        // 指定参数时尊重调用方
        let custom = svc
            .add_entry(
                "miku",
                "我是薇薇",
                Some(MemoryCategory::Preference),
                Some(MemoryImportance::High),
                Some("用户口述".to_string()),
                Some(vec!["猫娘".to_string()]),
            )
            .await
            .expect("新增失败");
        assert_eq!(custom.category, MemoryCategory::Preference);
        assert_eq!(custom.importance, MemoryImportance::High);
        assert_eq!(custom.stability, Some(720.0));
        assert_eq!(custom.source, Some("用户口述".to_string()));
        assert_eq!(custom.tags, Some(vec!["猫娘".to_string()]));

        // 落库后可读回
        let got = svc
            .store()
            .get_entry(&entry.id)
            .await
            .expect("查询失败")
            .expect("条目应当存在");
        assert_eq!(got.content, "主人喜欢猫");
    }

    // ---------- 2. retrieve 混合排序 + 未入选条目不刷新 ----------

    #[tokio::test]
    async fn retrieve_混合排序与未入选不刷新() {
        let svc = test_service().await;

        // 两条新条目：一条与 query 强相关，一条无关
        let related = svc
            .add_entry("miku", "主人喜欢喝美式咖啡", None, None, None, None)
            .await
            .expect("新增失败");
        let _unrelated = svc
            .add_entry("miku", "今天天气不错适合出门散步", None, None, None, None)
            .await
            .expect("新增失败");

        // limit=1：只有一条能入选
        let results = svc
            .retrieve("miku", Some("美式咖啡"), 1)
            .await
            .expect("检索失败");
        assert_eq!(results.len(), 1);
        // RAG 相关条目排前
        assert_eq!(results[0].id, related.id);
        assert_eq!(results[0].decay_state, Some(MemoryDecayState::Active));

        // 未入选条目不刷新 lastReactivatedAt / accessCount（保持创建时的原值）
        let all = svc.store().list_entries("miku").await.expect("查询失败");
        let untouched = all
            .iter()
            .find(|e| e.id != related.id)
            .expect("应存在未入选条目");
        assert_eq!(untouched.access_count, 1, "未入选条目 accessCount 不应变化");
        assert_eq!(
            untouched.last_reactivated_at,
            Some(untouched.created_at),
            "未入选条目 lastReactivatedAt 应保持创建时的原值"
        );
        assert_eq!(untouched.last_accessed_at, untouched.created_at);
        assert_eq!(untouched.stability, Some(168.0), "未入选条目 stability 不应增长");
    }

    // ---------- 3. forgotten 条目 RAG 命中复活 ----------

    #[tokio::test]
    async fn retrieve_遗忘条目被RAG命中复活() {
        let svc = test_service().await;
        let now = now_ms();
        // low 重要度 S=24h；forgotten 需要 R<0.2 → Δt > -ln(0.2)*24h ≈ 38.6h，给 100h
        let ancient = now - (100.0 * HOUR_MS) as i64;
        let forgotten = insert_entry(
            &svc,
            "old-1",
            "miku",
            MemoryCategory::Fact,
            MemoryImportance::Low,
            "主人养了一只叫小橘的猫",
            ancient,
        )
        .await;
        svc.rag_cache
            .lock()
            .expect("锁中毒")
            .clear();

        // 检索前确认是 forgotten
        let listed = svc
            .list_entries("miku", None, None, None, None)
            .await
            .expect("列表失败");
        assert_eq!(listed[0].decay_state, Some(MemoryDecayState::Forgotten));

        // 精准 query 命中 → 复活带回
        let results = svc
            .retrieve("miku", Some("小橘的猫"), 15)
            .await
            .expect("检索失败");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, forgotten.id);
        assert_eq!(results[0].decay_state, Some(MemoryDecayState::Active));

        // 写回：lastReactivatedAt 刷新、accessCount + 1
        let persisted = svc
            .store()
            .get_entry("old-1")
            .await
            .expect("查询失败")
            .expect("条目应当存在");
        assert!(persisted.last_reactivated_at.unwrap() >= now);
        assert_eq!(persisted.access_count, 2);
        // 复活后保留率回到 active 区间
        assert_eq!(
            classify_decay_state(&persisted, now_ms()),
            MemoryDecayState::Active
        );
    }

    // ---------- 4. fading 三态分流 ----------

    #[tokio::test]
    async fn retrieve_fading分流规则() {
        let svc = test_service().await;
        let now = now_ms();
        // low S=24h：fading 区间 0.2≤R<0.55 → Δt ∈ (14h, 38.6h)，取 20h
        let fading_anchor = now - (20.0 * HOUR_MS) as i64;

        // fading + 低重要度 + 无 RAG 命中 → 被过滤
        insert_entry(
            &svc,
            "fading-low",
            "miku",
            MemoryCategory::Fact,
            MemoryImportance::Low,
            "无关紧要的碎碎念日常记录",
            fading_anchor,
        )
        .await;

        // fading + 高重要度（high S=720h，Δt 取 400h 使 R≈0.57 接近边界略低）
        let fading_high_anchor = now - (500.0 * HOUR_MS) as i64;
        insert_entry(
            &svc,
            "fading-high",
            "miku",
            MemoryCategory::Preference,
            MemoryImportance::High,
            "主人对花粉过敏",
            fading_high_anchor,
        )
        .await;

        // 验证两条都处于 fading
        let listed = svc
            .list_entries("miku", None, None, None, None)
            .await
            .expect("列表失败");
        let states: HashMap<String, MemoryDecayState> = listed
            .iter()
            .map(|e| (e.id.clone(), e.decay_state.unwrap()))
            .collect();
        assert_eq!(states["fading-low"], MemoryDecayState::Fading);
        assert_eq!(states["fading-high"], MemoryDecayState::Fading);

        // 无 query（无 RAG 命中）：fading-low 被过滤，fading-high 因高重要度保留
        let results = svc.retrieve("miku", None, 15).await.expect("检索失败");
        let ids: Vec<&str> = results.iter().map(|e| e.id.as_str()).collect();
        assert!(ids.contains(&"fading-high"), "fading 高重要度应保留");
        assert!(
            !ids.contains(&"fading-low"),
            "fading 低重要度且无 RAG 命中应被过滤"
        );
    }

    // ---------- 5. build_context ----------

    #[tokio::test]
    async fn build_context_工具角色返回空上下文() {
        let svc = test_service().await;
        svc.upsert_identity(
            "graph_extractor",
            "图谱提取器".to_string(),
            "你是提取器".to_string(),
            Some("工具人格".to_string()),
        )
        .await
        .expect("身份写入失败");
        svc.add_entry("graph_extractor", "某条工具记忆", None, None, None, None)
            .await
            .expect("新增失败");

        let result = svc
            .build_context("graph_extractor", Some("工具记忆"))
            .await
            .expect("构建失败");
        assert_eq!(result.assembled_context, "");
        assert!(result.entries.is_empty());
        // identity 仍正常返回，shortTerm 恒为 None
        assert!(result.identity.is_some());
        assert!(result.short_term.is_none());

        // translator_ 前缀同样视为工具角色
        assert!(is_functional_role("translator_example_com"));
        assert!(is_functional_role("textarea_ai_autofill"));
        assert!(is_functional_role("table_data_generator"));
        assert!(!is_functional_role("miku"));
    }

    #[tokio::test]
    async fn build_context_正常角色装配分块() {
        let svc = test_service().await;
        svc.upsert_identity(
            "miku",
            "初音未来".to_string(),
            "你是初音未来".to_string(),
            Some("一只温柔的绿色歌姬".to_string()),
        )
        .await
        .expect("身份写入失败");
        svc.save_short_term_direct("miku", "最近聊了猫和咖啡".to_string(), 6)
            .await
            .expect("短期写入失败");
        svc.add_entry(
            "miku",
            "主人喜欢喝美式咖啡",
            Some(MemoryCategory::Preference),
            Some(MemoryImportance::High),
            None,
            None,
        )
        .await
        .expect("新增失败");

        let result = svc
            .build_context("miku", Some("咖啡"))
            .await
            .expect("构建失败");

        // 三个分块齐全，以空行连接
        assert!(result.assembled_context.contains("[角色身份]\n一只温柔的绿色歌姬"));
        assert!(result.assembled_context.contains("[近期对话摘要]\n最近聊了猫和咖啡"));
        assert!(result
            .assembled_context
            .contains("[你记得的关于用户的事]\n- [用户偏好] 主人喜欢喝美式咖啡"));
        assert!(result.assembled_context.contains("\n\n"));
        assert!(result.short_term.is_some());
        assert_eq!(result.entries.len(), 1);
    }

    #[tokio::test]
    async fn build_context_超长内容预算截断() {
        let svc = test_service().await;
        // persona 直接吃满预算：5（块头）+ 1（换行）+ 1994 = 2000，正文 2001 字符必超
        let long_persona = "喵".repeat(2001);
        svc.upsert_identity(
            "miku",
            "初音未来".to_string(),
            "tpl".to_string(),
            Some(long_persona),
        )
        .await
        .expect("身份写入失败");
        // 塞 10 条长条目，验证最多 8 条且整体不超预算
        for i in 0..10 {
            svc.add_entry(
                "miku",
                &format!("第{i}条{}", "很长的记忆内容".repeat(30)),
                Some(MemoryCategory::Fact),
                Some(MemoryImportance::High),
                None,
                None,
            )
            .await
            .expect("新增失败");
        }

        let result = svc.build_context("miku", None).await.expect("构建失败");
        // 超长 persona 块被整体跳过
        assert!(!result.assembled_context.contains("[角色身份]"));
        // 最多 8 条
        let line_count = result
            .assembled_context
            .lines()
            .filter(|l| l.starts_with("- ["))
            .count();
        assert!(line_count <= 8, "长期记忆行数应 ≤ 8，实际 {line_count}");
        // 整体不超预算（允许末尾截断，但绝不无限膨胀）
        assert!(result.assembled_context.chars().count() <= CONTEXT_BUDGET);
    }

    #[tokio::test]
    async fn build_context_fading条目标注印象模糊() {
        let svc = test_service().await;
        let now = now_ms();
        // high S=720h，fading 需要 0.2≤R<0.55 → Δt ∈ (430h, 1159h)，取 500h
        let fading_anchor = now - (500.0 * HOUR_MS) as i64;
        insert_entry(
            &svc,
            "fading-1",
            "miku",
            MemoryCategory::Preference,
            MemoryImportance::High,
            "主人对花粉过敏",
            fading_anchor,
        )
        .await;
        svc.rag_cache.lock().expect("锁中毒").clear();

        let result = svc.build_context("miku", None).await.expect("构建失败");
        assert!(result
            .assembled_context
            .contains("- [用户偏好] 主人对花粉过敏（印象模糊）"));
    }

    // ---------- 6. observe 三规则 ----------

    #[tokio::test]
    async fn observe_捕获用户明示偏好() {
        let svc = test_service().await;
        svc.observe("miku", "记住：我喜欢喝美式咖啡", "好的，我记住啦主人～")
            .await
            .expect("observe 失败");

        let prefs = svc
            .store()
            .list_by_category("miku", MemoryCategory::Preference)
            .await
            .expect("查询失败");
        assert_eq!(prefs.len(), 1, "一轮只取一条 preference");
        assert_eq!(prefs[0].content, "我喜欢喝美式咖啡");
        assert_eq!(prefs[0].importance, MemoryImportance::High);
        assert_eq!(prefs[0].source, Some("记住：我喜欢喝美式咖啡".to_string()));

        // 「我的名字是…」也命中规则 1
        svc.observe("miku", "我的名字是小明", "很高兴认识你，小明！这段回复足够长。")
            .await
            .expect("observe 失败");
        let prefs = svc
            .store()
            .list_by_category("miku", MemoryCategory::Preference)
            .await
            .expect("查询失败");
        assert!(prefs.iter().any(|e| e.content == "小明"));
    }

    #[tokio::test]
    async fn observe_捕获具体事实() {
        let svc = test_service().await;
        svc.observe(
            "miku",
            "你看这个链接 https://example.com/docs 很有用",
            "收到，我来看看这个文档的内容吧。",
        )
        .await
        .expect("observe 失败");

        let facts = svc
            .store()
            .list_by_category("miku", MemoryCategory::Fact)
            .await
            .expect("查询失败");
        assert_eq!(facts.len(), 1);
        assert_eq!(facts[0].content, "https://example.com/docs");
        assert_eq!(facts[0].importance, MemoryImportance::Medium);

        // 操作系统事实（忽略大小写）
        svc.observe("miku", "我用的是 Ubuntu 22.04 系统", "了解啦，Ubuntu 22.04 是个很稳定的发行版。")
            .await
            .expect("observe 失败");
        let facts = svc
            .store()
            .list_by_category("miku", MemoryCategory::Fact)
            .await
            .expect("查询失败");
        assert!(facts
            .iter()
            .any(|e| e.content.to_lowercase().contains("ubuntu")));
    }

    #[tokio::test]
    async fn observe_寒暄与短对话不入库() {
        let svc = test_service().await;

        // AI 寒暄 → 跳过
        svc.observe("miku", "今天天气怎么样呀", "好的")
            .await
            .expect("observe 失败");
        // 用户寒暄 → 跳过
        svc.observe("miku", "谢谢", "不客气，有什么需要随时叫我哦。")
            .await
            .expect("observe 失败");
        // 双方合计 < 12 字符 → 跳过
        svc.observe("miku", "在吗", "在的呢")
            .await
            .expect("observe 失败");
        // AI 空回复 → 跳过
        svc.observe("miku", "随便说点什么吧", "")
            .await
            .expect("observe 失败");

        let convs = svc
            .store()
            .list_by_category("miku", MemoryCategory::Conversation)
            .await
            .expect("查询失败");
        assert!(convs.is_empty(), "寒暄/短对话不应入库: {convs:?}");
    }

    #[tokio::test]
    async fn observe_对话入库与Jaccard去重() {
        let svc = test_service().await;
        let user = "给我讲讲 Rust 的所有权机制是怎么回事";
        let ai = "Rust 的所有权机制是它的核心特性：每个值有且只有一个所有者，当所有者离开作用域时值会被自动释放，从而在没有 GC 的情况下保证内存安全。";

        svc.observe("miku", user, ai).await.expect("observe 失败");
        // 重复一轮基本相同的对话 → 去重，仍只有一条
        svc.observe("miku", user, ai).await.expect("observe 失败");

        let convs = svc
            .store()
            .list_by_category("miku", MemoryCategory::Conversation)
            .await
            .expect("查询失败");
        assert_eq!(convs.len(), 1, "重复对话应被 Jaccard 去重");
        assert!(convs[0].content.starts_with("用户："));
        assert!(convs[0].content.contains("\nAI："));
        assert_eq!(convs[0].source, Some("auto:conversation".to_string()));
        assert_eq!(convs[0].importance, MemoryImportance::Medium);
    }

    // ---------- 7. 容量淘汰 ----------

    #[tokio::test]
    async fn prune_超限时淘汰低分保留豁免() {
        let svc = test_service().await;
        let now = now_ms();
        // 1500 条 low 旧条目（100h 前，保留率极低，优先淘汰）
        let ancient = now - (100.0 * HOUR_MS) as i64;
        let batch: Vec<MemoryEntry> = (0..1500)
            .map(|i| MemoryEntry {
                id: format!("bulk-{i}"),
                role: "miku".to_string(),
                category: MemoryCategory::Fact,
                content: format!("批量旧记忆 {i}"),
                importance: MemoryImportance::Low,
                source: None,
                created_at: ancient + i,
                last_accessed_at: ancient + i,
                access_count: 1,
                tags: None,
                stability: None,
                last_reactivated_at: None,
                decay_state: None,
                retention: None,
            })
            .collect();
        svc.store().save_entries(&batch).await.expect("批量写入失败");

        // 1 条 critical（豁免淘汰）
        insert_entry(
            &svc,
            "critical-1",
            "miku",
            MemoryCategory::Fact,
            MemoryImportance::Critical,
            "绝对不能忘记的核心记忆",
            ancient,
        )
        .await;

        // 再 add 一条触发淘汰：1502 → 删 2 条 low → 回到 1500
        svc.add_entry("miku", "新记忆", None, None, None, None)
            .await
            .expect("新增失败");

        let count = svc.store().count("miku").await.expect("计数失败");
        assert_eq!(count, 1500, "淘汰后总数应回到软上限");
        // critical 豁免保留
        assert!(svc
            .store()
            .get_entry("critical-1")
            .await
            .expect("查询失败")
            .is_some());
    }

    // ---------- 8. recall_entry 复活 ----------

    #[tokio::test]
    async fn recall_entry_手动唤醒() {
        let svc = test_service().await;
        let now = now_ms();
        // medium S=168h，forgotten 需 Δt > 270h，取 400h
        let ancient = now - (400.0 * HOUR_MS) as i64;
        let entry = insert_entry(
            &svc,
            "recall-1",
            "miku",
            MemoryCategory::Fact,
            MemoryImportance::Medium,
            "一条快被遗忘的记忆",
            ancient,
        )
        .await;
        assert_eq!(entry.access_count, 1);

        let revived = svc
            .recall_entry("recall-1")
            .await
            .expect("唤醒失败")
            .expect("条目应当存在");
        // S × 2.2 = 168 × 2.2 = 369.6，计时重置，回到 active
        assert!((revived.stability.unwrap() - 168.0 * 2.2).abs() < 1e-9);
        assert_eq!(revived.access_count, 2);
        assert!(revived.last_reactivated_at.unwrap() >= now);
        assert_eq!(revived.decay_state, Some(MemoryDecayState::Active));

        // 写库后可读回
        let persisted = svc
            .store()
            .get_entry("recall-1")
            .await
            .expect("查询失败")
            .unwrap();
        assert_eq!(persisted.access_count, 2);

        // 不存在返回 None
        assert!(svc
            .recall_entry("not-exist")
            .await
            .expect("唤醒失败")
            .is_none());
    }

    // ---------- 9. upsert_identity version 递增 ----------

    #[tokio::test]
    async fn upsert_identity_版本递增() {
        let svc = test_service().await;
        let v1 = svc
            .upsert_identity(
                "miku",
                "初音未来".to_string(),
                "你是初音未来".to_string(),
                Some("歌姬".to_string()),
            )
            .await
            .expect("写入失败");
        assert_eq!(v1.version, 1);
        assert!(v1.updated_at > 0);

        let v2 = svc
            .upsert_identity(
                "miku",
                "初音未来V2".to_string(),
                "新模板".to_string(),
                None,
            )
            .await
            .expect("写入失败");
        assert_eq!(v2.version, 2);
        assert!(v2.updated_at >= v1.updated_at);
        assert_eq!(v2.display_name, "初音未来V2");
        assert_eq!(v2.persona_description, None);

        // get_identity 读回最新版本
        let got = svc
            .get_identity("miku")
            .await
            .expect("查询失败")
            .expect("身份应当存在");
        assert_eq!(got.version, 2);
    }

    // ---------- 10. 导入导出 ----------

    #[tokio::test]
    async fn export_import_往返一致() {
        let svc = test_service().await;
        svc.upsert_identity(
            "miku",
            "初音未来".to_string(),
            "tpl".to_string(),
            Some("歌姬".to_string()),
        )
        .await
        .expect("写入失败");
        svc.add_entry(
            "miku",
            "主人喜欢猫",
            Some(MemoryCategory::Preference),
            Some(MemoryImportance::High),
            None,
            None,
        )
        .await
        .expect("新增失败");
        svc.save_short_term_direct("miku", "聊了猫".to_string(), 3)
            .await
            .expect("写入失败");

        // 导出
        let payload = svc.export_memories(None).await.expect("导出失败");
        assert_eq!(payload.schema_version, 1);
        assert!(payload.exported_at.ends_with('Z'));
        assert_eq!(payload.identities.len(), 1);
        assert_eq!(payload.entries.len(), 1);
        assert_eq!(payload.short_term.len(), 1);

        // 单角色导出
        let single = svc
            .export_memories(Some("miku"))
            .await
            .expect("导出失败");
        assert_eq!(single.entries.len(), 1);

        // 清空后 merge 导入往返
        svc.forget_all("miku").await.expect("清空失败");
        assert_eq!(svc.store().count("miku").await.expect("计数失败"), 0);

        let result = svc
            .import_memories(payload, ImportMode::Merge)
            .await
            .expect("导入失败");
        assert_eq!(result.identities_imported, 1);
        assert_eq!(result.entries_imported, 1);
        assert_eq!(result.short_term_imported, 1);
        assert_eq!(result.roles_cleared, 0);
        assert_eq!(result.roles_imported, vec!["miku".to_string()]);

        // 数据完整恢复
        assert_eq!(svc.store().count("miku").await.expect("计数失败"), 1);
        assert!(svc.get_identity("miku").await.expect("查询失败").is_some());
        assert!(svc
            .get_short_term("miku")
            .await
            .expect("查询失败")
            .is_some());
    }

    #[tokio::test]
    async fn import_replace模式先清涉及角色() {
        let svc = test_service().await;
        // 角色既有脏数据
        svc.upsert_identity("rin", "镜音铃".to_string(), "旧模板".to_string(), None)
            .await
            .expect("写入失败");
        svc.add_entry("rin", "旧的记忆条目", None, None, None, None)
            .await
            .expect("新增失败");

        // payload：rin 一条新条目（无身份），luka 一条短期（无身份）
        let now = now_ms();
        let payload = MemoryExportPayload {
            schema_version: 1,
            exported_at: "2026-11-03T00:00:00.000Z".to_string(),
            identities: vec![],
            entries: vec![MemoryEntry {
                id: "imp-1".to_string(),
                role: "rin".to_string(),
                category: MemoryCategory::Fact,
                content: "导入的新记忆".to_string(),
                importance: MemoryImportance::Medium,
                source: None,
                created_at: now,
                last_accessed_at: now,
                access_count: 1,
                tags: None,
                stability: Some(168.0),
                last_reactivated_at: Some(now),
                decay_state: None,
                retention: None,
            }],
            short_term: HashMap::from([(
                "luka".to_string(),
                ShortTermSnapshot {
                    summary: "巡音的短期摘要".to_string(),
                    covered_message_count: 2,
                    updated_at: now,
                },
            )]),
        };

        let result = svc
            .import_memories(payload, ImportMode::Replace)
            .await
            .expect("导入失败");
        assert_eq!(result.roles_cleared, 2, "rin 与 luka 均被清除");
        assert_eq!(result.entries_imported, 1);
        // 无身份角色自动补默认身份：rin + luka
        assert_eq!(result.identities_imported, 2);
        assert_eq!(
            result.roles_imported,
            vec!["luka".to_string(), "rin".to_string()]
        );

        // rin 的旧条目已被清除，只剩导入的一条
        let rin_entries = svc.store().list_entries("rin").await.expect("查询失败");
        assert_eq!(rin_entries.len(), 1);
        assert_eq!(rin_entries[0].content, "导入的新记忆");

        // 自动补全的默认身份
        let rin_id = svc
            .get_identity("rin")
            .await
            .expect("查询失败")
            .expect("身份应当存在");
        assert_eq!(rin_id.display_name, "rin");
        assert_eq!(rin_id.system_prompt_template, "");
        assert_eq!(rin_id.version, 1);
        assert!(svc
            .get_identity("luka")
            .await
            .expect("查询失败")
            .is_some());
    }

    #[tokio::test]
    async fn import_版本不支持返回BadRequest() {
        let svc = test_service().await;
        let payload = MemoryExportPayload {
            schema_version: 2,
            exported_at: "2026-11-03T00:00:00.000Z".to_string(),
            identities: vec![],
            entries: vec![],
            short_term: HashMap::new(),
        };
        let err = svc
            .import_memories(payload, ImportMode::Merge)
            .await
            .expect_err("应当拒绝 schemaVersion 2");
        match err {
            AppError::BadRequest(msg) => {
                assert!(msg.contains("不支持的导出版本: 2"), "错误消息不符: {msg}")
            }
            other => panic!("应为 BadRequest，实际 {other:?}"),
        }
    }

    // ---------- 11. 短期记忆 ----------

    #[tokio::test]
    async fn update_short_term_取最近六条() {
        let svc = test_service().await;
        let messages: Vec<ChatMessage> = (1..=8)
            .map(|i| ChatMessage {
                role: if i % 2 == 1 {
                    "user".to_string()
                } else {
                    "assistant".to_string()
                },
                content: format!("第{i}条消息"),
            })
            .collect();

        let snapshot = svc
            .update_short_term_from_messages("miku", &messages)
            .await
            .expect("写入失败")
            .expect("应当生成快照");

        // 只取最近 6 条（第 3~8 条），covered 为全量 8
        assert_eq!(snapshot.covered_message_count, 8);
        let lines: Vec<&str> = snapshot.summary.lines().collect();
        assert_eq!(lines.len(), 6);
        assert_eq!(lines[0], "用户：第3条消息");
        assert_eq!(lines[1], "AI：第4条消息");
        assert_eq!(lines[5], "AI：第8条消息");
        assert!(snapshot.updated_at > 0);

        // 读回一致
        let got = svc
            .get_short_term("miku")
            .await
            .expect("查询失败")
            .expect("快照应当存在");
        assert_eq!(got.summary, snapshot.summary);

        // 空消息列表不动既有快照
        let none = svc
            .update_short_term_from_messages("miku", &[])
            .await
            .expect("调用失败");
        assert!(none.is_none());
        let got = svc
            .get_short_term("miku")
            .await
            .expect("查询失败")
            .expect("快照不应被清空");
        assert_eq!(got.covered_message_count, 8);

        // 直接写入覆盖
        let direct = svc
            .save_short_term_direct("miku", "手动摘要".to_string(), 20)
            .await
            .expect("写入失败");
        assert_eq!(direct.summary, "手动摘要");
        assert_eq!(direct.covered_message_count, 20);
    }

    // ---------- 杂项：CRUD 与角色列表 ----------

    #[tokio::test]
    async fn update_remove_entry_与角色过滤() {
        let svc = test_service().await;
        let entry = svc
            .add_entry("miku", "原始内容", None, None, None, None)
            .await
            .expect("新增失败");

        // 局部更新
        let updated = svc
            .update_entry(
                &entry.id,
                &EntryPatch {
                    content: Some("更新后的内容".to_string()),
                    importance: Some(MemoryImportance::Critical),
                    category: None,
                    tags: Some(vec!["重点".to_string()]),
                },
            )
            .await
            .expect("更新失败")
            .expect("条目应当存在");
        assert_eq!(updated.content, "更新后的内容");
        assert_eq!(updated.importance, MemoryImportance::Critical);
        assert_eq!(updated.tags, Some(vec!["重点".to_string()]));

        // 更新不存在的条目返回 None
        assert!(svc
            .update_entry("not-exist", &EntryPatch::default())
            .await
            .expect("更新失败")
            .is_none());

        // 角色列表：chat_only 过滤工具角色
        svc.add_entry("graph_extractor", "工具记忆", None, None, None, None)
            .await
            .expect("新增失败");
        let all = svc.list_roles(false).await.expect("查询失败");
        assert!(all.contains(&"miku".to_string()));
        assert!(all.contains(&"graph_extractor".to_string()));
        let chat = svc.list_roles(true).await.expect("查询失败");
        assert!(chat.contains(&"miku".to_string()));
        assert!(!chat.contains(&"graph_extractor".to_string()));

        // 删除：存在返回 true，重复删除返回 false
        assert!(svc.remove_entry(&entry.id).await.expect("删除失败"));
        assert!(!svc.remove_entry(&entry.id).await.expect("重复删除失败"));

        // forget_all 清空
        svc.forget_all("miku").await.expect("清空失败");
        assert_eq!(svc.store().count("miku").await.expect("计数失败"), 0);
    }

    #[tokio::test]
    async fn list_entries_状态过滤与分页() {
        let svc = test_service().await;
        let now = now_ms();
        // 一条 active（新），一条 forgotten（旧 low）
        insert_entry(
            &svc,
            "active-1",
            "miku",
            MemoryCategory::Fact,
            MemoryImportance::Medium,
            "新鲜记忆",
            now,
        )
        .await;
        insert_entry(
            &svc,
            "forgotten-1",
            "miku",
            MemoryCategory::Fact,
            MemoryImportance::Low,
            "陈旧记忆",
            now - (100.0 * HOUR_MS) as i64,
        )
        .await;

        // 运行时字段填充
        let all = svc
            .list_entries("miku", None, None, None, None)
            .await
            .expect("列表失败");
        assert_eq!(all.len(), 2);
        for e in &all {
            assert!(e.retention.is_some());
            assert!(e.decay_state.is_some());
        }
        // created_at DESC 排序
        assert_eq!(all[0].id, "active-1");

        // 状态过滤
        let forgotten = svc
            .list_entries("miku", None, Some(MemoryDecayState::Forgotten), None, None)
            .await
            .expect("列表失败");
        assert_eq!(forgotten.len(), 1);
        assert_eq!(forgotten[0].id, "forgotten-1");

        // 分页
        let page = svc
            .list_entries("miku", None, None, Some(1), Some(1))
            .await
            .expect("列表失败");
        assert_eq!(page.len(), 1);
        assert_eq!(page[0].id, "forgotten-1");

        // 类目过滤
        let facts = svc
            .list_entries("miku", Some(MemoryCategory::Preference), None, None, None)
            .await
            .expect("列表失败");
        assert!(facts.is_empty());
    }
}
