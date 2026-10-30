/**
 * @file graph-builder.ts
 * @description 记忆知识网络的图数据构建 —— 按「共享关键词」连边的纯函数模块
 *
 * 设计要点：
 *   1. 节点 = 记忆条目，按重要度 + 艾宾浩斯保留率排序后限流
 *   2. 连线 = 两条记忆共享的中文 bigram / 英文整词，用倒排索引两两配对
 *   3. 高频词（df 过大）直接丢弃，避免"的连接是"这种噪声词炸出满屏连线
 *   4. 孤立节点仍保留，让"没有关联的记忆"也能在图里被看见
 *
 * 该模块不依赖 DOM，可直接单元测试。
 */

import {
  classifyDecayState,
  computeRetention,
  tokenize,
} from "@/services/memory";
import type {
  MemoryCategory,
  MemoryDecayState,
  MemoryEntry,
  MemoryImportance,
} from "@/services/memory";

/** 节点数据 —— 直接映射到 Cytoscape 的 data 字段 */
export interface MemoryGraphNodeData {
  /** 记忆条目 ID */
  id: string;
  /** 图谱上显示的短标签 */
  label: string;
  /** 记忆分类（决定节点颜色） */
  category: MemoryCategory;
  /** 重要度（决定节点大小） */
  importance: MemoryImportance;
  /** 遗忘状态（决定描边颜色） */
  decayState: MemoryDecayState;
  /** 保留率 0~1（决定节点透明度） */
  retention: number;
  /** 完整内容（用于点击后的详情展示） */
  fullContent: string;
}

/** 连线数据 */
export interface MemoryGraphEdgeData {
  id: string;
  source: string;
  target: string;
  /** 共享词数量 —— 决定连线粗细 */
  weight: number;
  /** 共享词示例（最多 3 个，用于 tooltip） */
  sharedTerms: string[];
}

export interface MemoryGraphNode {
  data: MemoryGraphNodeData;
}

export interface MemoryGraphEdge {
  data: MemoryGraphEdgeData;
}

export interface BuildGraphOptions {
  /** 节点上限，默认 400 —— Cytoscape 千级节点会明显卡顿 */
  maxNodes?: number;
  /** 连线上限，默认 300 */
  maxEdges?: number;
  /** 单个词最多连接多少条记忆，超过视为噪声词丢弃，默认 12 */
  maxPostingSize?: number;
  /** 连边阈值：共享词数 / 较短一方的词数，默认 0.15 */
  minEdgeScore?: number;
  /** 计算保留率用的"当前时间"，便于测试注入 */
  now?: number;
}

/** 重要度权重 —— 越大越优先进入图谱 */
const IMPORTANCE_RANK: Record<MemoryImportance, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** 节点标签最大长度 */
const LABEL_MAX_LENGTH = 24;

/** 每条边最多记录的共享词数量（用于展示） */
const MAX_SHARED_TERMS = 3;

/** 把长文本裁成图谱标签 */
const toLabel = (content: string): string => {
  const trimmed = content.trim().replace(/\s+/g, " ");
  return trimmed.length > LABEL_MAX_LENGTH
    ? `${trimmed.slice(0, LABEL_MAX_LENGTH)}…`
    : trimmed;
};

/** 生成稳定的无向边 ID（小的 ID 在前，保证 A-B 与 B-A 同一条边） */
const buildEdgeId = (a: string, b: string): string =>
  a < b ? `${a}~${b}` : `${b}~${a}`;

/**
 * 把记忆条目转成 Cytoscape 图数据
 *
 * @example
 * const { nodes, edges } = buildMemoryGraph(entries);
 */
