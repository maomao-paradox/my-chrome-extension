//! BM25 RAG 检索：CJK bigram 分词 + 内存倒排索引，完整对齐扩展端 `rag-retriever.ts`。
//!
//! 设计要点（与 TS 版逐一对应）：
//! - 中文不引入分词库，直接输出字符 bigram（单字保留自身），短文本召回率足够好
//! - 英文/数字按整词索引（字符数 < 2 丢弃），避免单字符噪声 token
//! - BM25 公式：`score = Σ idf(t) × (tf × (k1+1)) / (tf + k1 × (1 - b + b × dl/avgdl))`
//!   其中 `idf(t) = ln(1 + (N - df + 0.5) / (df + 0.5))`，`k1 = 1.2`、`b = 0.75`
//! - 条目集合变化（增删改）时整体重建索引，千级条目重建耗时毫秒级，无需增量维护

use std::collections::{HashMap, HashSet};

use crate::models::MemoryEntry;

/// BM25 词频饱和参数
pub const K1: f64 = 1.2;
/// BM25 文档长度归一化参数
pub const B: f64 = 0.75;

/// 判断字符是否属于 CJK 统一表意文字（基本区 + 扩展 A）
fn is_cjk(ch: char) -> bool {
    ('\u{3400}'..='\u{4DBF}').contains(&ch) || ('\u{4E00}'..='\u{9FFF}').contains(&ch)
}

/// 中英混合分词 —— 中文出 bigram，英文/数字出整词
///
/// # 示例
/// ```
/// use memory_server::rag::tokenize;
/// // "3"、"5" 为单字符拉丁 run，按规则丢弃
/// assert_eq!(tokenize("我喜欢 TypeScript 3.5"), vec!["我喜", "喜欢", "typescript"]);
/// ```
pub fn tokenize(text: &str) -> Vec<String> {
    let mut tokens: Vec<String> = Vec::new();
    let lower = text.to_lowercase();

    // 当前累积的字符 run；用 Vec<char> 记录以便按「字符数」而非字节数判断长度
    let mut run: Vec<char> = Vec::new();
    let mut run_is_cjk = false;

    // 把当前累积的字符序列切分并推入 tokens（对齐 TS 版 flush 逻辑）
    fn flush(run: &mut Vec<char>, run_is_cjk: bool, tokens: &mut Vec<String>) {
        if run.is_empty() {
            return;
        }
        if run_is_cjk {
            // 中文：输出连续字符 bigram；单字保留自身
            if run.len() == 1 {
                tokens.push(run[0].to_string());
            } else {
                for window in run.windows(2) {
                    tokens.push(window.iter().collect());
                }
            }
        } else if run.len() >= 2 {
            // 英文/数字：整词索引，忽略单字符噪声
            tokens.push(run.iter().collect());
        }
        run.clear();
    }

    for ch in lower.chars() {
        if is_cjk(ch) {
            // 拉丁 run → CJK run 切换：先结算旧 run
            if !run_is_cjk {
                flush(&mut run, run_is_cjk, &mut tokens);
            }
            run_is_cjk = true;
            run.push(ch);
        } else if ch.is_alphanumeric() {
            // CJK run → 拉丁 run 切换：先结算旧 run
            if run_is_cjk {
                flush(&mut run, run_is_cjk, &mut tokens);
            }
            run_is_cjk = false;
            run.push(ch);
        } else {
            // 标点/空白/emoji 等：作为切分边界，结束当前 run
            flush(&mut run, run_is_cjk, &mut tokens);
        }
    }
    flush(&mut run, run_is_cjk, &mut tokens);

    tokens
}

/// 单条文档的检索结果
#[derive(Debug, Clone, PartialEq)]
pub struct RankedMemory {
    /// 记忆条目 ID
    pub id: String,
    /// BM25 原始得分
    pub score: f64,
    /// 归一化得分 ∈ [0, 1]（除以本次结果集最高分）
    pub normalized: f64,
}

