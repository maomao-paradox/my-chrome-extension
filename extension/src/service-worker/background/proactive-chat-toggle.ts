/**
 * @file src/service-worker/background/proactive-chat-toggle.ts
 * @description AI 自主式聊天开关 —— 控制是否允许 AI 主动发起消息
 *
 * 存储键：chrome.storage.local.aiProactiveChatEnabled（boolean，默认 true）
 *   - true：AI 可以主动发消息（proactive-chat 正常调度）
 *   - false：AI 只能被动回应，不主动发消息
 *
 * 与 ai-chat-toggle 的区别：
 *   - aiChatEnabled 是「总闸」，关了彻底不用 AI
 *   - aiProactiveChatEnabled 是「主动聊天闸」，关了 AI 仍可以被动聊天
 */

export const AI_PROACTIVE_CHAT_ENABLED_KEY = "aiProactiveChatEnabled";

/** 默认开启 —— 保持现有主动聊天行为 */
const DEFAULT_ENABLED = true;

/**
 * 异步读取当前开关状态
 * @returns true = 允许 AI 主动发消息；false = 只能被动回应
 */
export async function isAIProactiveChatEnabled(): Promise<boolean> {
  try {
    const snapshot = await chrome.storage.local.get(
      AI_PROACTIVE_CHAT_ENABLED_KEY,
    );
    const raw = snapshot[AI_PROACTIVE_CHAT_ENABLED_KEY];
    return typeof raw === "boolean" ? raw : DEFAULT_ENABLED;
  } catch {
    return DEFAULT_ENABLED;
  }
}

/**
 * 设置开关状态
 * @param enabled true = 允许主动聊天，false = 禁止主动聊天
 */
export async function setAIProactiveChatEnabled(
  enabled: boolean,
): Promise<void> {
  await chrome.storage.local.set({ [AI_PROACTIVE_CHAT_ENABLED_KEY]: enabled });
}

/**
 * 监听开关变化
 * @param onChange 开关值变化时触发
 * @param skipInitial true = 跳过首次的「当前值」回调
 * @returns cleanup 函数
 */
export function onAIProactiveChatEnabledChange(
  onChange: (enabled: boolean) => void,
  skipInitial = false,
): () => void {
  if (!skipInitial) {
    void isAIProactiveChatEnabled().then(onChange);
  }

  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== "local") return;
    if (!(AI_PROACTIVE_CHAT_ENABLED_KEY in changes)) return;
    const { newValue } = changes[AI_PROACTIVE_CHAT_ENABLED_KEY];
    const enabled =
      typeof newValue === "boolean" ? newValue : DEFAULT_ENABLED;
    onChange(enabled);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
