/**
 * @file service-worker/background/proactive-chat.ts
 * @description AI 主动发起对话 —— 后台调度层（chrome.alarms）
 *
 * 职责分层：
 *   1. 调度：chrome.alarms 做全局唯一的随机排期（0.5~10 分钟）
 *      —— MV3 的 Service Worker 空闲 30 秒会被挂起，setTimeout 会丢，
 *         必须用持久化到磁盘、能唤醒 SW 的 chrome.alarms
 *   2. 生成：调用真实 AI 模型（记忆上下文 + 当前时间）生成主动开场白
 *   3. 落库：写入记忆系统 conversation 类别（用户打开对话窗即可看到）
 *   4. 提醒：通知当前活跃标签页的 content script 弹出 dock（2 秒后收回）
 *
 * 为什么提醒不能在这里做：
 *   Service Worker 没有 DOM，dock 的 CSS 滑出动画只能在 content script
 *   播放，因此这里只负责发消息，见 modules/sidebar/proactive-chat.ts
 *
 * @author Vivy
 * @date 2026-10-29
 */
import { getMemoryService } from "@/services/memory";
import { loadAIConfig } from "../chrome-api/ai-config";
import { completeChatFlow } from "../deepseek";
import {
    createDefaultMoodState,
    deriveMood,
    describeMood,
    detectHurt,
    extractUserText,
    getDateKey,
    normalizeMoodState,
    type ProactiveMoodState,
} from "./proactive-mood";

/** 时间段 —— 按小时分段，用于挑选问候语与提示 AI 的时间上下文 */
type TimePeriod = "清晨" | "上午" | "下午" | "傍晚" | "晚上" | "深夜";

/** AI 配置对象类型（来自 ai-config 模块） */
type AIConfig = Awaited<ReturnType<typeof loadAIConfig>>;

/** 记忆服务实例类型 */
type MemoryService = ReturnType<typeof getMemoryService>;

/** alarm 名称 —— 全局唯一，测试中也用它断言 */
export const PROACTIVE_ALARM_NAME = "ai-proactive-chat";

/**
 * 随机间隔下限（分钟）。
 * chrome.alarms 的 delayInMinutes 硬下限是 30 秒（Chrome 120+，更早版本 1 分钟），
 * 所以「0~10 分钟」实际落地为「0.5~10 分钟」。
 */
const MIN_DELAY_MINUTES = 0.5;
/** 随机间隔上限（分钟） */
const MAX_DELAY_MINUTES = 10;
/** AI 请求超时（毫秒）—— 超时后降级到本地模板 */
const REQUEST_TIMEOUT_MS = 30_000;
/** 主动消息最大长度（按字符/码点裁剪） */
const MAX_MESSAGE_LENGTH = 120;
/** 默认角色 —— 主人实际使用的记忆命名空间 */
const DEFAULT_ROLE = "vivy_catgirl";

/**
 * 禁止主动对话使用的内部功能角色。
 *
 * 这些角色的 identity.systemPromptTemplate 里带着专属功能的协议提示词
 * （例如 textarea_ai_autofill 的 [SYSTEM PROTOCOL] 富文本生成指令），
 * 复用会导致：
 *   1. 主动对话的系统提示词被功能协议污染；
 *   2. 闲聊消息写进功能角色的记忆池，反过来干扰其 RAG 检索。
 */
const EXCLUDED_ROLES = new Set([
    // 页面 textarea 富文本填充（modules/textSelectionToolbar/textarea-ai.ts）
    "textarea_ai_autofill",
    // 页面表格数据生成（content/content-radius.tsx）
    "table_data_generator",
]);

/* ---------- 作息调度 ---------- */

/** 上班时间（24 小时制）—— 作息变化时改这里 */
const WORK_START_HOUR = 9;
/** 下班时间（24 小时制） */
const WORK_END_HOUR = 19;
/** 下班前多少分钟进入收尾模式：发当天最后一条「晚安」后停止请求 */
const OFF_DUTY_WINDOW_MINUTES = 15;
/** 记录已发送收尾消息的日期（YYYY-MM-DD），用于同一天去重 */
const OFF_DUTY_FLAG_KEY = "proactive_chat_off_duty_date";

/** 当天下班收尾消息的兜底模板（AI 不可用时使用） */
const CLOSING_TEMPLATES = [
    "今天辛苦了，早点休息，明天见。",
    "下班时间到啦，今天就到这里吧，晚安。",
    "收工啦，去好好休息，明天见。",
];