export function buildMemoryGraph(
  entries: MemoryEntry[],
  options: BuildGraphOptions = {},
): { nodes: MemoryGraphNode[]; edges: MemoryGraphEdge[] } {
  const {
    maxNodes = 400,
    maxEdges = 300,
    maxPostingSize = 12,
    minEdgeScore = 0.15,
    now = Date.now(),
  } = options;

  // 过滤空内容，避免图谱出现无标签的幽灵节点
  const usable = entries.filter((entry) => entry.content.trim().length > 0);
  if (usable.length === 0) {
    return { nodes: [], edges: [] };
  }

  // ─── 1. 节点排序 + 限流 ─── //
  // 综合分 = 重要度权重 + 保留率：核心且新鲜的记忆优先展示
  const scored = usable
    .map((entry) => ({
      entry,
      retention: computeRetention(entry, now),
      score: IMPORTANCE_RANK[entry.importance] + computeRetention(entry, now),
    }))
    .sort((a, b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt)
    .slice(0, Math.max(1, maxNodes));

  const nodes: MemoryGraphNode[] = scored.map(({ entry, retention }) => ({
    data: {
      id: entry.id,
      label: toLabel(entry.content),
      category: entry.category,
      importance: entry.importance,
      decayState: classifyDecayState(entry, now),
      retention,
      fullContent: entry.content,
    },
  }));

  // ─── 2. 分词 + 倒排索引 ─── //
  // id -> 去重后的词集合
  const tokensById = new Map<string, Set<string>>();
  // 词 -> 出现该词的记忆 ID 列表
  const postings = new Map<string, string[]>();

  for (const { entry } of scored) {
    const tokens = new Set(tokenize(entry.content));
    tokensById.set(entry.id, tokens);

    for (const token of tokens) {
      const bucket = postings.get(token);
      if (bucket) {
        bucket.push(entry.id);
      } else {
        postings.set(token, [entry.id]);
      }
    }
  }

  // ─── 3. 共享词两两配对 ─── //
  // 只处理"至少两条记忆共享，且不是高频噪声词"的 token
  const pairSharedCount = new Map<string, number>();
  const pairTerms = new Map<string, string[]>();

  for (const [token, ids] of postings) {
    if (ids.length < 2 || ids.length > maxPostingSize) {
      continue;
    }

    for (let i = 0; i < ids.length - 1; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const edgeId = buildEdgeId(ids[i], ids[j]);
        pairSharedCount.set(edgeId, (pairSharedCount.get(edgeId) ?? 0) + 1);

        const terms = pairTerms.get(edgeId);
        if (terms) {
          if (terms.length < MAX_SHARED_TERMS) {
            terms.push(token);
          }
        } else {
          pairTerms.set(edgeId, [token]);
        }
      }
    }
  }

  // ─── 4. 打分 + 阈值过滤 + 数量限流 ─── //
  const candidates = [...pairSharedCount.entries()]
    .map(([edgeId, sharedCount]) => {
      const [source, target] = edgeId.split("~");
      const sourceTokens = tokensById.get(source)?.size ?? 1;
      const targetTokens = tokensById.get(target)?.size ?? 1;
      // 用较短一方的词数做分母：避免长文本天然得分偏低
      const score =
        sharedCount / Math.max(1, Math.min(sourceTokens, targetTokens));

      return {
        edgeId,
        source,
        target,
        sharedCount,
        score,
        sharedTerms: pairTerms.get(edgeId) ?? [],
      };
    })
    .filter((candidate) => candidate.score >= minEdgeScore)
    .sort(
      (a, b) =>
        b.sharedCount - a.sharedCount ||
        b.score - a.score ||
        a.edgeId.localeCompare(b.edgeId),
    )
    .slice(0, Math.max(0, maxEdges));

  const edges: MemoryGraphEdge[] = candidates.map((candidate) => ({
    data: {
      id: candidate.edgeId,
      source: candidate.source,
      target: candidate.target,
      weight: candidate.sharedCount,
      sharedTerms: candidate.sharedTerms,
    },
  }));

  return { nodes, edges };
}

/** 默认节点上限 —— 供 UI 侧展示"已裁剪"提示 */
export const DEFAULT_MAX_NODES = 400;

/** 默认连线上限 */
export const DEFAULT_MAX_EDGES = 300;
