/**
 * @file services/memory/memory-service.ts
 * @description AI 记忆服务 —— 业务语义层，提供"记住这个"、"回忆一下"、"构建上下文"等高级能力
 *
 * 调用链：
 *   completeChatFlow(prompt, role, systemPrompt)
 *     → memoryService.buildContext(role, prompt)     // 1. 检索 + 拼接
 *     → systemPrompt + assembledContext              // 2. 合并到 system prompt
 *     → DeepSeek 对话完成后
 *     → memoryService.observe(role, messages)        // 3. 观察对话，提取记忆
 */

import { getMemoryStore, generateMemoryId } from "./memory-store";
import {
    classifyDecayState,
    computeRetention,
    normalizeEntry,
    reactivateEntry,
} from "./decay";
import { Bm25Index, computeIndexSignature, tokenize, type RankedMemory } from "./rag-retriever";
import type {
    IdentityMemory,
    MemoryCategory,
    MemoryEntry,
    MemoryImportance,
    MemoryQueryResult,
    ShortTermSnapshot,
} from "./types";

/** 上下文构建时的 token 预算（字符数近似） */
const CONTEXT_BUDGET = 2000;

/** 归一化的重要度权重 ∈ [0, 1] —— 混排打分时使用 */
const IMPORTANCE_WEIGHT: Record<MemoryImportance, number> = {
    critical: 1,
    high: 0.7,
    medium: 0.4,
    low: 0.15,
};

/** 混合排序权重：RAG 相关性 / 遗忘保留率 / 重要度 */
const SCORE_WEIGHTS = {
    rag: 0.5,
    retention: 0.3,
    importance: 0.2,
} as const;

/** RAG 命中阈值 —— 达到即视为"用户提起了这条记忆"，触发复活 */
const RAG_REACTIVATE_THRESHOLD = 0.15;

/** 单角色记忆软上限 —— chrome.storage.local 共 5MB，超出按遗忘程度淘汰 */
const MAX_ENTRIES_PER_ROLE = 1500;

/** 对话语料单条最大字符数（用户段 + AI 段合计） */
const CONVERSATION_USER_CHARS = 150;
const CONVERSATION_AI_CHARS = 250;

/** 太琐碎的一轮对话不值得入库 */
const MIN_CONVERSATION_CHARS = 12;

/** 去重时回看的最近对话条目数 */
const CONVERSATION_DEDUP_WINDOW = 8;

/** Jaccard 相似度阈值 —— 超过判定为重复对话 */
const CONVERSATION_DUP_THRESHOLD = 0.85;

/** 寒暄类噪声回复 —— 这类 AI 回答没有检索价值 */
const TRIVIAL_REPLY = /^(好的?|嗯+|哦+|谢谢|收到|明白了?|ok|okay)[。.！!~～\s]*$/i;

/** MemoryService —— 业务语义层 */
export class MemoryService {
    private store = getMemoryStore();

    /**
     * RAG 索引缓存（按角色）
     * signature 变化时说明条目集合已变动，需要重建索引
     */
    private ragIndexCache = new Map<
        string,
        { signature: string; index: Bm25Index }
    >();

    // ─── 身份记忆 ─── //

    /**
     * 注册或更新角色身份
     * —— 当用户在 options 页面修改角色设定时调用
     */
    async upsertIdentity(params: Omit<IdentityMemory, "version" | "updatedAt">): Promise<IdentityMemory> {
        const existing = await this.store.getIdentity(params.role);
        const now = Date.now();

        const identity: IdentityMemory = existing
            ? {
                  ...existing,
                  ...params,
                  version: existing.version + 1,
                  updatedAt: now,
              }
            : {
                  ...params,
                  version: 1,
                  updatedAt: now,
              };

        await this.store.saveIdentity(identity);
        return identity;
    }

    /** 获取角色身份 */
    async getIdentity(role: string): Promise<IdentityMemory | null> {
        return this.store.getIdentity(role);
    }

    // ─── 记忆条目 CRUD ─── //