/// 内存倒排索引
///
/// 生命周期：按 role 缓存，条目集合变化（增删改）时调用 `build` 整体重建。
#[derive(Debug, Default)]
pub struct Bm25Index {
    /// term → (docId → 词频)
    postings: HashMap<String, HashMap<String, u32>>,
    /// docId → 文档长度（token 数）
    doc_lengths: HashMap<String, usize>,
    /// 索引的文档总数（空文档不计入）
    doc_count: usize,
    /// 平均文档长度
    avg_doc_length: f64,
}

impl Bm25Index {
    /// 创建空索引
    pub fn new() -> Self {
        Self::default()
    }

    /// 索引的文档总数
    pub fn len(&self) -> usize {
        self.doc_count
    }

    /// 索引是否为空
    pub fn is_empty(&self) -> bool {
        self.doc_count == 0
    }

    /// 重建索引：清空既有倒排表，按当前条目集合重新统计
    pub fn build(&mut self, entries: &[MemoryEntry]) {
        self.postings.clear();
        self.doc_lengths.clear();
        self.doc_count = 0;
        self.avg_doc_length = 0.0;

        let mut total_length: usize = 0;

        for entry in entries {
            let tokens = tokenize(&entry.content);
            // 空文档（纯标点等）跳过，不进入索引
            if tokens.is_empty() {
                continue;
            }

            // 统计当前文档的词频
            let mut term_freq: HashMap<&str, u32> = HashMap::new();
            for token in &tokens {
                *term_freq.entry(token.as_str()).or_insert(0) += 1;
            }

            // 写入倒排表
            for (term, tf) in term_freq {
                self.postings
                    .entry(term.to_string())
                    .or_default()
                    .insert(entry.id.clone(), tf);
            }

            self.doc_lengths.insert(entry.id.clone(), tokens.len());
            self.doc_count += 1;
            total_length += tokens.len();
        }

        self.avg_doc_length = if self.doc_count > 0 {
            total_length as f64 / self.doc_count as f64
        } else {
            0.0
        };
    }

    /// 检索与 query 最相关的 top-k 记忆
    pub fn search(&self, query: &str, k: usize) -> Vec<RankedMemory> {
        if self.doc_count == 0 {
            return Vec::new();
        }

        // 查询分词并去重（同一 token 重复出现不影响 BM25 得分）
        let mut seen: HashSet<String> = HashSet::new();
        let query_tokens: Vec<String> = tokenize(query)
            .into_iter()
            .filter(|token| seen.insert(token.clone()))
            .collect();
        if query_tokens.is_empty() {
            return Vec::new();
        }

        let doc_total = self.doc_count as f64;
        // avgdl 为 0 时按 1 处理，避免除零
        let avgdl = if self.avg_doc_length == 0.0 {
            1.0
        } else {
            self.avg_doc_length
        };

        let mut scores: HashMap<String, f64> = HashMap::new();

        for term in &query_tokens {
            let Some(posting) = self.postings.get(term) else {
                continue;
            };

            let df = posting.len() as f64;
            // BM25 idf（加 1 防止负值）
            let idf = (1.0 + (doc_total - df + 0.5) / (df + 0.5)).ln();

            for (doc_id, tf) in posting {
                let dl = self.doc_lengths.get(doc_id).copied().unwrap_or(0) as f64;
                let length_norm = 1.0 - B + B * dl / avgdl;
                let tf = *tf as f64;
                let score = idf * ((tf * (K1 + 1.0)) / (tf + K1 * length_norm));
                *scores.entry(doc_id.clone()).or_insert(0.0) += score;
            }
        }

        if scores.is_empty() {
            return Vec::new();
        }

        let mut ranked: Vec<RankedMemory> = scores
            .into_iter()
            .map(|(id, score)| RankedMemory {
                id,
                score,
                normalized: 0.0,
            })
            .collect();
        // 按分数降序取 top-k；平分按 id 升序兜底，保证输出确定性
        ranked.sort_by(|a, b| {
            b.score
                .total_cmp(&a.score)
                .then_with(|| a.id.cmp(&b.id))
        });
        ranked.truncate(k);

        // 归一化到 [0, 1]：除以本次结果集最高分（最高分为 0 则记 0）
        let max_score = ranked.first().map(|item| item.score).unwrap_or(0.0);
        for item in &mut ranked {
            item.normalized = if max_score > 0.0 {
                item.score / max_score
            } else {
                0.0
            };
        }

        ranked
    }

