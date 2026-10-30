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
import {
    classifyDecayState,
    computeRetention,
    normalizeEntry,
} from "@/services/memory/decay";
import type { MemoryEntry, MemoryImportance } from "@/services/memory/types";
import { loadAIConfig } from "../chrome-api/ai-config";
import { completeChatFlow, uploadFile } from "../deepseek";
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

/* ---------- 记忆上下文 ---------- */

/**
 * 记忆分段规则 —— 不同类型记忆的性质不同，混在一起会让模型分不清
 * 「主人明确说过的偏好」和「某次闲聊的碎片」：
 *   1. 对话记忆：只保留最近 24 小时、最多 20 条（了解近况即可，避免复读）
 *   2. 用户偏好：走艾宾浩斯保留率，只注入仍然「清晰」（active）的那部分
 *   3. 其他记忆（事实 / 情景 / 身份）：全部带上，按重要度排序
 */
/** 对话记忆的时间窗口（24 小时） */
const CONVERSATION_MEMORY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** 对话记忆条数上限 */
const MAX_CONVERSATION_MEMORIES = 20;
/** 整段记忆上下文的字符预算，防止 prompt 无上限膨胀 */
const MEMORY_CONTEXT_BUDGET = 2000;
/** 单条记忆展示时的字符上限 */
const MAX_MEMORY_LINE_CHARS = 120;

/** 其他记忆的排序权重：重要度优先，同级再看新旧 */
const IMPORTANCE_RANK: Record<MemoryImportance, number> = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0,
};

/** 主动消息的行为要求 —— 放在 user request 里，模型对「当前这一轮」更敏感 */
const OPENING_INSTRUCTION =
    "你要主动向用户开口。结合上面的记忆与当前时间，说 1 到 2 句自然简短的话；不要复述最近对话原文，也不要连续追问。";
/** 下班收尾的行为要求 */
const CLOSING_INSTRUCTION =
    "这是今天最后一次主动消息。结合上面的记忆与当前时间，说 1 到 2 句收尾的话（类似「晚安，明天见」）；不要再追问，也不要安排新任务。";

/**
 * 单条记忆压缩成一行：去掉换行、按码点截断。
 *
 * 对话记忆的内容是「用户：…\nAI：…」的多行块，直接塞进列表会把排版撑乱，
 * 也容易让某一条超长记忆吃光整段预算。
 */
function formatMemoryLine(entry: MemoryEntry): string {
    const compact = entry.content.replace(/\s*\n+\s*/g, " / ").trim();
    const chars = Array.from(compact);
    const text =
        chars.length > MAX_MEMORY_LINE_CHARS
            ? `${chars.slice(0, MAX_MEMORY_LINE_CHARS).join("")}…`
            : compact;
    return `- ${text}`;
}

/**
 * 把长期记忆按类型分段拼成主动对话的上下文。
 *
 * @param entries 该角色全部长期记忆（来自 listEntries，未经过检索排序）
 * @param now     当前时间戳（毫秒）
 * @returns 可直接拼进 system prompt 的分段文本；没有可用记忆时为空串
 */
export function assembleMemoryContext(
    entries: readonly MemoryEntry[],
    now: number,
): string {
    let budget = MEMORY_CONTEXT_BUDGET;

    const render = (title: string, list: readonly MemoryEntry[]): string => {
        const lines: string[] = [];
        for (const entry of list) {
            const line = formatMemoryLine(entry);
            // 预算不足时保留优先级更高的段落，直接丢弃后面的条目
            if (line.length + 1 > budget) break;
            lines.push(line);
            budget -= line.length + 1;
        }
        return lines.length > 0 ? `[${title}]\n${lines.join("\n")}` : "";
    };

    // 1) 对话记忆：最近 24 小时，最多 20 条，按时间正序展示（读起来像流水账）
    const conversations = entries
        .filter(
            (entry) =>
                entry.category === "conversation" &&
                entry.createdAt >= now - CONVERSATION_MEMORY_WINDOW_MS,
        )
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-MAX_CONVERSATION_MEMORIES);

    // 2) 用户偏好：只留保留率仍处于 active 的「清晰记忆」
    const preferences = entries
        .filter((entry) => entry.category === "preference")
        .map((entry) => normalizeEntry(entry))
        .filter((entry) => classifyDecayState(entry, now) === "active")
        .sort(
            (a, b) => computeRetention(b, now) - computeRetention(a, now),
        );

    // 3) 其他记忆（事实 / 情景 / 身份）：全量保留，按重要度与新旧排序
    const others = entries
        .filter(
            (entry) =>
                entry.category !== "conversation" &&
                entry.category !== "preference",
        )
        .sort(
            (a, b) =>
                IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance] ||
                b.createdAt - a.createdAt,
        );

    return [
        render("最近的对话记忆（24 小时内）", conversations),
        render("用户偏好（清晰的记忆）", preferences),
        render("其他记忆", others),
    ]
        .filter(Boolean)
        .join("\n\n");
}

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
 * 截取当前活跃标签页并上传到 DeepSeek
 * 失败时静默返回 undefined（chrome:// / 扩展页 / 无活跃窗口等场景无法截图）
 * @returns 上传成功的 file_id，或 undefined
 */