    /**
     * 新增一条长期记忆
     * —— 当 AI 判断某段对话值得记住时调用
     * —— 或用户说"记住我喜欢猫"时显式调用
     */
    async addEntry(params: {
        role: string;
        content: string;
        category?: MemoryCategory;
        importance?: MemoryImportance;
        source?: string;
        tags?: string[];
    }): Promise<MemoryEntry> {
        const now = Date.now();
        const base: MemoryEntry = {
            id: generateMemoryId(),
            role: params.role,
            category: params.category ?? "fact",
            content: params.content.trim(),
            importance: params.importance ?? "medium",
            source: params.source,
            tags: params.tags,
            createdAt: now,
            lastAccessedAt: now,
            accessCount: 1,
        };

        // 补全遗忘曲线字段：按 importance 取初始稳定性 S
        const entry = normalizeEntry(base);

        await this.store.saveEntries([entry]);
        this.invalidateRagIndex(params.role);

        // 容量控制：超出软上限时按"保留率 × 重要度"淘汰最不重要的
        await this.pruneIfNeeded(params.role);

        return entry;
    }

    /** 更新记忆条目（如提升 importance） */
    async updateEntry(id: string, patch: Partial<MemoryEntry>): Promise<void> {
        // 先找到所属 role —— 遍历所有 role 的 entries
        const roles = await this.store.listAllRoles();
        for (const role of roles) {
            const entries = await this.store.listEntries(role);
            const idx = entries.findIndex((e) => e.id === id);
            if (idx >= 0) {
                const updated: MemoryEntry = { ...entries[idx], ...patch };
                await this.store.saveEntries([updated]);
                this.invalidateRagIndex(role);
                return;
            }
        }
    }

    /** 删除记忆条目 */
    async removeEntry(id: string): Promise<void> {
        await this.store.deleteEntry(id);
        // role 未知，整体失效重建
        this.ragIndexCache.clear();
    }

    /** 列出某角色所有记忆 */
    async listEntries(role: string): Promise<MemoryEntry[]> {
        return this.store.listEntries(role);
    }

    /** 列出某角色指定类别的记忆 —— 对话历史用 category: "conversation" */
    async listByCategory(
        role: string,
        category: MemoryCategory,
    ): Promise<MemoryEntry[]> {
        return this.store.listByCategory(role, category);
    }

    /**
     * 手动"想起来"一条记忆 —— Memory Manager 里的唤醒按钮
     *
     * 效果等同于用户在对话中主动提起：稳定性 S × 2.2，计时重置为现在，
     * 遗忘状态回到 active，重新进入可注入上下文的候选池。
     *
     * @returns 被唤醒后的条目；找不到时返回 null
     */
    async recallEntry(id: string): Promise<MemoryEntry | null> {
        const roles = await this.store.listAllRoles();

        for (const role of roles) {
            const entries = await this.store.listEntries(role);
            const found = entries.find((e) => e.id === id);
            if (!found) continue;

            const revived = reactivateEntry(normalizeEntry(found), Date.now());
            await this.store.saveEntries([revived]);
            this.invalidateRagIndex(role);
            return revived;
        }

        return null;
    }

    /** 列出所有已注册角色 */
    async listRoles(): Promise<string[]> {
        return this.store.listAllRoles();
    }

    /** 清除某角色所有记忆（忘记一切） */
    async forgetAll(role: string): Promise<void> {
        await this.store.clearRole(role);
        this.invalidateRagIndex(role);
    }

    // ─── 检索与排序 ─── //