    /// 索引缓存签名 —— 用于判断条目集合是否变化、是否需要重建索引
    ///
    /// 格式：`{条数}:{content字符总数}:{最大created_at}`
    pub fn compute_index_signature(entries: &[MemoryEntry]) -> String {
        let mut total_chars: usize = 0;
        let mut max_created_at: i64 = 0;
        for entry in entries {
            // 字符数按 Unicode 字符计数（chars().count()），而非字节数
            total_chars += entry.content.chars().count();
            if entry.created_at > max_created_at {
                max_created_at = entry.created_at;
            }
        }
        format!("{}:{}:{}", entries.len(), total_chars, max_created_at)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{MemoryCategory, MemoryImportance};

    /// 构造测试用记忆条目：仅填充 BM25 关心的字段，其余给默认值
    fn make_entry(id: &str, content: &str, created_at: i64) -> MemoryEntry {
        MemoryEntry {
            id: id.to_string(),
            role: "test_role".to_string(),
            category: MemoryCategory::Fact,
            content: content.to_string(),
            importance: MemoryImportance::Medium,
            source: None,
            created_at,
            last_accessed_at: created_at,
            access_count: 1,
            tags: None,
            stability: None,
            last_reactivated_at: None,
            decay_state: None,
            retention: None,
        }
    }

    /// 常用测试语料：两条含「喜欢」，一条纯英文+中文混合
    fn sample_entries() -> Vec<MemoryEntry> {
        vec![
            make_entry("e1", "我喜欢写扩展", 100),
            make_entry("e2", "主人喜欢猫", 200),
            make_entry("e3", "rust 记忆系统", 300),
        ]
    }

    // ---------- tokenize ----------

    #[test]
    fn tokenize_中英混合样例() {
        // 「我喜欢」出 bigram「我喜」「喜欢」；TypeScript 小写化整词输出；"3"、"5" 单字符丢弃
        let tokens = tokenize("我喜欢 TypeScript 3.5");
        assert_eq!(tokens, vec!["我喜", "喜欢", "typescript"]);
    }

    #[test]
    fn tokenize_空串返回空() {
        assert!(tokenize("").is_empty());
    }

    #[test]
    fn tokenize_纯标点返回空() {
        assert!(tokenize("，。！？…— ").is_empty());
        assert!(tokenize("!@#$%^&*()").is_empty());
    }

    #[test]
    fn tokenize_单个CJK字保留自身() {
        assert_eq!(tokenize("猫"), vec!["猫"]);
    }

    #[test]
    fn tokenize_CJK连续run切bigram() {
        // 4 字 run → 3 个 bigram
        assert_eq!(tokenize("我喜欢猫"), vec!["我喜", "喜欢", "欢猫"]);
    }

    #[test]
    fn tokenize_拉丁单词长度不足2被丢弃() {
        // 单字符英文/数字 token 属于噪声，直接丢弃
        assert!(tokenize("a b c 1 2").is_empty());
        assert_eq!(tokenize("ab cd"), vec!["ab", "cd"]);
    }

    #[test]
    fn tokenize_大小写统一为小写() {
        assert_eq!(tokenize("Rust RUST"), vec!["rust", "rust"]);
    }

    #[test]
    fn tokenize_标点作为CJK与拉丁的边界() {
        // 逗号同时结束 CJK run 与后续拉丁 run
        assert_eq!(tokenize("你好,world"), vec!["你好", "world"]);
    }

    // ---------- Bm25Index ----------

    #[test]
    fn search_空索引返回空() {
        let index = Bm25Index::new();
        assert!(index.is_empty());
        assert_eq!(index.len(), 0);
        assert!(index.search("喜欢", 10).is_empty());
    }

    #[test]
    fn search_空查询返回空() {
        let mut index = Bm25Index::new();
        index.build(&sample_entries());
        assert!(index.search("", 10).is_empty());
        // 纯标点查询分词为空，同样返回空
        assert!(index.search("！！！", 10).is_empty());
    }

    #[test]
    fn build_空文档不进入索引() {
        let mut index = Bm25Index::new();
        let entries = vec![make_entry("e1", "！！！", 100), make_entry("e2", "猫", 100)];
        index.build(&entries);
        // 纯标点条目被跳过，仅「猫」入索引
        assert_eq!(index.len(), 1);
    }

    #[test]
    fn search_命中排序与归一化() {
        let mut index = Bm25Index::new();
        index.build(&sample_entries());
        assert_eq!(index.len(), 3);

        let results = index.search("喜欢", 10);
        // e1「我喜欢写扩展」与 e2「主人喜欢猫」命中；e3 不含「喜欢」
        assert_eq!(results.len(), 2);
        // 分数降序；e2 文档更短，BM25 长度归一化后得分更高
        assert_eq!(results[0].id, "e2");
        assert_eq!(results[1].id, "e1");
        assert!(results[0].score > results[1].score);
        // 归一化：top1 恒为 1，其余 ∈ [0, 1]
        assert_eq!(results[0].normalized, 1.0);
        for item in &results {
            assert!((0.0..=1.0).contains(&item.normalized));
        }
    }

    #[test]
    fn search_topk截断() {
        let mut index = Bm25Index::new();
        index.build(&sample_entries());
        let results = index.search("喜欢", 1);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "e2");
    }