async function captureAndUploadActiveTab(): Promise<string | undefined> {
    try {
        // Service Worker 没有「当前窗口」概念，必须显式传 windowId，
        // 否则 captureVisibleTab 会以 "No active window" 失败
        const focusedWindow = await chrome.windows.getLastFocused({
            windowTypes: ['normal'],
        });
        if (!focusedWindow.id) {
            maLogger.warn("[ProactiveChat] 未取到聚焦窗口，跳过截图");
            return undefined;
        }

        maLogger.info("[ProactiveChat] 开始截图，windowId:", focusedWindow.id);
        const dataUrl = await chrome.tabs.captureVisibleTab(focusedWindow.id, {
            format: 'png',
        });
        if (!dataUrl) {
            maLogger.warn("[ProactiveChat] 截图返回空，跳过图片上传");
            return undefined;
        }

        // data:image/png;base64,xxxxx → 去掉前缀，base64 → Uint8Array
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

        const fileId = await uploadFile(binary, 'image/png', 'screenshot.png');
        maLogger.info("[ProactiveChat] 截图上传成功:", fileId);
        return fileId;
    } catch (error) {
        maLogger.warn("[ProactiveChat] 截图或上传失败，跳过图片:", error);
        return undefined;
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
    /** 可选：当前活跃标签页截图的 file_id，让 AI "看到"主人在做什么 */
    fileIds?: string[],
): Promise<string> {
    const config = await loadAIConfig();
    if (!hasUsableAIConfig(config)) {
        throw new Error("AI 配置不可用");
    }

    const memoryService = getMemoryService();
    const identity = await memoryService.getIdentity(role);
    // 时间上下文只在这里出现一次（含日期 + 星期），放在 user request 里避免重复
    const timeContext = `现在是 ${getDateContext(now)} ${getTimePeriod(now)} ${getFormattedTime(now)}`;

    // 读取记忆失败不阻塞主流程，只降级为无记忆上下文
    let memoryContext = "";
    try {
        const entries = await memoryService.listEntries(role);
        memoryContext = assembleMemoryContext(entries, now.getTime());
    } catch (error) {
        maLogger.warn("[ProactiveChat] 读取记忆失败，忽略记忆上下文:", error);
    }

    // 系统提示词只放「身份 + 记忆 + 心情」这些长期设定
    const systemPrompt = [
        config.systemPrompt?.trim(),
        identity?.systemPromptTemplate?.trim(),
        identity?.personaDescription?.trim()
            ? `[角色身份]\n${identity.personaDescription}`
            : undefined,
        memoryContext,
        `[当前心情] ${moodPrompt}`,
    ]
        .filter(Boolean)
        .join("\n\n");

    // 行为要求与时间一起放进 user request —— 模型对「当前这一轮」的指令更敏感
    const promptSections: string[] = [timeContext];
    if (fileIds && fileIds.length > 0) {
        promptSections.push(
            "我给你附上了一张当前屏幕的截图，你可以看到我现在正在做什么。请结合画面内容，用你的身份和心情自然地和我聊一句。",
        );
    }
    promptSections.push(closing ? CLOSING_INSTRUCTION : OPENING_INSTRUCTION);
    const requestPrompt = promptSections.join("\n\n");

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
            requestPrompt,
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
            systemPrompt,
            undefined, // OpenAICompatibleRequestOptions
            fileIds,
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

    // 尝试截取当前活跃标签页并上传 —— 让 AI "看到"主人在做什么
    // 截图/上传失败静默降级，不阻塞主动对话主流程
    let fileIds: string[] | undefined;
    try {
        const fileId = await captureAndUploadActiveTab();
        if (fileId) {
            fileIds = [fileId];
        }
    } catch (error) {
        maLogger.warn("[ProactiveChat] 截图上传异常，降级为无图:", error);
    }

    let text: string;
    try {
        text = await generateMessage(role, now, closing, moodPrompt, fileIds);
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