    /**
     * 检索相关记忆 —— RAG(BM25) 相关性 × 遗忘曲线保留率 × 重要度 混合排序
     *
     * 三态分流规则：
     *   active    正常参与排序
     *   fading    仅高重要度（high/critical）或 RAG 命中时保留
     *   forgotten 默认不注入 —— 但若 RAG 命中（用户又提起了）则"复活"并带回上下文
     *
     * 关键修正：只有真正被返回的条目才会刷新 lastReactivatedAt，
     * 避免"每检索一次所有记忆都变新鲜"导致遗忘曲线失效。
     *
     * @param role   目标角色
     * @param query  可选查询文本（用户当前输入）
     * @param limit  返回条数上限
     */
    async retrieve(role: string, query?: string, limit = 15): Promise<MemoryEntry[]> {
        const rawEntries = await this.store.listEntries(role);
        if (rawEntries.length === 0) return [];

        // 旧数据迁移：补全 stability / lastReactivatedAt
        const all = rawEntries.map(normalizeEntry);
        const now = Date.now();

        // 1. RAG 检索 —— 索引覆盖全部条目（含已遗忘的，才能"提起就想起"）
        const ragMap = this.searchWithIndex(role, all, query, limit * 3);

        // 2. 逐条打分 + 三态分流
        type Candidate = {
            entry: MemoryEntry;
            score: number;
            rag: number;
            /** 检索时刻的遗忘状态（复活前的原始状态） */
            state: ReturnType<typeof classifyDecayState>;
            isRagHit: boolean;
            shouldReactivate: boolean;
        };

        const candidates: Candidate[] = [];

        for (const entry of all) {
            const retention = computeRetention(entry, now);
            const state = classifyDecayState(entry, now);
            const rag = ragMap.get(entry.id) ?? 0;
            const isRagHit = rag >= RAG_REACTIVATE_THRESHOLD;
            const isHighValue =
                entry.importance === "critical" || entry.importance === "high";

            // 三态分流：不该出现的记忆直接跳过
            if (state === "forgotten" && !isRagHit) continue;
            if (state === "fading" && !isHighValue && !isRagHit) continue;

            const score =
                SCORE_WEIGHTS.rag * rag +
                SCORE_WEIGHTS.retention * retention +
                SCORE_WEIGHTS.importance * IMPORTANCE_WEIGHT[entry.importance];

            candidates.push({
                entry,
                score,
                rag,
                state,
                isRagHit,
                // 只有"被真正想起"才强化稳定性：RAG 命中 或 本就被正常使用
                shouldReactivate: isRagHit || state === "active",
            });
        }

        if (candidates.length === 0) return [];

        candidates.sort((a, b) => b.score - a.score);
        const top = candidates.slice(0, limit);

        // 3. 只对最终入选的条目做间隔重复强化 + 写回
        const updated: MemoryEntry[] = top.map((c) => {
            // 弱命中（RAG 分数偏低）用较小的增长系数，避免过度强化
            const growth = c.rag >= 0.5 ? 2.2 : c.shouldReactivate ? 1.5 : 1.2;
            const reactivated = reactivateEntry(c.entry, now, growth);
            return {
                ...reactivated,
                // 用户明确提起 → 视为完整回忆（active）；
                // 否则保留检索时的状态，让 AI 知道这是「印象模糊」的旧记忆
                decayState: c.isRagHit ? "active" : c.state,
            };
        });

        await this.store.saveEntries(updated);

        // 返回时带上最新计算的遗忘状态（便于 UI 展示）
        return updated;
    }

    /**
     * 取用（或重建）某角色的 RAG 索引，并执行检索
     *
     * @returns entryId → 归一化相关度 [0, 1]
     */
    private searchWithIndex(
        role: string,
        entries: MemoryEntry[],
        query: string | undefined,
        k: number,
    ): Map<string, number> {
        if (!query || !query.trim()) return new Map();

        const signature = computeIndexSignature(entries);
        let cached = this.ragIndexCache.get(role);

        if (!cached || cached.signature !== signature) {
            const index = new Bm25Index();
            index.build(entries);
            cached = { signature, index };
            this.ragIndexCache.set(role, cached);
        }

        const ranked: RankedMemory[] = cached.index.search(query, k);
        return new Map(ranked.map((r) => [r.id, r.normalized]));
    }

    /** 失效某角色的 RAG 索引缓存 */
    private invalidateRagIndex(role: string): void {
        this.ragIndexCache.delete(role);
    }

    /**
     * 容量控制 —— 超出软上限时淘汰"保留率 × 重要度"最低的条目
     * critical / identity 类目豁免，不参与淘汰
     */
    private async pruneIfNeeded(role: string): Promise<void> {
        const entries = await this.store.listEntries(role);
        if (entries.length <= MAX_ENTRIES_PER_ROLE) return;

        const now = Date.now();
        const excess = entries.length - MAX_ENTRIES_PER_ROLE;

        const evictable = entries
            .filter((e) => e.importance !== "critical" && e.category !== "identity")
            .map((e) => ({
                entry: e,
                // 越接近遗忘、越不重要的越先淘汰
                priority: computeRetention(e, now) * IMPORTANCE_WEIGHT[e.importance],
            }))
            .sort((a, b) => a.priority - b.priority)
            .slice(0, excess);

        for (const { entry } of evictable) {
            await this.store.deleteEntry(entry.id);
        }

        if (evictable.length > 0) {
            this.invalidateRagIndex(role);
        }
    }

    // ─── 上下文构建 ─── //

