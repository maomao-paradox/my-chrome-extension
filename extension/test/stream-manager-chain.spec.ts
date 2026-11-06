import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildContext: vi.fn(),
  completeChatFlow: vi.fn(),
  executeLocalMcpTool: vi.fn(),
}));

vi.mock("@/services/memory", () => ({
  getMemoryService: () => ({
    buildContext: mocks.buildContext,
    observe: vi.fn(),
  }),
  isFunctionalRole: () => false,
}));

vi.mock("@/service-worker/deepseek", () => ({
  completeChatFlow: mocks.completeChatFlow,
}));

vi.mock("@/service-worker/background/mcp-tools", () => ({
  LOCAL_MCP_TOOLS: [],
  executeLocalMcpTool: mocks.executeLocalMcpTool,
  isLocalMcpTool: (name: string) =>
    [
      "set_affection",
      "set_next_proactive_interval",
      "get_meme",
    ].includes(name),
  shouldReturnToolResultToModel: (name: string) =>
    name !== "set_affection" && name !== "set_next_proactive_interval",
}));

import { StreamManager } from "@/service-worker/background/stream-manager";

type CompletionCallback = (result: unknown) => void;
type DataCallback = (content: string) => void;

const stateToolCalls = [
  {
    id: "affection-call",
    name: "set_affection",
    args: { value: 52 },
  },
  {
    id: "interval-call",
    name: "set_next_proactive_interval",
    args: { minutes: 5 },
  },
];

function createPort() {
  return {
    postMessage: vi.fn(),
    onDisconnect: { addListener: vi.fn() },
  } as unknown as chrome.runtime.Port;
}

function setupCompletions(
  completions: Array<{ text: string; functionCalls: typeof stateToolCalls }>,
) {
  mocks.completeChatFlow.mockImplementation(
    async (...args: unknown[]) => {
      const callbacks = args[2] as {
        onComplete?: CompletionCallback;
        onData?: DataCallback;
      };
      const completion = completions.shift();
      if (!completion) throw new Error("Unexpected model continuation");
      if (completion.text) callbacks.onData?.(completion.text);
      callbacks.onComplete?.(completion);
    },
  );
}

async function waitForComplete(port: chrome.runtime.Port) {
  await vi.waitFor(() =>
    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "AI_CONVERSATION_COMPLETE" }),
    ),
  );
}

beforeEach(() => {
  mocks.buildContext.mockReset().mockResolvedValue({ assembledContext: "" });
  mocks.completeChatFlow.mockReset();
  mocks.executeLocalMcpTool.mockReset().mockImplementation(
    async (name: string, args: Record<string, unknown>) => ({
      jsonrpc: "2.0",
      id: `result-${name}`,
      result: { ok: true, ...args },
    }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("StreamManager 工具续轮", () => {
  it("只调用状态工具时执行后直接结束，不把结果发给模型", async () => {
    setupCompletions([{ text: "", functionCalls: stateToolCalls }]);
    const port = createPort();

    new StreamManager().startStream(
      port,
      "更新状态",
      "message-1",
      "miku",
      "deepseek",
      undefined,
      undefined,
      undefined,
      undefined,
      { enableLocalMcpTools: true },
    );

    await waitForComplete(port);

    expect(mocks.executeLocalMcpTool).toHaveBeenCalledTimes(2);
    expect(mocks.completeChatFlow).toHaveBeenCalledTimes(1);
    expect(port.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "AI_CONVERSATION_CONTINUING" }),
    );
    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AI_CONVERSATION_COMPLETE",
        payload: expect.objectContaining({ skipPersist: true }),
      }),
    );
  });

  it("其他工具同时调用时只把其他工具结果续交给模型", async () => {
    const calls = [
      ...stateToolCalls,
      { id: "meme-call", name: "get_meme", args: { description: "猫猫" } },
    ];
    setupCompletions([
      { text: "", functionCalls: calls },
      { text: "表情包找到了。", functionCalls: [] },
    ]);
    const port = createPort();

    new StreamManager().startStream(
      port,
      "给我一个表情包",
      "message-2",
      "miku",
      "deepseek",
      undefined,
      undefined,
      undefined,
      undefined,
      { enableLocalMcpTools: true },
    );

    await waitForComplete(port);

    expect(mocks.completeChatFlow).toHaveBeenCalledTimes(2);
    const continuationPrompt = mocks.completeChatFlow.mock.calls[1][0] as string;
    expect(continuationPrompt).toContain("[TOOL RESULTS]");
    expect(continuationPrompt).toContain("get_meme");
    expect(continuationPrompt).not.toContain("set_affection");
    expect(continuationPrompt).not.toContain("set_next_proactive_interval");
  });
});