/** 心情状态存储键 */
const MOOD_STATE_KEY = "proactive_chat_mood_state";

/** 星期标签 —— 让模型能区分工作日与周末 */
const WEEKDAY_LABELS = [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
];

/** 本地降级模板池 —— AI 不可用或生成失败时按时间段随机挑一条 */
const FALLBACK_TEMPLATES: Record<TimePeriod, string[]> = {
    清晨: [
        "早安呀，新的一天开始了。今天有什么想做的事吗？",
        "清晨好，先慢慢醒来吧。今天的计划已经想好了吗？",
        "新的一天开始啦，记得给自己留一点轻松的时间。",
    ],
    上午: [
        "上午好呀，工作或学习还顺利吗？",
        "忙了一会儿的话，要不要起来活动一下？",
        "今天上午有什么值得期待的小事吗？",
    ],
    下午: [
        "下午好，事情进展得还顺利吗？",
        "忙到现在辛苦啦，记得喝点水、休息一下。",
        "下午的节奏还好吗？需要的话可以陪你聊聊。",
    ],
    傍晚: [
        "傍晚好，今天过得怎么样？",
        "一天快要结束啦，有什么想和我分享的吗？",
        "忙了一天的话，现在可以稍微放松一下了。",
    ],
    晚上: [
        "晚上好呀，今天有什么开心的事吗？",
        "夜晚适合放慢一点节奏，想聊聊今天吗？",
        "今天辛苦啦，记得给自己一点休息时间。",
    ],
    深夜: [
        "还没休息吗？如果累了，就先照顾好自己吧。",
        "深夜好呀，愿你今晚能轻松一些。",
        "这么晚还醒着呀，想说说话的话我在这里。",
    ],
};

/** 发往 content script 的消息载荷 */
interface ProactiveMessagePayload {
    /** 生成的主动消息文本 */
    text: string;
    /** 生成消息的角色 key（content 侧当前不使用，留给未来扩展） */
    role: string;
}

/** alarm 监听是否已注册 —— 防止重复注册（SW 冷启动可能多次执行顶层代码） */
let alarmListenerRegistered = false;

/** 按小时解析时间段 */
function getTimePeriod(date: Date): TimePeriod {
    const hour = date.getHours();
    if (hour < 5) return "深夜";
    if (hour < 8) return "清晨";
    if (hour < 12) return "上午";
    if (hour < 17) return "下午";
    if (hour < 19) return "傍晚";
    if (hour < 23) return "晚上";
    return "深夜";
}

/** 格式化为 HH:mm */
function getFormattedTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
    ).padStart(2, "0")}`;
}

/* ---------- 作息判断（纯函数，便于单测） ---------- */

/** 当前是否处于工作时段 —— 上班前 / 下班后都不主动打扰 */
export function isWorkTime(now: Date): boolean {
    const hour = now.getHours();
    return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

/** 是否已进入下班前的收尾窗口（下班前 15 分钟） */
export function isOffDutyWindow(now: Date): boolean {
    const minutes = now.getHours() * 60 + now.getMinutes();
    const endMinutes = WORK_END_HOUR * 60;
    return (
        minutes >= endMinutes - OFF_DUTY_WINDOW_MINUTES &&
        minutes < endMinutes
    );
}

/** 下一次上班时间 —— 今天上班点已过则顺延到明天 */
export function getNextWorkStart(now: Date): Date {
    const next = new Date(now.getTime());
    next.setHours(WORK_START_HOUR, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

/** 日期上下文 —— 带上星期，让模型能区分工作日与周末 */
export function getDateContext(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${date.getFullYear()}年${month}月${day}日 ${WEEKDAY_LABELS[date.getDay()]}`;
}

/** 从模板池里按时间段随机挑一条；收尾场景固定挑晚安模板 */
function getFallbackMessage(period: TimePeriod, closing = false): string {
    const templates = closing ? CLOSING_TEMPLATES : FALLBACK_TEMPLATES[period];
    return templates[Math.floor(Math.random() * templates.length)];
}

/** 读取「已发送下班收尾」的日期标记 */
async function getOffDutyDate(): Promise<string | null> {
    try {
        const result = await chrome.storage.local.get(OFF_DUTY_FLAG_KEY);
        return (result[OFF_DUTY_FLAG_KEY] as string | undefined) ?? null;
    } catch (error) {
        maLogger.warn("[ProactiveChat] 读取下班标记失败:", error);
        return null;
    }
}