    /**
     * 构建注入 system prompt 的记忆上下文
     * —— 这是最核心的方法，每次对话前调用
     *
     * @param role  目标角色
     * @param query 当前用户输入（用于检索相关记忆）
     */
    async buildContext(role: string, query?: string): Promise<MemoryQueryResult> {
        const [identity, shortTerm, longTermEntries] = await Promise.all([
            this.store.getIdentity(role),
            this.store.getShortTerm(role),
            this.retrieve(role, query),
        ]);

        const assembledContext = this.assemblePromptContext({
            identity,
            shortTerm,
            longTermEntries,
        });

        return {
            identity: identity ?? undefined,
            shortTerm: shortTerm ?? undefined,
            entries: longTermEntries,
            assembledContext,
        };
    }

    /**
     * 把检索结果拼接成 AI 能理解的文本
     * —— 按分块组织，控制在 CONTEXT_BUDGET 字符内
     */
    private assemblePromptContext(params: {
        identity: IdentityMemory | null;
        shortTerm: ShortTermSnapshot | null;
        longTermEntries: MemoryEntry[];
    }): string {
        const chunks: string[] = [];
        let budget = CONTEXT_BUDGET;

        // 1. 角色身份 —— 最高优先级，总是放（但只放 personaDescription，systemPromptTemplate 走另一条路）
        if (params.identity?.personaDescription) {
            const personaBlock = `[角色身份]\n${params.identity.personaDescription}`;
            if (personaBlock.length <= budget) {
                chunks.push(personaBlock);
                budget -= personaBlock.length + 2;
            }
        }

        // 2. 短期记忆摘要 —— 次优先级
        if (params.shortTerm?.summary) {
            const stBlock = `[近期对话摘要]\n${params.shortTerm.summary}`;
            if (stBlock.length <= budget) {
                chunks.push(stBlock);
                budget -= stBlock.length + 2;
            }
        }

        // 3. 长期记忆 —— 保持 retrieve() 的混合排序结果（RAG × 保留率 × 重要度）
        const usedCategories = new Set<MemoryCategory>();
        const categoryLabels: Record<MemoryCategory, string> = {
            identity: "身份",
            conversation: "对话片段",
            preference: "用户偏好",
            fact: "事实信息",
            episodic: "情景回忆",
        };

        const entryLines: string[] = [];
        for (const entry of params.longTermEntries) {
            // 模糊记忆加标注，让 AI 知道这是"隐约记得"而非确定事实
            const blurMark = entry.decayState === "fading" ? "（印象模糊）" : "";
            const line = `- [${categoryLabels[entry.category]}] ${entry.content}${blurMark}`;
            if (line.length + 1 > budget) break;
            entryLines.push(line);
            budget -= line.length + 1;
            usedCategories.add(entry.category);
            if (entryLines.length >= 8) break; // 最多 8 条，避免 prompt 太臃肿
        }

        if (entryLines.length > 0) {
            chunks.push(`[你记得的关于用户的事]\n${entryLines.join("\n")}`);
        }

        return chunks.length > 0 ? chunks.join("\n\n") : "";
    }

    // ─── 观察与学习 ─── //

    /**
     * 观察一轮对话，自动提取值得记住的内容
     *
     * 三条规则：
     *   规则 1  用户明显示意（记住/我喜欢/我叫…）→ preference（high）
     *   规则 2  用户提到具体事实（URL/版本号/技术栈）→ fact（medium）
     *   规则 3  整轮对话入语料库（category: conversation）→ 供 RAG 检索回忆
     *
     * @param role   目标角色
     * @param userMessage   用户输入
     * @param aiResponse    AI 输出
     */
    async observe(role: string, userMessage: string, aiResponse: string): Promise<void> {
        // 规则 1：用户说"记住XXX"或"我喜欢XXX" —— 捕获为 preference
        const preferencePatterns = [
            /记住[：:]?\s*(.+)/,
            /我(?:喜|爱)欢[：:]?\s*(.+)/,
            /我(?:讨厌|不喜欢|反感)[：:]?\s*(.+)/,
            /我(?:叫|是)[：:]?\s*(.+)/,
            /我的(?:名字|网名|昵称)[是为][：:]?\s*(.+)/,
        ];

        for (const pattern of preferencePatterns) {
            const match = userMessage.match(pattern);
            if (match && match[1]) {
                await this.addEntry({
                    role,
                    content: match[1].trim(),
                    category: "preference",
                    importance: "high",
                    source: userMessage,
                });
                break; // 一轮只取一个 preference
            }
        }

        // 规则 2：用户提到具体事实（URL、版本号、技术名） —— 捕获为 fact
        const factPatterns = [
            /(?:项目|仓库)[：:]?\s*(\S+)/,
            /(?:框架|技术|语言)[：:]?\s*(\S+)/,
            /(?:版本)[：:]?\s*([\w.\-]+)/,
            /(?:ubuntu|windows|macOS|centos)\s*[\d.]*/i,
            /https?:\/\/\S+/,
        ];

        for (const pattern of factPatterns) {
            const match = userMessage.match(pattern);
            if (match && match[0]) {
                await this.addEntry({
                    role,
                    content: match[0].trim(),
                    category: "fact",
                    importance: "medium",
                    source: userMessage,
                });
                break;
            }
        }

        // 规则 3：整轮对话入 RAG 语料库
        await this.recordConversationTurn(role, userMessage, aiResponse);
    }

