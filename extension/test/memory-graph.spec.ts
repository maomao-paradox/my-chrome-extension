/**
 * @file test/memory-graph.spec.ts
 * @description 记忆知识网络的图构建算法单元测试
 *
 * 覆盖 buildMemoryGraph 的：
 *   1. 空输入 / 无共享词 / 有共享词的三种基础图形态
 *   2. minEdgeScore 阈值过滤
 *   3. maxPostingSize 高频噪声词剔除
 *   4. maxNodes 节点限流（重要度优先）
 *   5. maxEdges 边限流
 *   6. 孤立节点保留
 *   7. 遗忘状态与保留率映射
 */

import { describe, expect, it } from "vitest";
import { buildMemoryGraph } from "@/pages/options/views/memory/graph-builder";
import { generateMemoryId } from "@/services/memory/memory-store";
import { HOUR_MS } from "@/services/memory/decay";
import type { MemoryEntry, MemoryImportance } from "@/services/memory/types";

const TEST_ROLE = "graph_role";

/** 构造一条测试记忆 */
function makeEntry(
  content: string,
  overrides: Partial<MemoryEntry> = {},
): MemoryEntry {
  const now = Date.now();
  return {
    id: generateMemoryId(),
    role: TEST_ROLE,
    category: "fact",
    content,
    importance: "medium" as MemoryImportance,
    createdAt: now,
    lastAccessedAt: now,
    lastReactivatedAt: now,
    accessCount: 1,
    ...overrides,
  };
}

/** 取出所有边的端点 ID 集合 */
const collectEdgeIds = (
  edges: Array<{ data: { source: string; target: string } }>,
) => new Set(edges.flatMap((edge) => [edge.data.source, edge.data.target]));

describe("buildMemoryGraph", () => {
  it("空输入时返回空图", () => {
    const { nodes, edges } = buildMemoryGraph([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("内容为空的条目被过滤掉", () => {
    const { nodes } = buildMemoryGraph([
      makeEntry("   "),
      makeEntry("有内容的事实"),
    ]);
    expect(nodes).toHaveLength(1);
  });

  it("没有共享关键词时不产生连线", () => {
    const { nodes, edges } = buildMemoryGraph([
      makeEntry("苹果香蕉橘子"),
      makeEntry("编程语言框架"),
    ]);
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(0);
  });

  it("共享中文 bigram 的两条记忆之间产生连线", () => {
    const a = makeEntry("用户喜欢用 TypeScript 写浏览器扩展");
    const b = makeEntry("用户喜欢用 Python 写爬虫");
    const { edges } = buildMemoryGraph([a, b]);

    expect(edges).toHaveLength(1);
    expect(edges[0].data.source).toBe(a.id);
    expect(edges[0].data.target).toBe(b.id);
    // 共享「用户 / 户喜 / 喜欢 / 欢用」四个 bigram
    expect(edges[0].data.weight).toBeGreaterThanOrEqual(3);
    expect(edges[0].data.sharedTerms.length).toBeGreaterThan(0);
  });

  it("共享词占比低于 minEdgeScore 时不连边", () => {
    const entries = [
      makeEntry("用户喜欢用 TypeScript 写浏览器扩展"),
      makeEntry("用户喜欢用 Python 写爬虫"),
    ];

    // 默认阈值下有一条边
    expect(buildMemoryGraph(entries).edges).toHaveLength(1);
    // 阈值提到 0.9 后边被过滤掉
    expect(buildMemoryGraph(entries, { minEdgeScore: 0.9 }).edges).toHaveLength(
      0,
    );
  });

  it("高频噪声词（df > maxPostingSize）不参与连边", () => {
    const entries = [
      makeEntry("用户喜欢用 TypeScript"),
      makeEntry("用户喜欢用 Python"),
      makeEntry("用户喜欢用 Rust"),
      makeEntry("用户喜欢用 Go"),
    ];

    // 默认 maxPostingSize=12：四条记忆两两连边
    expect(buildMemoryGraph(entries).edges.length).toBeGreaterThan(0);
    // 收紧到 3 后，「用户喜欢用」被判为高频词，全部边消失
    expect(buildMemoryGraph(entries, { maxPostingSize: 3 }).edges).toHaveLength(
      0,
    );
  });

  it("maxNodes 限制节点数，且重要度高的优先保留", () => {
    const entries = [
      makeEntry("低重要度的记忆内容甲", { importance: "low" }),
      makeEntry("低重要度的记忆内容乙", { importance: "low" }),
      makeEntry("关键重要的记忆内容丙", { importance: "critical" }),
    ];

    const { nodes } = buildMemoryGraph(entries, { maxNodes: 1 });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.importance).toBe("critical");
  });

  it("maxEdges 限制连线数量", () => {
    const entries = [
      makeEntry("猫喜欢吃鱼"),
      makeEntry("猫喜欢吃肉"),
      makeEntry("狗喜欢跑步"),
      makeEntry("狗喜欢睡觉"),
    ];

    // minEdgeScore 0.5 只保留同组内的强关联，共 2 条边
    expect(buildMemoryGraph(entries, { minEdgeScore: 0.5 }).edges).toHaveLength(
      2,
    );
    // 再限制到 1 条
    expect(
      buildMemoryGraph(entries, { minEdgeScore: 0.5, maxEdges: 1 }).edges,
    ).toHaveLength(1);
  });

  it("孤立节点仍保留在图中", () => {
    const linked = makeEntry("猫喜欢吃鱼");
    const partner = makeEntry("猫喜欢吃肉");
    const lonely = makeEntry("独来独往的孤岛记忆");
    const { nodes, edges } = buildMemoryGraph([linked, partner, lonely]);

    const nodeIds = new Set(nodes.map((node) => node.data.id));
    expect(nodeIds.has(lonely.id)).toBe(true);
    expect(collectEdgeIds(edges).has(lonely.id)).toBe(false);
  });

  it("节点携带正确的遗忘状态与保留率", () => {
    const fresh = makeEntry("新鲜出炉的记忆");
    const ancient = makeEntry("很久以前就没人提起的记忆", {
      importance: "low",
      // 400 天前被想起过 → 低重要度记忆早已遗忘
      lastReactivatedAt: Date.now() - 400 * 24 * HOUR_MS,
    });

    const { nodes } = buildMemoryGraph([fresh, ancient]);
    const freshNode = nodes.find((node) => node.data.id === fresh.id);
    const ancientNode = nodes.find((node) => node.data.id === ancient.id);

    expect(freshNode?.data.decayState).toBe("active");
    expect(freshNode?.data.retention).toBeGreaterThan(0.99);
    expect(ancientNode?.data.decayState).toBe("forgotten");
    expect(ancientNode?.data.retention).toBeLessThan(0.2);
  });

  it("节点标签超长时被截断", () => {
    const long = makeEntry(
      "这是一条特别特别特别特别特别特别特别特别长的记忆内容用于验证标签截断",
    );
    const { nodes } = buildMemoryGraph([long]);

    expect(nodes[0].data.label.endsWith("…")).toBe(true);
    expect(nodes[0].data.label.length).toBeLessThanOrEqual(25);
    // 完整内容仍然保留，供详情展示
    expect(nodes[0].data.fullContent).toBe(long.content);
  });
});
