/**
 * @file react-memory-graph-schema.spec.ts
 * @description 知识图谱数据契约层单测：提示词构建、指纹计算、模型输出解析容错
 */

import { describe, it, expect } from "vitest";
import {
  buildGraphFingerprint,
  buildGraphPrompt,
  parseGraphData,
} from "@/pages/options/views/memory/graph-schema";
import type { MemoryEntry } from "@/services/memory";

/** 构造一条测试记忆 */
function makeEntry(
  id: string,
  content: string,
  overrides: Partial<MemoryEntry> = {},
): MemoryEntry {
  return {
    id,
    role: "vivy_catgirl",
    category: "conversation",
    content,
    importance: "medium",
    createdAt: 1000,
    lastAccessedAt: 1000,
    accessCount: 1,
    ...overrides,
  };
}

describe("graph-schema", () => {
  it("parseGraphData 兼容代码围栏，并丢弃悬空/自环的边", () => {
    const raw = [
      "```json",
      JSON.stringify({
        nodes: [
          { id: "vivy", label: "薇薇", type: "role", desc: "猫娘助手" },
          { id: "petting", label: "摸头", type: "unknown-type" },
          { id: "vivy", label: "重复节点", type: "role" },
        ],
        edges: [
          { source: "vivy", target: "petting", label: "喜欢" },
          { source: "vivy", target: "ghost", label: "悬空" },
          { source: "vivy", target: "vivy", label: "自环" },
        ],
      }),
      "```",
    ].join("\n");

    const data = parseGraphData(raw, "测试图谱");

    // 重复 id 只保留首个
    expect(data.nodes).toHaveLength(2);
    // 非法类型降级为 custom
    expect(data.nodes[1].type).toBe("custom");
    // 只有两端都存在的边被保留
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0]).toMatchObject({ source: "vivy", target: "petting" });
    expect(data.title).toBe("测试图谱");
  });

  it("parseGraphData 在返回非 JSON 时抛错", () => {
    expect(() => parseGraphData("抱歉，我无法完成这个任务")).toThrow(
      /JSON/,
    );
  });

  it("buildGraphPrompt 包含条目内容并在超长时截断", () => {
    const entries = [
      makeEntry("a", "用户喜欢摸头", { importance: "critical" }),
      makeEntry("b", "用户今天聊到要早点休息", { importance: "low" }),
    ];

    const prompt = buildGraphPrompt("vivy_catgirl", entries, 40);

    expect(prompt).toContain("当前角色：vivy_catgirl");
    // critical 优先进入提示词
    expect(prompt).toContain("用户喜欢摸头");
    expect(prompt).toContain("截断");
  });

  it("buildGraphFingerprint 随记忆变化而变，同一批数据保持稳定", () => {
    const entries = [makeEntry("a", "x"), makeEntry("b", "y")];
    const first = buildGraphFingerprint("vivy_catgirl", entries);
    const second = buildGraphFingerprint("vivy_catgirl", entries);

    expect(first).toBe(second);

    const changed = [
      ...entries,
      makeEntry("c", "新增记忆", { createdAt: 2000, lastAccessedAt: 2000 }),
    ];
    expect(buildGraphFingerprint("vivy_catgirl", changed)).not.toBe(first);

    expect(buildGraphFingerprint("vivy_catgirl", [])).toBe(
      "vivy_catgirl|empty",
    );
  });
});