    /**
     * 把一整轮对话切块后存入长期记忆，作为 RAG 可检索语料
     *
     * 过滤策略：
     *   - AI 回复为空 / 双方都是寒暄 → 跳过（没有检索价值）
     *   - 与最近 N 条对话高度相似（Jaccard ≥ 0.85）→ 跳过（避免复读刷库）
     */
    private async recordConversationTurn(
        role: string,
        userMessage: string,
        aiResponse: string,
    ): Promise<void> {
        const chunk = this.buildConversationChunk(userMessage, aiResponse);
        if (!chunk) return;

        if (await this.isDuplicateConversation(role, chunk)) return;

        await this.addEntry({
            role,
            content: chunk,
            category: "conversation",
            importance: "medium",
            source: "auto:conversation",
        });
    }

    /**
     * 构造对话语料块 —— 用户段与 AI 段各自截断，保证单条不会过长
     *
     * @returns 可入库文本；不值得入库时返回 null
     */
    private buildConversationChunk(
        userMessage: string,
        aiResponse: string,
    ): string | null {
        const user = userMessage.trim();
        const ai = aiResponse.trim();

        // AI 没说话 or 只是寒暄 → 不构成有价值语料
        if (!ai || TRIVIAL_REPLY.test(ai)) return null;
        if (TRIVIAL_REPLY.test(user)) return null;

        // 双方合计太短（如「在吗」「在的」）
        if (user.length + ai.length < MIN_CONVERSATION_CHARS) return null;

        const userPart = user.slice(0, CONVERSATION_USER_CHARS);
        const aiPart = ai.slice(0, CONVERSATION_AI_CHARS);
        return `用户：${userPart}\nAI：${aiPart}`;
    }

    /**
     * 判断该对话是否与最近几条重复 —— 用 bigram Jaccard 相似度
     */
    private async isDuplicateConversation(
        role: string,
        chunk: string,
    ): Promise<boolean> {
        const recent = (await this.store.listByCategory(role, "conversation"))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, CONVERSATION_DEDUP_WINDOW);

        if (recent.length === 0) return false;

        const newTokens = new Set(tokenize(chunk));
        if (newTokens.size === 0) return false;

        return recent.some((entry) => {
            const oldTokens = new Set(tokenize(entry.content));
            if (oldTokens.size === 0) return false;

            let intersection = 0;
            for (const token of newTokens) {
                if (oldTokens.has(token)) intersection += 1;
            }
            const union = newTokens.size + oldTokens.size - intersection;
            return union > 0 && intersection / union >= CONVERSATION_DUP_THRESHOLD;
        });
    }

    /**
     * 更新短期记忆摘要 —— 当对话轮次累计到一定数量时调用
     * （当前用 AI 响应简单截断，后续可升级为 LLM 摘要）
     */
    async updateShortTerm(role: string, messages: Array<{ role: "user" | "assistant" | "system"; content: string }>): Promise<void> {
        if (messages.length === 0) return;

        // 取最近 6 轮的最后几条作为"近期摘要"
        const recent = messages.slice(-6);
        const summary = recent
            .map((m) => {
                const label = m.role === "user" ? "用户" : "AI";
                return `${label}：${m.content.slice(0, 100)}`;
            })
            .join("\n");

        const snapshot: ShortTermSnapshot = {
            summary,
            coveredMessageCount: messages.length,
            updatedAt: Date.now(),
        };

        await this.store.saveShortTerm(role, snapshot);
    }
}

/** 全局单例 */
let _service: MemoryService | null = null;

export function getMemoryService(): MemoryService {
    if (!_service) {
        _service = new MemoryService();
    }
    return _service;
}
