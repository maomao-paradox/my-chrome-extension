/**
 * @file services/memory/rag-retriever.ts
 * @description 轻量 RAG 检索器 —— BM25 + 中文字符 bigram 倒排索引
 *
 * 为什么不用向量库：
 *   浏览器扩展环境没有 embedding 服务，引入 ChromaDB / onnx 模型会让包体积暴涨。
 *   BM25 是纯 JS、零依赖、零网络、毫秒级，在中短文本检索上表现足够好。
 *
 * 中文分词方案 —— 字符 bigram：
 *   不用分词库，把「我喜欢写扩展」切成 我喜/喜欢/欢写/写扩/扩展。
 *   这是信息检索里的经典 trick，短文本召回率接近分词方案。
 *   英文/数字按整词索引（长度 >= 2），避免 i / a 这类噪声 token。
 *
 * BM25 公式：
 *   score = Σ idf(t) × (tf × (k1+1)) / (tf + k1 × (1 - b + b × dl/avgdl))
 *   idf(t) = ln(1 + (N - df + 0.5) / (df + 0.5))
 */

import type { MemoryEntry } from "./types";

/** BM25 词频饱和参数 */
const K1 = 1.2;
/** BM25 文档长度归一化参数 */
const B = 0.75;

/** CJK 统一表意文字范围（含扩展 A） */
const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff]/;
/** 可作为单词字符的内容（任意语言文字 + 数字） */
const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * 中英混合分词 —— 中文出 bigram，英文/数字出整词
 *
 * @example
 *   tokenize("我喜欢 TypeScript 3.5")
 *   // → ["我喜", "喜欢", "typescript", "3", "5"]  (数字单字符被丢弃)
 */
export function tokenize(text: string): string[] {
    const tokens: string[] = [];
    const lower = text.toLowerCase();

    let run = "";
    let runIsCjk = false;

    /** 把当前累积的字符序列切分并推入 tokens */
    const flush = () => {
        if (!run) return;
        if (runIsCjk) {
            // 中文：输出字符 bigram；单字保留自身
            if (run.length === 1) {
                tokens.push(run);
            } else {
                for (let i = 0; i < run.length - 1; i += 1) {
                    tokens.push(run.slice(i, i + 2));
                }
            }
        } else if (run.length >= 2) {
            // 英文/数字：整词索引，忽略单字符噪声
            tokens.push(run);
        }
        run = "";
    };

    for (const ch of lower) {
        if (CJK_CHAR.test(ch)) {
            if (!runIsCjk) flush();
            runIsCjk = true;
            run += ch;
        } else if (WORD_CHAR.test(ch)) {
            if (runIsCjk) flush();
            runIsCjk = false;
            run += ch;
        } else {
            flush();
        }
    }
    flush();

    return tokens;
}

/** 单条文档的检索结果 */
export interface RankedMemory {
    /** 记忆条目 ID */
    id: string;
    /** BM25 原始得分 */
    score: number;
    /** 归一化得分 ∈ [0, 1]（除以本次结果集最高分） */
    normalized: number;
}

/**
 * Bm25Index —— 内存倒排索引
 *
 * 生命周期：
 *   按 role 缓存，条目集合变化（增删改）时重建。
 *   单角色上千条记忆重建耗时在毫秒级，无需增量维护的复杂度。
 */
export class Bm25Index {
    /** term → (docId → 词频) */
    private readonly postings = new Map<string, Map<string, number>>();
    /** docId → 文档长度（token 数） */
    private readonly docLengths = new Map<string, number>();
    /** docId → 原始条目 */
    private readonly docs = new Map<string, MemoryEntry>();
    /** 平均文档长度 */
    private avgDocLength = 0;

    /** 索引的文档总数 */
    get size(): number {
        return this.docs.size;
    }

    /** 重建索引 */
    build(entries: MemoryEntry[]): void {
        this.postings.clear();
        this.docLengths.clear();
        this.docs.clear();

        let totalLength = 0;

        for (const entry of entries) {
            const tokens = tokenize(entry.content);
            if (tokens.length === 0) continue;

            const termFreq = new Map<string, number>();
            for (const token of tokens) {
                termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
            }

            for (const [term, tf] of termFreq) {
                let posting = this.postings.get(term);
                if (!posting) {
                    posting = new Map<string, number>();
                    this.postings.set(term, posting);
                }
                posting.set(entry.id, tf);
            }

            this.docLengths.set(entry.id, tokens.length);
            this.docs.set(entry.id, entry);
            totalLength += tokens.length;
        }

        this.avgDocLength = this.docs.size > 0 ? totalLength / this.docs.size : 0;
    }

    /**
     * 检索与 query 最相关的 top-k 记忆
     *
     * @param query 用户当前输入
     * @param k     返回条数上限
     */
    search(query: string, k = 15): RankedMemory[] {
        if (this.docs.size === 0) return [];

        const queryTokens = Array.from(new Set(tokenize(query)));
        if (queryTokens.length === 0) return [];

        const N = this.docs.size;
        const scores = new Map<string, number>();

        for (const term of queryTokens) {
            const posting = this.postings.get(term);
            if (!posting) continue;

            const df = posting.size;
            // BM25 idf（加 1 防止负值）
            const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

            for (const [docId, tf] of posting) {
                const dl = this.docLengths.get(docId) ?? 0;
                const lengthNorm = 1 - B + (B * dl) / (this.avgDocLength || 1);
                const score = idf * ((tf * (K1 + 1)) / (tf + K1 * lengthNorm));
                scores.set(docId, (scores.get(docId) ?? 0) + score);
            }
        }

        if (scores.size === 0) return [];

        const ranked: RankedMemory[] = [...scores.entries()]
            .map(([id, score]) => ({ id, score, normalized: 0 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, k);

        const maxScore = ranked[0]?.score ?? 0;
        return ranked.map((item) => ({
            ...item,
            normalized: maxScore > 0 ? item.score / maxScore : 0,
        }));
    }
}

/** 索引缓存签名 —— 用于判断是否需要重建 */
export function computeIndexSignature(entries: MemoryEntry[]): string {
    let totalChars = 0;
    let maxCreatedAt = 0;
    for (const entry of entries) {
        totalChars += entry.content.length;
        if (entry.createdAt > maxCreatedAt) maxCreatedAt = entry.createdAt;
    }
    return `${entries.length}:${totalChars}:${maxCreatedAt}`;
}