    #[test]
    fn search_未命中返回空() {
        let mut index = Bm25Index::new();
        index.build(&sample_entries());
        assert!(index.search("不存在于索引的词组", 10).is_empty());
    }

    #[test]
    fn search_拉丁整词命中() {
        let mut index = Bm25Index::new();
        index.build(&sample_entries());
        let results = index.search("Rust", 10);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "e3");
    }

    #[test]
    fn build_重复调用清空重建() {
        let mut index = Bm25Index::new();
        index.build(&sample_entries());
        assert_eq!(index.len(), 3);
        // 重建为更小集合后，旧条目不再命中
        index.build(&[make_entry("e9", "全新条目", 400)]);
        assert_eq!(index.len(), 1);
        assert!(index.search("喜欢", 10).is_empty());
    }

    // ---------- compute_index_signature ----------

    #[test]
    fn signature_空集合() {
        assert_eq!(Bm25Index::compute_index_signature(&[]), "0:0:0");
    }

    #[test]
    fn signature_格式为条数_字符数_最大created() {
        // 「我喜欢写扩展」6 字符 + 「主人喜欢猫」5 字符 + 「rust 记忆系统」9 字符 = 20
        assert_eq!(
            Bm25Index::compute_index_signature(&sample_entries()),
            "3:20:300"
        );
    }

    #[test]
    fn signature_随条目集合变化() {
        let base = Bm25Index::compute_index_signature(&sample_entries());

        // 条数变化 → 签名变化
        let mut more = sample_entries();
        more.push(make_entry("e4", "新增一条记忆", 400));
        assert_ne!(Bm25Index::compute_index_signature(&more), base);

        // content 变化（字符数变化）→ 签名变化
        let edited = vec![
            make_entry("e1", "我喜欢写浏览器扩展", 100),
            make_entry("e2", "主人喜欢猫", 200),
            make_entry("e3", "rust 记忆系统", 300),
        ];
        assert_ne!(Bm25Index::compute_index_signature(&edited), base);

        // 最大 created_at 变化 → 签名变化
        let touched = vec![
            make_entry("e1", "我喜欢写扩展", 100),
            make_entry("e2", "主人喜欢猫", 999),
            make_entry("e3", "rust 记忆系统", 300),
        ];
        assert_ne!(Bm25Index::compute_index_signature(&touched), base);
    }
}