/** 记录「今天已发送下班收尾」，当天不再触发请求 */
async function markOffDuty(dateKey: string): Promise<void> {
    try {
        await chrome.storage.local.set({ [OFF_DUTY_FLAG_KEY]: dateKey });
    } catch (error) {
        maLogger.warn("[ProactiveChat] 写入下班标记失败:", error);
    }
}

/** 读取当天心情状态（跨天自动重置为「活跃开心」） */
async function loadMoodState(dateKey: string): Promise<ProactiveMoodState> {
    try {
        const result = await chrome.storage.local.get(MOOD_STATE_KEY);
        return normalizeMoodState(result[MOOD_STATE_KEY], dateKey);
    } catch (error) {
        maLogger.warn("[ProactiveChat] 读取心情状态失败:", error);
        return createDefaultMoodState(dateKey);
    }
}

/** 持久化心情状态 */
async function saveMoodState(state: ProactiveMoodState): Promise<void> {
    try {
        await chrome.storage.local.set({ [MOOD_STATE_KEY]: state });
    } catch (error) {
        maLogger.warn("[ProactiveChat] 保存心情状态失败:", error);
    }
}

/**
 * 读取今天的用户对话轮次。
 * 对话被合并成「用户：…\nAI：…」存进 conversation，这里反解出用户部分。
 */
async function loadTodayUserTurns(
    memoryService: ReturnType<typeof getMemoryService>,
    role: string,
    now: Date,
): Promise<{ userTexts: string[]; lastReplyAt: number }> {
    try {
        const entries = await memoryService.listByCategory(
            role,
            "conversation",
        );
        const startOfDay = new Date(now.getTime());
        startOfDay.setHours(0, 0, 0, 0);
        const startAt = startOfDay.getTime();

        const turns = entries.filter(
            (entry) =>
                entry.source === "ai-conversation" &&
                entry.createdAt >= startAt,
        );

        return {
            userTexts: turns
                .map((entry) => extractUserText(entry.content))
                .filter(Boolean),
            lastReplyAt: turns.reduce(
                (latest, entry) => Math.max(latest, entry.createdAt),
                0,
            ),
        };
    } catch (error) {
        maLogger.warn("[ProactiveChat] 读取今日对话失败:", error);
        return { userTexts: [], lastReplyAt: 0 };
    }
}

/** 判断 AI 配置是否可用（普通 apiKey 或 DeepSeek 登录凭据） */
function hasUsableAIConfig(
    config: AIConfig | null | undefined,
): config is AIConfig {
    if (!config) return false;

    const hasApiKey = Boolean(config.apiKey?.trim());
    const hasDeepSeekCredentials = Boolean(
        config.deepseekAuthToken?.trim() && config.deepseekCookies?.trim(),
    );
    return hasApiKey || hasDeepSeekCredentials;
}

/** 取当前角色：优先落到侧边栏聊天窗的默认角色，且必须排除内部功能角色 */
async function resolveRole(memoryService: MemoryService): Promise<string> {
    try {
        const roles = await memoryService.listRoles();

        // 1) 优先聊天窗默认角色 —— 消息直接可见
        if (roles.includes(DEFAULT_ROLE)) return DEFAULT_ROLE;

        // 2) 其次任一非内部功能角色
        const candidates = roles.filter((role) => !EXCLUDED_ROLES.has(role));
        if (candidates.length > 0) return candidates[0];

        // 3) 全部被排除时也绝不回落 —— 宁可新建干净命名空间，
        //    也不把闲聊写进 textarea_ai_autofill 这类功能角色
        return DEFAULT_ROLE;
    } catch (error) {
        maLogger.warn("[ProactiveChat] 获取角色列表失败，使用默认角色:", error);
        return DEFAULT_ROLE;
    }
}

/**
 * 调用真实 AI 生成主动开场白。
 * 记忆检索由本模块显式完成（不走 StreamManager，因为它依赖 Port）。
 *
 * @throws 配置不可用 / 请求失败 / 超时 / 空结果时抛出，由调用方降级
 */
