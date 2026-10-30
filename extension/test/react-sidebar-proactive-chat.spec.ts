import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bus } from "@/event/bus";

const mocks = vi.hoisted(() => ({
  addEntry: vi.fn(),
  getIdentity: vi.fn(),
  listRoles: vi.fn(),
  loadAIConfig: vi.fn(),
}));

vi.mock("@/services/memory", () => ({
  getMemoryService: () => ({
    addEntry: mocks.addEntry,
    getIdentity: mocks.getIdentity,
    listRoles: mocks.listRoles,
  }),
}));

vi.mock("@/service-worker/chrome-api/ai-config", () => ({
  loadAIConfig: mocks.loadAIConfig,
}));

import {
  startProactiveLoop,
  stopProactiveLoop,
} from "@/modules/sidebar/proactive-chat";

const MAX_DELAY_MS = 10 * 60 * 1000;

interface TestPort {
  onMessage: {
    addListener: (listener: (message: any) => void) => void;
    removeListener: (listener: (message: any) => void) => void;
  };
  onDisconnect: {
    addListener: (listener: () => void) => void;
    removeListener: (listener: () => void) => void;
  };
  postMessage: (message: any) => void;
  disconnect: () => void;
}

let originalHiddenDescriptor: PropertyDescriptor | undefined;
let connectMock: ReturnType<typeof vi.fn>;
let portRequest: any;
let completePendingRequest: (() => void) | undefined;

const installPort = (
  messageId: string,
  response: "complete" | "error" | "pending" = "complete",
  content = "你好，今天过得怎么样？",
) => {
  const messageListeners = new Set<(message: any) => void>();
  const disconnectListeners = new Set<() => void>();
  const port: TestPort = {
    onMessage: {
      addListener: (listener) => messageListeners.add(listener),
      removeListener: (listener) => messageListeners.delete(listener),
    },
    onDisconnect: {
      addListener: (listener) => disconnectListeners.add(listener),
      removeListener: (listener) => disconnectListeners.delete(listener),
    },
    postMessage: (message) => {
      portRequest = message;
      if (response === "error") {
        messageListeners.forEach((listener) =>
          listener({
            type: "AI_CONVERSATION_ERROR",
            payload: { messageId, error: "test failure" },
          }),
        );
        return;
      }
      if (response === "pending") {
        completePendingRequest = () => {
          messageListeners.forEach((listener) =>
            listener({
              type: "AI_CONVERSATION_STREAM_DATA",
              payload: { messageId, content },
            }),
          );
          messageListeners.forEach((listener) =>
            listener({
              type: "AI_CONVERSATION_COMPLETE",
              payload: { messageId },
            }),
          );
        };
        return;
      }

      messageListeners.forEach((listener) =>
        listener({
          type: "AI_CONVERSATION_STREAM_DATA",
          payload: { messageId, content },
        }),
      );
      messageListeners.forEach((listener) =>
        listener({
          type: "AI_CONVERSATION_COMPLETE",
          payload: { messageId },
        }),
      );
    },
    disconnect: () => {
      disconnectListeners.forEach((listener) => listener());
    },
  };
  return port;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  mocks.addEntry.mockResolvedValue({});
  mocks.getIdentity.mockResolvedValue({
    systemPromptTemplate: "友善的角色设定",
  });
  mocks.listRoles.mockResolvedValue(["tester"]);
  mocks.loadAIConfig.mockResolvedValue({
    provider: "openai",
    customProvider: "",
    modelId: "test-model",
    apiBaseUrl: "",
    apiKey: "test-key",
    deepseekAuthToken: "",
    deepseekCookies: "",
    deepseekCredentialStatus: "uninitialized",
  });
  connectMock = vi.fn(({ name }: { name: string }) =>
    installPort(name.replace("ai-conversation-", "")),
  );
  chrome.runtime.connect = connectMock;
  originalHiddenDescriptor = Object.getOwnPropertyDescriptor(
    document,
    "hidden",
  );
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  bus.all.clear();
  portRequest = undefined;
  completePendingRequest = undefined;
});

