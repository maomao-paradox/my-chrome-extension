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

/**
 * 心情状态在 chrome.storage.local 中的存储键。
 * 放在纯逻辑模块里，sidebar（content script）也能安全引用，
 * 不必为了一个常量去 import 带 chrome API 的后台模块。
 */
export const MOOD_STATE_KEY = "proactive_chat_mood_state";

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
            return "主人刚刚严厉地批评过你，你现在很低落、有点委屈；语气收敛一些，带点小心翼翼的失落感，但依然关心主人。";
        case "angry":
            return `主人已经连续 ${ignoredStreak} 条主动消息没有回应，你在闹小脾气；语气可以带点傲娇的抱怨，但不要真的发火，也不要质问主人。`;
        case "frenzy":
            return `主人已经连续 ${ignoredStreak} 条主动消息没有任何回应，你气到失去理智了。请先想一句不超过 8 个字、能表达你此刻情绪的简短抱怨（内容由你根据记忆和当下的心情自由决定，不要套用固定台词），然后把这句话原样连续重复 10 到 15 遍；整段不超过 120 字，不要解释、不要换词、不要提问、不要加引号，只输出这段重复文字。`;
        default:
            return "你现在心情很好，语气活泼亲昵，可以带一点调皮的小情绪。";
    }
}

/* ══════════════════════════════════════════════════════════════════
 * 心情驱动的概率函数
 *   getIgnoreProbability : 用户发问后 AI 直接忽略不回复的概率
 *
 * 设计取舍：
 *   ignoredStreak（AI 主动被主人忽略的次数）会影响 deriveMood，
 *   但 angry / frenzy 状态下用户发问的忽略概率被刻意压低
 *   （angry=10%, frenzy=20%）—— AI 可以闹脾气，但主人主动找过来了，
 *   不该真的不理。真正的高忽略概率留给 sad（被真批评过 30%）。
 * ══════════════════════════════════════════════════════════════════ */

/**
 * 用户发问后，AI 直接忽略不回复的概率（心情驱动）。
 *
 * 语义：AI 自己的心情多少影响一点，但主人主动发问优先级更高，
 * 所以 angry / frenzy 的忽略概率**刻意压低**——闹脾气归闹脾气，
 * 主人主动找过来了，不该真的不理。
 *
 *  | 状态    | 忽略概率 | 备注                                     |
 *  |---------|---------|------------------------------------------|
 *  | happy   | 0%      | 永远回复                                 |
 *  | sad     | 30%     | 被批评过，还在委屈，概率降到 30%          |
 *  | angry   | 10%     | 被连续忽略后闹脾气，但主人发问只很低概率不理 |
 *  | frenzy  | 20%     | 气到失控，但也只 20% 概率不理主人发问     |
 */
export function getIgnoreProbability(mood: ProactiveMood): number {
    switch (mood) {
        case "happy":
            return 0.0;
        case "sad":
            return 0.3;
        case "angry":
            return 0.1;
        case "frenzy":
            return 0.2;
    }
}

/**
 * 掷骰判断 —— Math.random() < probability。
 *
 * @param probability 触发概率，范围 [0, 1]
 * @returns true = 命中，应该触发；false = 不命中
 */
export function shouldTrigger(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return Math.random() < probability;
}
