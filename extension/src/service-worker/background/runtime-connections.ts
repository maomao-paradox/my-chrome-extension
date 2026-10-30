import type { DevToolsPortManager } from "./devtools-port-manager";
import type { StreamManager } from "./stream-manager";
import type { ChatHistoryMessage } from "@/types/web-mcp";
import { getMemoryService } from "@/services/memory";
import {
  deriveMood,
  getDateKey,
  getIgnoreProbability,
  type ProactiveMood,
} from "./proactive-mood";
import { shouldTrigger } from "./chat-chain";
import { loadMoodState } from "./proactive-chat";

interface RuntimeConnectionManagers {
  streamManager: StreamManager;
  devToolsPortManager: DevToolsPortManager;
}

export function initRuntimeConnectionListener({
  streamManager,
  devToolsPortManager,
}: RuntimeConnectionManagers): void {
  chrome.runtime.onConnect.addListener((port) => {
    console.log("收到端口连接:", port.name);

    if (port.name.startsWith("ai-conversation-")) {
      registerAiConversationPort(port, streamManager);
      return;
    }

    if (port.name.startsWith("devtools-")) {
      registerDevToolsPort(port, devToolsPortManager);
    }
  });
}

function registerAiConversationPort(
  port: chrome.runtime.Port,
  streamManager: StreamManager,
): void {
  const messageId = port.name.replace("ai-conversation-", "");

  port.onMessage.addListener(async (message) => {
    if (message.type !== "START_AI_CONVERSATION") {
      return;
    }

    const {
      prompt,
      role,
      provider,
      model,
      apiKey,
      apiBaseUrl,
      systemPrompt,
      targetTabId,
      messages,
      tools,
    } = message.payload;

    console.log(
      "收到开始AI对话请求:",
      messageId,
      prompt,
      "角色:",
      role,
      "提供商:",
      provider,
      "模型:",
      model,
    );
    const resolvedTargetTabId =
      typeof targetTabId === "number" ? targetTabId : port.sender?.tab?.id;

    /* ══════════════════════════════════════════════════════════════════
     * 心情驱动的忽略判断（前置拦截层）
     *   在进入 StreamManager 之前，先掷骰决定要不要回复。
     *   happy 永远回复；sad/angry 有概率不理；frenzy 70% 都懒得理。
     *   命中忽略时：照样把用户消息落记忆（方便后续观察学习），
     *   但不进 completeChatFlow —— 省掉整次 AI 调用的 token。
     * ══════════════════════════════════════════════════════════════════ */

    // 读取心情状态 —— 这是整个链路唯一一次读 mood，读完顺手传给 startStream
    let mood: ProactiveMood | undefined;
    try {
      const dateKey = getDateKey(new Date());
      const moodState = await loadMoodState(dateKey);
      mood = deriveMood(moodState);

      const ignoreProb = getIgnoreProbability(mood);
      if (shouldTrigger(ignoreProb)) {
        // ✅ 命中忽略：只存用户消息，不调 AI
        maLogger.info(
          "[StreamManager] 心情驱动忽略 ——",
          `mood=${mood}, ignoreProb=${(ignoreProb * 100).toFixed(0)}%`,
        );

        try {
          const memoryService = getMemoryService();
          await memoryService.addEntry({
            role,
            content: `用户：${prompt}`,
            category: "conversation",
            importance: "medium",
            source: "ai-ignored",
          });
        } catch (persistError) {
          maLogger.warn("[StreamManager] 忽略路径落库失败:", persistError);
        }

        port.postMessage({ type: "AI_CONVERSATION_IGNORED" });
        port.disconnect();
        return;
      }
    } catch (moodError) {
      // 心情读取失败不阻塞主流程 —— 降级为正常对话（不忽略）
      maLogger.warn("[StreamManager] 心情读取失败，降级为正常对话:", moodError);
      mood = undefined;
    }

    streamManager.startStream(
      port,
      prompt,
      messageId,
      role,
      provider,
      model,
      apiKey,
      apiBaseUrl,
      systemPrompt,
      {
        messages: messages as ChatHistoryMessage[] | undefined,
        tools,
        targetTabId: resolvedTargetTabId,
      },
      mood, // ← 顺手传进 StreamManager，避免重复读 storage
    );
  });
}

function registerDevToolsPort(
  port: chrome.runtime.Port,
  devToolsPortManager: DevToolsPortManager,
): void {
  const tabIdStr = port.name.replace("devtools-", "");
  const tabId = parseInt(tabIdStr, 10);

  if (!Number.isNaN(tabId)) {
    devToolsPortManager.registerConnection(tabId, port);
    return;
  }

  console.error("无效的开发者工具连接名称:", port.name);
}
