import type { DevToolsPortManager } from "./devtools-port-manager";
import type { StreamManager } from "./stream-manager";
import type { ChatHistoryMessage } from "@/types/web-mcp";
import { uploadFile } from "../deepseek";
import { getMemoryService } from "@/services/memory";
import {
  deriveMood,
  getDateKey,
  getIgnoreProbability,
  shouldTrigger,
  type ProactiveMood,
} from "./proactive-mood";
import { loadMoodState } from "./proactive-chat";
import { isAIChatEnabled } from "./ai-chat-toggle";
import { tryHandleSlashCommand } from "./slash-commands";

/**
 * 把 dataURL 数组上传成 file_id 数组 —— 让 AI "看到"用户发的图
 * —— 参考 proactive-chat.ts 的截图上传流程
 */
async function uploadImageDataUrls(dataUrls: string[]): Promise<string[]> {
  const fileIds: string[] = [];
  for (const dataUrl of dataUrls) {
    try {
      const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|gif|webp));base64,(.+)$/);
      if (!match) {
        console.warn("[runtime] 无效的图片 dataURL，跳过:", dataUrl.slice(0, 40));
        continue;
      }
      const contentType = match[1];
      const ext = match[2] === "jpeg" ? "jpg" : match[2];
      const fileName = `user-image-${Date.now()}.${ext}`;
      const binary = Uint8Array.from(atob(match[3]), (c) => c.charCodeAt(0));
      const fileId = await uploadFile(binary, contentType, fileName);
      fileIds.push(fileId);
    } catch (err) {
      console.warn("[runtime] 用户图片上传失败，跳过:", err);
    }
  }
  return fileIds;
}

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
      createdAt,
      role,
      provider,
      model,
      apiKey,
      apiBaseUrl,
      systemPrompt,
      targetTabId,
      messages,
      tools,
      enableLocalMcpTools,
      imageDataUrls,
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
     * AI 聊天全局开关（最高优先级门控）
     *   关掉时：不调 AI、不消耗 token，只给前端发友好提示然后断连。
     *   记忆写入跳过 —— 因为 observe 需要 AI 回复才有用，空写无意义。
     * ══════════════════════════════════════════════════════════════════ */
    if (!(await isAIChatEnabled())) {
      maLogger.info("[StreamManager] AI 聊天已被全局开关关闭，拒绝本次请求");
      port.postMessage({
        type: "AI_CONVERSATION_ERROR",
        payload: {
          message: "AI 聊天已关闭，请在扩展设置中开启",
          code: "ai_chat_disabled",
        },
      });
      port.disconnect();
      return;
    }

    /* ══════════════════════════════════════════════════════════════════
     * 斜杠指令拦截 —— AI 请求之前的本地命令
     *   成功拦截后：发确认消息 → 断连；不走 AI、不 observe、不写记忆。
     *   失败（非指令）：放行，继续走心情忽略 → startStream 链路。
     * ══════════════════════════════════════════════════════════════════ */
    const slashResult = await tryHandleSlashCommand(prompt, role);
    if (slashResult.handled) {
      maLogger.info(
        "[StreamManager] 斜杠指令拦截 ——",
        prompt.trim(),
      );
      port.postMessage({
        type: "AI_CONVERSATION_STREAM_DATA",
        payload: { messageId, content: slashResult.reply },
      });
      port.postMessage({ type: "AI_CONVERSATION_COMPLETE" });
      port.disconnect();
      return;
    }

    /* ══════════════════════════════════════════════════════════════════
     * 心情驱动的忽略判断（前置拦截层）
     *   AI 自己闹脾气（ignoredStreak）时忽略概率被刻意压低：
     *   angry=10% / frenzy=20%，主人主动发问优先级更高。
     *   只有被真批评过（hurt → sad）才可能真的不敢说话（30%）。
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
              createdAt: typeof createdAt === "number" ? createdAt : Date.now(),
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

    /* ══════════════════════════════════════════════════════════════════
     * 用户图片上传 —— 把 dataURL 数组转成 file_id 数组，让 AI "看到"用户发的图
     * 参考 proactive-chat.ts 的截图上传流程
     * 上传失败静默降级为无图，不阻塞主对话流程
     * ══════════════════════════════════════════════════════════════════ */
    let fileIds: string[] | undefined;
    try {
      if (Array.isArray(imageDataUrls) && imageDataUrls.length > 0) {
        fileIds = await uploadImageDataUrls(imageDataUrls);
        console.log("[runtime] 用户图片上传成功:", fileIds.length, "张");
      }
    } catch (uploadErr) {
      console.warn("[runtime] 用户图片上传异常，降级为无图:", uploadErr);
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
        enableLocalMcpTools: enableLocalMcpTools === true,
        fileIds, // ← 用户上传的图片 file_id 列表
      },
      mood, // ← 顺手传进 StreamManager，避免重复读 storage
      typeof createdAt === "number" ? createdAt : undefined,
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
