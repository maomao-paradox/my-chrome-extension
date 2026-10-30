/**
 * @file graph-schema.ts
 * @description 记忆知识图谱的数据契约层
 *
 * 职责：
 *   1. 把记忆条目拼成给大模型的抽取提示词
 *   2. 把模型返回的文本解析成 ChatKnowledgeGraph 需要的 GraphData
 *   3. 计算缓存指纹（记忆没变化就不重复调用模型）
 *
 * 这里只做纯计算，不碰 chrome API，便于单元测试。
 */

import type { MemoryEntry, MemoryImportance } from "@/services/memory";
import type {
  GraphData,
  GraphEdge,
  GraphNode,
  NodeType,
} from "@/components/ChatKnowledgeGraph/types";

/** 合法节点类型集合 —— 与 ChatKnowledgeGraph 的颜色映射保持一致 */
const VALID_NODE_TYPES: readonly NodeType[] = [
  "role",
  "preference",
  "topic",
  "behavior",
  "proactive",
  "custom",
];

/** 重要度排序权重：越重要越优先进入提示词 */
const IMPORTANCE_RANK: Record<MemoryImportance, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/** 提示词中记忆条目的字符上限，避免一次性塞爆上下文 */
export const MAX_PROMPT_CHARS = 14_000;

/**
 * 从记忆条目构建抽取提示词
 *
 * 排序策略：重要度优先，其次最近访问时间；总长度超限时截断尾部。
 */
export function buildGraphPrompt(
  role: string,
  entries: MemoryEntry[],
  maxChars = MAX_PROMPT_CHARS,
): string {
  const sorted = [...entries].sort((a, b) => {
    const rankDiff =
      IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance];
    if (rankDiff !== 0) return rankDiff;
    return b.lastAccessedAt - a.lastAccessedAt;
  });

  const lines: string[] = [];
  let used = 0;
  let truncated = false;

  for (const entry of sorted) {
    // 记忆内容可能多行，压成单行方便模型逐条阅读
    const content = entry.content.replace(/\s*\n+\s*/g, " / ").trim();
    if (!content) continue;
    const line = `- [${entry.category}] ${content}`;
    if (used + line.length > maxChars) {
      truncated = true;
      break;
    }
    lines.push(line);
    used += line.length;
  }

  return [
    "你是「记忆知识图谱抽取器」。请阅读下面某个角色的记忆条目，抽取实体和关系，并只输出一个 JSON 对象。",
    "",
    "要求：",
    "1. 节点 type 只能取 role / preference / topic / behavior / proactive / custom 之一。",
    "2. 节点 id 用英文或拼音短横线命名（如 vivy、likes-petting），全图必须唯一。",
    "3. 节点 label 用中文，不超过 10 个字；desc 一句话说明，不超过 30 个字。",
    "4. 边的 source / target 必须引用已声明的节点 id，不要自环；label 是关系名（如 称呼、偏好、主动提醒）。",
    "5. 节点数量控制在 8~40 个，只保留有信息量的实体；没有把握的关系宁可不连。",
    "6. 严禁输出 markdown 代码块、注释或任何解释文字，只输出 JSON：",
    '{"nodes":[{"id":"...","label":"...","type":"...","desc":"..."}],"edges":[{"source":"...","target":"...","label":"..."}]}',
    "",
    `当前角色：${role}`,
    truncated ? "（记忆条目过多，以下为按重要度截断后的内容）" : "",
    "记忆条目：",
    ...lines,
  ]
    .filter((part, index, arr) => part !== "" || arr[index - 1] !== "")
    .join("\n");
}

/**
 * 计算缓存指纹：角色 + 条目数量 + 最近变更时间
 * 记忆没有新增/修改时命中缓存，避免重复消耗模型调用。
 */
export function buildGraphFingerprint(
  role: string,
  entries: MemoryEntry[],
): string {
  if (entries.length === 0) return `${role}|empty`;
  let latest = 0;
  for (const entry of entries) {
    const touched = Math.max(
      entry.createdAt,
      entry.lastAccessedAt,
      entry.lastReactivatedAt ?? 0,
    );
    if (touched > latest) latest = touched;
  }
  return `${role}|${entries.length}|${latest}`;
}

/** 把 JSON 文本里的代码围栏去掉，并截取最外层对象 */
function extractJsonObject(raw: string): string {
  const text = raw
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型返回的内容不是 JSON 对象");
  }
  return text.slice(start, end + 1);
}

/** 判断节点类型是否合法，非法时降级为 custom */
function normalizeNodeType(value: unknown): NodeType {
  return VALID_NODE_TYPES.includes(value as NodeType)
    ? (value as NodeType)
    : "custom";
}

/** 去掉首尾空白并截断到指定长度 */
function clampText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/**
 * 解析模型返回文本为 GraphData
 *
 * 容错策略：非法节点类型降级为 custom；重复 id 保留首个；
 * 引用不存在节点的边直接丢弃，保证组件渲染不会崩。
 *
 * @throws 当返回内容无法解析为 JSON 对象时
 */
export function parseGraphData(
  raw: string,
  title?: string,
): GraphData {
  const parsed = JSON.parse(extractJsonObject(raw)) as {
    nodes?: unknown;
    edges?: unknown;
  };

  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();

  if (Array.isArray(parsed.nodes)) {
    for (const item of parsed.nodes) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const id = clampText(record.id, 60);
      if (!id || nodeIds.has(id)) continue;

      nodeIds.add(id);
      nodes.push({
        id,
        label: clampText(record.label, 20) || id,
        type: normalizeNodeType(record.type),
        desc: clampText(record.desc, 80) || undefined,
        sourceQuote: clampText(record.sourceQuote, 120) || undefined,
      });
    }
  }

  const edges: GraphEdge[] = [];
  if (Array.isArray(parsed.edges)) {
    for (const item of parsed.edges) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const source = clampText(record.source, 60);
      const target = clampText(record.target, 60);
      // 只保留两端都存在的边，避免悬空连线
      if (!source || !target) continue;
      if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
      if (source === target) continue;

      edges.push({
        source,
        target,
        label: clampText(record.label, 20) || undefined,
      });
    }
  }

  return { nodes, edges, title };
}