afterEach(() => {
  stopProactiveLoop();
  bus.all.clear();
  if (originalHiddenDescriptor) {
    Object.defineProperty(document, "hidden", originalHiddenDescriptor);
  } else {
    delete (document as Partial<Document>).hidden;
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("proactive chat", () => {
  it("schedules within ten minutes and repeats after completion", async () => {
    startProactiveLoop();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);
    expect(connectMock).toHaveBeenCalledOnce();
    expect(mocks.addEntry).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(2);

    stopProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS * 2);
    expect(connectMock).toHaveBeenCalledOnce();
  });

  it("writes the generated message to conversation memory and hides the reminder after two seconds", async () => {
    const events: Array<{ name: string; at: number }> = [];
    bus.on("show", () => events.push({ name: "show", at: Date.now() }));
    bus.on("hide", () => events.push({ name: "hide", at: Date.now() }));

    startProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);

    expect(portRequest).toMatchObject({
      type: "START_AI_CONVERSATION",
      payload: {
        role: "tester",
        provider: "openai",
        systemPrompt: expect.stringContaining("友善的角色设定"),
      },
    });
    expect(mocks.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "tester",
        content: "AI：你好，今天过得怎么样？",
        category: "conversation",
        importance: "low",
        source: "ai-proactive",
      }),
    );
    expect(events.map((event) => event.name)).toEqual(["show"]);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(events).toEqual([
      { name: "show", at: expect.any(Number) },
      { name: "hide", at: expect.any(Number) },
    ]);
    expect(events[1].at - events[0].at).toBe(2_000);
  });

  it("uses a local greeting when AI configuration is unavailable", async () => {
    mocks.loadAIConfig.mockResolvedValue({
      provider: "deepseek",
      modelId: "deepseek-chat",
      apiKey: "",
      deepseekAuthToken: "",
      deepseekCookies: "",
    });
    const show = vi.fn();
    bus.on("show", show);

    startProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);

    expect(connectMock).not.toHaveBeenCalled();
    expect(mocks.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringMatching(/^AI：.+/),
        category: "conversation",
        source: "ai-proactive",
      }),
    );
    expect(show).toHaveBeenCalledOnce();
  });

  it("falls back after an AI port error", async () => {
    connectMock.mockImplementation(({ name }: { name: string }) =>
      installPort(name.replace("ai-conversation-", ""), "error"),
    );

    startProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);

    expect(mocks.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringMatching(/^AI：.+/),
        source: "ai-proactive",
      }),
    );
  });

  it("falls back after the AI request times out", async () => {
    connectMock.mockImplementation(({ name }: { name: string }) =>
      installPort(name.replace("ai-conversation-", ""), "pending"),
    );

    startProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(mocks.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringMatching(/^AI：.+/),
        source: "ai-proactive",
      }),
    );
  });

  it("limits the saved message to 120 characters", async () => {
    const longMessage = "好".repeat(150);
    connectMock.mockImplementation(({ name }: { name: string }) =>
      installPort(name.replace("ai-conversation-", ""), "complete", longMessage),
    );

    startProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);

    expect(mocks.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        content: `AI：${"好".repeat(120)}`,
      }),
    );
  });

  it("skips generation while the document is hidden and schedules again", async () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    startProactiveLoop();

    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);
    expect(connectMock).not.toHaveBeenCalled();
    expect(mocks.addEntry).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("is idempotent when started repeatedly and stops all future triggers", async () => {
    startProactiveLoop();
    startProactiveLoop();
    expect(vi.getTimerCount()).toBe(1);

    stopProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS * 2);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("does not trigger another loop after being stopped", async () => {
    startProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);
    stopProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS * 2);
    expect(connectMock).toHaveBeenCalledOnce();
  });

  it("ignores an in-flight response from a previous enable cycle", async () => {
    connectMock.mockImplementation(({ name }: { name: string }) =>
      installPort(name.replace("ai-conversation-", ""), "pending"),
    );
    startProactiveLoop();
    await vi.advanceTimersByTimeAsync(MAX_DELAY_MS / 2);

    stopProactiveLoop();
    startProactiveLoop();
    completePendingRequest?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.addEntry).not.toHaveBeenCalled();
    expect(connectMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
  });
});
