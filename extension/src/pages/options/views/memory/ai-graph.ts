/**
 * @file ai-graph.ts
 * @description 通过侧边栏的 AI 通道（background 端口）把记忆条目抽取成知识图谱
 *
 * 链路：
 *   options 页面 ──chrome.runtime.connect("ai-conversation-*")──▶ background
 *   ──▶ stream-manager ──▶ DeepSeek / 已配置模型
 *   ──▶ 流式返回 JSON 文本 ──▶ parseGraphData()
 *
 * 生成结果按「角色 + 数据指纹」缓存在 chrome.storage.local，
 * 记忆未变化时直接复用，避免每次进入图谱视图都消耗一次模型调用。
 */

import type { MemoryEntry } from "@/services/memory";
import type { GraphData } from "@/components/ChatKnowledgeGraph/types";
import { loadAIConfig } from "@/service-worker/chrome-api";
import { buildGraphFingerprint, buildGraphPrompt, parseGraphData } from "./graph-schema";

/** 缓存 key 前缀（按角色隔离） */
const CACHE_PREFIX = "ai_memory_graph_cache::";

/**
 * 图谱抽取使用的角色标识。
 * 刻意不复用真实角色，避免抽取请求的 JSON 回复被写进用户对话记忆。
 */
const GRAPH_EXTRACTOR_ROLE = "graph_extractor";

/** 单次抽取的最长等待时间 */
const REQUEST_TIMEOUT_MS = 90_000;

/** 缓存的存储结构 */
export interface GraphCacheRecord {
  /** 生成时的数据指纹 */
  fingerprint: string;
  /** 生成的图谱数据 */
  data: GraphData;
  /** 生成时间戳 */
  generatedAt: number;
}

/** 读取角色对应的图谱缓存 */
export async function readGraphCache(
  role: string,
): Promise<GraphCacheRecord | null> {
  try {
    const key = `${CACHE_PREFIX}${role}`;
    const bag = await chrome.storage.local.get(key);
    const record = bag?.[key] as GraphCacheRecord | undefined;
    if (!record || typeof record.fingerprint !== "string") return null;
    if (!record.data || !Array.isArray(record.data.nodes)) return null;
    return record;
  } catch (error) {
    console.warn("[ai-graph] 读取缓存失败:", error);
    return null;
  }
}

/** 写入角色对应的图谱缓存 */
export async function writeGraphCache(
  role: string,
  fingerprint: string,
  data: GraphData,
): Promise<void> {
  try {
    const key = `${CACHE_PREFIX}${role}`;
    await chrome.storage.local.set({
      [key]: { fingerprint, data, generatedAt: Date.now() } satisfies GraphCacheRecord,
    });
  } catch (error) {
    console.warn("[ai-graph] 写入缓存失败:", error);
  }
}

/**
 * 调用 AI 通道抽取图谱数据
 * @param role 记忆归属角色（仅用于提示词与标题）
 * @param entries 该角色的全部记忆条目
 * @returns 解析后的图谱数据
 */
export async function requestGraphData(
  role: string,
  entries: MemoryEntry[],
): Promise<GraphData> {
  if (typeof chrome === "undefined" || !chrome.runtime?.connect) {
    throw new Error("当前环境未连接扩展后台，无法生成知识图谱");
  }

  // 复用已保存的模型配置（DeepSeek 登录态或 OpenAI 兼容接口）
  const config = await loadAIConfig().catch(() => null);
  const prompt = buildGraphPrompt(role, entries);
  const messageId = `kg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const port = chrome.runtime.connect({
    name: `ai-conversation-${messageId}`,
  });

  return new Promise<GraphData>((resolve, reject) => {
    let buffer = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        port.disconnect();
      } catch {
        // 端口可能已断开，忽略
      }
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("知识图谱生成超时，请稍后重试")));
    }, REQUEST_TIMEOUT_MS);

    port.onMessage.addListener((message: any) => {
      if (message?.payload?.messageId !== messageId) return;

      if (message.type === "AI_CONVERSATION_STREAM_DATA") {
        buffer += message.payload.content || "";
        return;
      }

      if (message.type === "AI_CONVERSATION_COMPLETE") {
        finish(() => {
          try {
            resolve(parseGraphData(buffer, `${role} 的聊天知识图谱`));
          } catch (error) {
            reject(
              error instanceof Error
                ? error
                : new Error("模型返回的知识图谱数据无法解析"),
            );
          }
        });
        return;
      }

      if (message.type === "AI_CONVERSATION_ERROR") {
        finish(() =>
          reject(new Error(message.payload?.error || "AI 生成知识图谱失败")),
        );
      }
    });

    port.onDisconnect.addListener(() => {
      finish(() => reject(new Error("AI 通道已断开，请重试")));
    });

    port.postMessage({
      type: "START_AI_CONVERSATION",
      payload: {
        prompt,
        messageId,
        provider: config?.provider,
        model: config?.modelId,
        apiKey: config?.apiKey,
        apiBaseUrl: config?.apiBaseUrl,
        role: GRAPH_EXTRACTOR_ROLE,
        systemPrompt:
          "你是严谨的知识图谱抽取器，只输出合法 JSON，不输出任何解释文字。",
      },
    });
  });
}

/** 图谱数据指纹 —— 对外暴露，便于 UI 判断缓存是否命中 */
export { buildGraphFingerprint };