async function generateMessage(
    role: string,
    now: Date,
    closing: boolean,
    moodPrompt: string,
): Promise<string> {
    const config = await loadAIConfig();
    if (!hasUsableAIConfig(config)) {
        throw new Error("AI 配置不可用");
    }

    const memoryService = getMemoryService();
    const identity = await memoryService.getIdentity(role);
    // 时间上下文只在这里出现一次（含日期 + 星期），避免在 prompt 里重复
    const timeContext = `现在是 ${getDateContext(now)} ${getTimePeriod(now)} ${getFormattedTime(now)}`;
    const prompt = "（请自然地向用户主动发起对话。）";

    // 记忆检索失败不阻塞主流程，只降级为无记忆上下文
    let memoryContext = "";
    try {
        const result = await memoryService.buildContext(role, prompt);
        memoryContext = result.assembledContext || "";
    } catch (error) {
        maLogger.warn("[ProactiveChat] 记忆检索失败，忽略记忆上下文:", error);
    }

    const systemPrompt = [
        config.systemPrompt?.trim(),
        identity?.systemPromptTemplate?.trim(),
        memoryContext,
        `[当前心情] ${moodPrompt}`,
        closing
            ? "这是今天最后一次主动消息。结合记忆中的用户偏好、最近话题与当前时间，说 1 到 2 句收尾的话（类似「晚安，明天见」）；不要再追问，也不要安排新任务。"
            : "你要主动向用户开口。结合记忆中的用户偏好、最近话题与当前时间，说 1 到 2 句自然简短的话；不要复述最近对话原文，也不要连续追问。",
    ]
        .filter(Boolean)
        .join("\n\n");

    const chunks: string[] = [];

    // 用 Promise 包住回调式流式接口，并加超时看门狗
    await new Promise<void>((resolve, reject) => {
        let settled = false;

        const finish = (error?: Error): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        const timeoutId = setTimeout(() => {
            finish(new Error("AI 主动消息生成超时"));
        }, REQUEST_TIMEOUT_MS);

        void completeChatFlow(
            prompt,
            role,
            {
                onData: (data: string) => {
                    if (data) chunks.push(data);
                },
                onComplete: () => finish(),
                onError: (error: unknown) => {
                    finish(
                        error instanceof Error
                            ? error
                            : new Error(String(error)),
                    );
                },
            },
            config.provider,
            config.modelId,
            config.apiKey,
            config.apiBaseUrl,
            `${systemPrompt}\n\n${timeContext}`,
        )
            // 即使 onComplete 未被调用，Promise 正常结束也算完成
            .then(() => finish())
            .catch((error: unknown) => {
                finish(error instanceof Error ? error : new Error(String(error)));
            });
    });

    const text = chunks.join("").trim();
    if (!text) {
        throw new Error("AI 返回了空的主动消息");
    }
    return text;
}

/**
 * 通知当前活跃标签页的 content script 弹出 dock 提醒。
 * 只发给顶层 frame（侧边栏只在顶层注入）。
 * 页面不可注入（chrome:// / 扩展页 / 无 content script）时静默跳过。
 */
async function notifyActiveTab(text: string, role: string): Promise<void> {
    try {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        if (!tab?.id) return;

        const payload: ProactiveMessagePayload = { text, role };

        // 刻意不 await 回执：content 侧的 messenger.ext.listen 封装对每条消息
        // 都返回 true（异步保持通道），若这里 await，Promise 可能长时间 pending，
        // 拖住 runProactiveMessage 的 finally，导致后续排期停摆。
        // 提醒只是尽力而为，失败记录日志即可。
        void chrome.tabs
            .sendMessage(
                tab.id,
                {
                    type: "PROACTIVE_AI_MESSAGE",
                    target: "content",
                    payload,
                },
                { frameId: 0 },
            )
            .catch((error: unknown) => {
                maLogger.warn(
                    "[ProactiveChat] 向活跃标签页发送提醒失败:",
                    error,
                );
            });
    } catch (error) {
        maLogger.warn("[ProactiveChat] 向活跃标签页发送提醒失败:", error);
    }
}

/**
 * 一次完整的主动对话流程：生成 → 写记忆 → 提醒。
 * 生成失败降级到模板；写记忆失败则跳过提醒（避免"提醒了却查不到消息"）。
 */
