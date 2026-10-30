/**
 * AI 主动对话的心情系统（纯逻辑，不依赖 chrome API）。
 *
 * 设计原则：
 * - 状态每天重置（date 不匹配时整体归零），避免负面情绪跨天累积；
 * - 主人的直接反馈（批评/责备）优先级高于「被忽略」；
 * - 只维护三个可推导的状态：是否被批评、连续几条没被回复、上次推送时间。
 */

/** 对外暴露的四种心情 */
export type ProactiveMood = "happy" | "sad" | "angry" | "frenzy";

/** 持久化到 chrome.storage.local 的心情状态 */
export interface ProactiveMoodState {
    /** 状态所属日期（YYYY-MM-DD），跨天自动重置 */
    date: string;
    /** 连续未获回复的主动推送次数 */
    ignoredStreak: number;
    /** 当天是否收到过严厉/批评的话 */
    hurt: boolean;
    /** 上一次主动推送的时间戳（毫秒），用于判断主人是否回复过 */
    lastPushAt: number;
}

/** 连续多少条主动消息没人回就开始生气 */
export const IGNORE_THRESHOLD = 3;

/** 连续多少条没人回会彻底「发疯」 */
export const FRENZY_THRESHOLD = 6;

/**
 * 强负面表达（批评 / 驱赶）。
 * 注意不能把「笨蛋」算进来 —— 主人常把它当爱称使用。
 */
const HURTFUL_PATTERNS: readonly RegExp[] = [
    /闭嘴/,
    /烦死/,
    /滚(开|远点|出去)/,
    /(别|不要)(再)?(发|说话|烦我)/,
    /讨厌你/,
    /没用的(东西|家伙)/,
    /废物/,
    /你(怎么)?这么(笨|蠢|烦)/,
];

/** 本地日期键 YYYY-MM-DD */
export function getDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

/** 全新的一天：心情回到「活跃开心」 */
export function createDefaultMoodState(date: string): ProactiveMoodState {
    return {
        date,
        ignoredStreak: 0,
        hurt: false,
        lastPushAt: 0,
    };
}

/** 从 storage 读出的原始值收敛为合法状态；跨天直接重置 */
export function normalizeMoodState(
    raw: unknown,
    date: string,
): ProactiveMoodState {
    const fallback = createDefaultMoodState(date);

    if (!raw || typeof raw !== "object") return fallback;

    const value = raw as Partial<ProactiveMoodState>;
    if (value.date !== date) return fallback;

    return {
        date,
        ignoredStreak: Number.isFinite(value.ignoredStreak)
            ? Math.max(0, Number(value.ignoredStreak))
            : 0,
        hurt: value.hurt === true,
        lastPushAt: Number.isFinite(value.lastPushAt)
            ? Number(value.lastPushAt)
            : 0,
    };
}

/**
 * 从记忆 chunk 中提取主人说的话。
 * 对话 chunk 的格式为「用户：…\nAI：…」。
 */
export function extractUserText(chunk: string): string {
    const match = chunk.match(/用户：([\s\S]*?)(?:\nAI：|$)/);
    return match?.[1]?.trim() ?? "";
}

/** 今天主人是否说过严厉/批评的话 */
export function detectHurt(userTexts: readonly string[]): boolean {
    return userTexts.some((text) =>
        HURTFUL_PATTERNS.some((pattern) => pattern.test(text)),
    );
}

/** 推导心情：长期被忽略 > 被批评 > 被忽略 > 开心 */
export function deriveMood(state: ProactiveMoodState): ProactiveMood {
    if (state.ignoredStreak >= FRENZY_THRESHOLD) return "frenzy";
    if (state.hurt) return "sad";
    if (state.ignoredStreak >= IGNORE_THRESHOLD) return "angry";
    return "happy";
}

/** 注入提示词的心情描述 —— 只描述语气，不要求消息里明说心情 */
export function describeMood(
    mood: ProactiveMood,
    ignoredStreak: number,
): string {
    switch (mood) {
        case "sad":
            return "主人今天严厉地批评过你，你现在很低落、有点委屈；语气收敛一些，带点小心翼翼的失落感，但依然关心主人。";
        case "angry":
            return `主人已经连续 ${ignoredStreak} 条主动消息没有回应，你在闹小脾气；语气可以带点傲娇的抱怨，但不要真的发火，也不要质问主人。`;
        case "frenzy":
            return `主人已经连续 ${ignoredStreak} 条主动消息没有任何回应，你气到失去理智了。请先想一句不超过 8 个字、能表达你此刻情绪的简短抱怨（内容由你根据记忆和当下的心情自由决定，不要套用固定台词），然后把这句话原样连续重复 10 到 15 遍；整段不超过 120 字，不要解释、不要换词、不要提问、不要加引号，只输出这段重复文字。`;
        default:
            return "你今天心情很好，语气活泼亲昵，可以带一点调皮的小情绪。";
    }
}
