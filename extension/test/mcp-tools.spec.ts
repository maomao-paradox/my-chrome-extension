import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addEntry: vi.fn(),
  scheduleProactiveMessageIn: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock("@/services/memory", () => ({
  getMemoryService: () => ({ addEntry: mocks.addEntry }),
}));

vi.mock("@/service-worker/background/proactive-chat", () => ({
  scheduleProactiveMessageIn: mocks.scheduleProactiveMessageIn,
}));

vi.mock("@/service-worker/deepseek", () => ({
  uploadFile: mocks.uploadFile,
}));

import { executeLocalMcpTool, GET_MEME } from "@/service-worker/background/mcp-tools";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("内置 MCP 工具", () => {
  it("获取表情包时不单独写入记忆", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          '<img src="https://gpic.code-nav.cn/memecub/public/f0vfyg38cio3.gif">',
      }),
    );

    const response = await executeLocalMcpTool(
      GET_MEME,
      { description: "猫猫委屈" },
      { role: "miku" },
    );

    expect(response).toMatchObject({
      result: {
        ok: true,
        description: "猫猫委屈",
        imageUrl:
          "https://gpic.code-nav.cn/memecub/public/f0vfyg38cio3.gif",
      },
    });
    expect(mocks.addEntry).not.toHaveBeenCalled();
  });
});
