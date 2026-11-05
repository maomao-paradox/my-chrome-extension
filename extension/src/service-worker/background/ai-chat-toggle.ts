/**
 * @file src/service-worker/background/ai-chat-toggle.ts
 * @description AI 聊天全局开关 —— 统一门控
 *
 * 存储键：chrome.storage.local.aiChatEnabled（boolean，默认 true）
 *   - true：正常启用，主动对话 + 用户对话都走 AI
 *   - false：彻底静默，不发任何 AI 请求，不消耗 token
 *
 * 拦截点（调用本模块）：
 *   1. runtime-connections.START_AI_CONVERSATION —— 用户发起对话时
 *   2. proactive-chat.initProactiveChat —— SW 启动 / alarm 触发时
 *   3. proactive-chat.runProactiveMessage —— 主动对话 alarm 到点时
 *
 * 说明：开关只管「要不要调 AI」，不关记忆读写。关掉后记忆系统照常
 * observe / buildContext —— 只是 observe 读不到 AI 回复而已，不会脏。
 */

/** storage key：与扩展设置解耦，独立 boolean 方便单独监听变化 */
export const AI_CHAT_ENABLED_KEY = "aiChatEnabled";

/** 默认开启 —— 升级场景下不改变既有行为 */
const DEFAULT_ENABLED = true;

/**
 * 异步读取当前开关状态
 * @returns true = AI 聊天启用；false = 彻底静默
 */
export async function isAIChatEnabled(): Promise<boolean> {
    try {
        const snapshot = await chrome.storage.local.get(AI_CHAT_ENABLED_KEY);
        const raw = snapshot[AI_CHAT_ENABLED_KEY];
        // 显式 false 才关；undefined / null / 非 boolean 一律视为默认开启
        return typeof raw === "boolean" ? raw : DEFAULT_ENABLED;
    } catch {
        // storage 不可用时兜底为开启，避免误伤正常用户
        return DEFAULT_ENABLED;
    }
}

/**
 * 设置开关状态
 * @param enabled true = 启用，false = 静默
 */
export async function setAIChatEnabled(enabled: boolean): Promise<void> {
    await chrome.storage.local.set({ [AI_CHAT_ENABLED_KEY]: enabled });
}

/**
 * 监听开关变化 —— 给调用方一个 clean callback
 * @param onChange 开关值变化时触发
 * @param skipInitial true = 跳过首次的「当前值」回调（只监听后续变化）
 * @returns cleanup 函数，调用后取消监听
 */
export function onAIChatEnabledChange(
    onChange: (enabled: boolean) => void,
    skipInitial = false,
): () => void {
    if (!skipInitial) {
        // 先异步读一次初始值
        void isAIChatEnabled().then(onChange);
    }

    const listener = (
        changes: { [key: string]: chrome.storage.StorageChange },
        area: chrome.storage.AreaName,
    ) => {
        if (area !== "local") return;
        if (!(AI_CHAT_ENABLED_KEY in changes)) return;
        const { newValue } = changes[AI_CHAT_ENABLED_KEY];
        const enabled =
            typeof newValue === "boolean" ? newValue : DEFAULT_ENABLED;
        onChange(enabled);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
}