async function runProactiveMessage(): Promise<void> {
    const now = new Date();

    // 作息保护：上班前 / 下班后不发起任何请求，避免整夜持续消耗 token
    if (!isWorkTime(now)) return;

    const dateKey = getDateKey(now);

    // 当天已经发过下班收尾消息 → 不再请求
    if ((await getOffDutyDate()) === dateKey) return;

    const closing = isOffDutyWindow(now);
    const period = getTimePeriod(now);
    const memoryService = getMemoryService();
    const role = await resolveRole(memoryService);

    // 心情推导：主人是否回复过 → 连续被忽略次数；今天是否被批评 → 伤心
    const moodState = await loadMoodState(dateKey);
    const { userTexts, lastReplyAt } = await loadTodayUserTurns(
        memoryService,
        role,
        now,
    );
    const replied = lastReplyAt > moodState.lastPushAt;
    const nextState: ProactiveMoodState = {
        date: dateKey,
        ignoredStreak: replied ? 0 : moodState.ignoredStreak + 1,
        hurt: moodState.hurt || detectHurt(userTexts),
        lastPushAt: now.getTime(),
    };
    const moodPrompt = describeMood(
        deriveMood(nextState),
        nextState.ignoredStreak,
    );

    let text: string;
    try {
        text = await generateMessage(role, now, closing, moodPrompt);
    } catch (error) {
        maLogger.warn("[ProactiveChat] AI 生成失败，使用本地问候:", error);
        text = getFallbackMessage(period, closing);
    }

    // 按码点裁剪，避免把 emoji 切坏
    const finalText = Array.from(text).slice(0, MAX_MESSAGE_LENGTH).join("");

    try {
        await memoryService.addEntry({
            role,
            content: `AI：${finalText}`,
            category: "conversation",
            importance: "low",
            source: "ai-proactive",
        });
    } catch (error) {
        maLogger.error("[ProactiveChat] 保存主动消息到记忆失败:", error);
        return;
    }

    // 推送成功后才落库心情 —— 生成/写库失败不应计入「被忽略」
    await saveMoodState(nextState);

    // 收尾消息落库成功后才打标记 —— 写库失败时不静音，留给下一次机会
    if (closing) {
        await markOffDuty(dateKey);
    }

    await notifyActiveTab(finalText, role);
}

/** 排下一次触发：工作时段内随机；时段外或当天已收尾则直接对齐到下次上班 */
async function scheduleNext(): Promise<void> {
    const now = new Date();

    try {
        const scheduleToNextWorkStart = async (): Promise<void> => {
            const nextStart = getNextWorkStart(now);
            await chrome.alarms.create(PROACTIVE_ALARM_NAME, {
                when: nextStart.getTime(),
            });
        };

        // 1) 非工作时段：不排随机轮询，直接等到上班点，避免整夜空转
        if (!isWorkTime(now)) {
            await scheduleToNextWorkStart();
            return;
        }

        // 2) 今天已经说过晚安：等明天上班
        if ((await getOffDutyDate()) === getDateKey(now)) {
            await scheduleToNextWorkStart();
            return;
        }

        // 3) 正常随机间隔
        const delay =
            MIN_DELAY_MINUTES +
            Math.random() * (MAX_DELAY_MINUTES - MIN_DELAY_MINUTES);
        await chrome.alarms.create(PROACTIVE_ALARM_NAME, {
            delayInMinutes: delay,
        });
    } catch (error) {
        maLogger.warn("[ProactiveChat] 排期失败:", error);
    }
}

/**
 * background 入口调用：注册 alarm 监听 + 保证 alarm 存在。
 * alarm 持久化在磁盘上，SW 被挂起或浏览器重启后仍然有效；
 * 这里用 alarms.get 做一次自愈，避免首次安装/手动清除后没有排期。
 */
export function initProactiveChat(): void {
    // chrome.alarms 需要 manifest 声明 "alarms" 权限；
    // 缺失时为 undefined，这里必须兜底，否则 background 顶层会抛错并连带
    // 中断后续所有初始化（消息监听、快捷键等）。
    if (!chrome.alarms?.onAlarm) {
        maLogger.warn(
            "[ProactiveChat] chrome.alarms 不可用，已跳过主动对话调度；" +
                "请检查 manifest 的 permissions 是否包含 \"alarms\"",
        );
        return;
    }

    if (!alarmListenerRegistered) {
        alarmListenerRegistered = true;
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name !== PROACTIVE_ALARM_NAME) return;

            // 无论成功失败都续排，避免链路中断后永久停摆
            void (async () => {
                try {
                    await runProactiveMessage();
                } catch (error) {
                    maLogger.warn("[ProactiveChat] 主动对话执行失败:", error);
                } finally {
                    await scheduleNext();
                }
            })();
        });
    }

    void chrome.alarms
        .get(PROACTIVE_ALARM_NAME)
        .then((existing) => {
            if (!existing) void scheduleNext();
        })
        .catch((error) => {
            maLogger.warn("[ProactiveChat] 读取 alarm 状态失败:", error);
            void scheduleNext();
        });
}
