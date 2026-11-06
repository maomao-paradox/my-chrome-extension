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
import {
  formatRecentConversationContext,
  getMemoryService,
  isFunctionalRole,
  selectRecentConversationEntries,
} from "@/services/memory";
import {
  classifyDecayState,
  computeRetention,
  normalizeEntry,
} from "@/services/memory/decay";
import type { MemoryEntry, MemoryImportance } from "@/services/memory/types";
import { loadAIConfig } from "../chrome-api/ai-config";
import { completeChatFlow } from "../deepseek";
import { stripToolCallMarkup } from "../deepseek/tool-call-markup";
import {
  executeLocalMcpTool,
  isLocalMcpTool,
  LOCAL_MCP_TOOLS,
  SET_NEXT_PROACTIVE_INTERVAL,
  CAPTURE_SCREEN,
  shouldReturnToolResultToModel,
} from "./mcp-tools";
import {
  MAX_TOOL_ROUNDS,
  buildToolResultPrompt,
  type ToolExecutionResult,
} from "./tool-round-prompt";
import {
  createDefaultMoodState,
  deriveMood,
  describeMood,
  detectHurt,
  extractUserText,
  getDateKey,
  MOOD_STATE_KEY,
  normalizeMoodState,
  type ProactiveMoodState,
} from "./proactive-mood";
import {
  isAIChatEnabled,
  AI_CHAT_ENABLED_KEY,
  onAIChatEnabledChange,
} from "./ai-chat-toggle";
import {
  isAIProactiveChatEnabled,
  onAIProactiveChatEnabledChange,
} from "./proactive-chat-toggle";

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
 * 所以「0~120 分钟」实际落地为「0.5~120 分钟」。
 */
const MIN_DELAY_MINUTES = 0.5;
/** 随机间隔上限（分钟）—— 扩大到 120 分钟，避免过于频繁 */
const MAX_DELAY_MINUTES = 120;
/** AI 请求超时（毫秒）—— 超时后降级到本地模板 */
const REQUEST_TIMEOUT_MS = 30_000;
/** 主动消息最大长度（按字符/码点裁剪） */
const MAX_MESSAGE_LENGTH = 120;
/** 默认角色 —— 主人实际使用的记忆命名空间 */
const DEFAULT_ROLE = "vivy_catgirl";

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
 *   1. 对话记忆：只保留最近 24 小时内最新的 5 个对话片段
 *   2. 用户偏好：走艾宾浩斯保留率，只注入仍然「清晰」（active）的那部分
 *   3. 其他记忆（事实 / 情景 / 身份）：全部带上，按重要度排序
 */
/** 与普通聊天一致的记忆上下文字符预算 */
const MEMORY_CONTEXT_BUDGET = 2_000;
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
 * 将偏好、事实等非对话记忆压缩成一行；对话片段使用共享格式化器，
 * 保留多条连续消息的换行和完整内容。
 */
function formatMemoryLine(entry: MemoryEntry): string {
  const compact = entry.content.replace(/\s*\n+\s*/g, " / ").trim();
  const chars = Array.from(compact);
  const text =
    chars.length > MAX_MEMORY_LINE_CHARS
      ? `${chars.slice(0, MAX_MEMORY_LINE_CHARS).join("")}…`
      : compact;
  // 行首注入时间，和记忆服务的格式对齐 `YYYY/MM/DD HH:mm:ss`
  // proactive-chat 已经按 category 分段（preferences/others/conversations），
  // 行内不再重复标类目标签
  const d = new Date(entry.createdAt);
  const pad = (n: number): string => String(n).padStart(2, "0");
  const time = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `- [${time}] ${text}`;
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

  // 对话片段与普通聊天共用同一套时间窗口、条数上限和原文格式。
  const conversations = selectRecentConversationEntries(entries, now);

  // 2) 用户偏好：只留保留率仍处于 active 的「清晰记忆」
  const preferences = entries
    .filter((entry) => entry.category === "preference")
    .map((entry) => normalizeEntry(entry))
    .filter((entry) => classifyDecayState(entry, now) === "active")
    .sort((a, b) => computeRetention(b, now) - computeRetention(a, now));

  // 3) 其他记忆（事实 / 情景 / 身份）：全量保留，按重要度与新旧排序
  const others = entries
    .filter(
      (entry) =>
        entry.category !== "conversation" && entry.category !== "preference",
    )
    .sort(
      (a, b) =>
        IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance] ||
        b.createdAt - a.createdAt,
    );

  const conversationContext = formatRecentConversationContext(
    conversations,
    budget,
  );
  if (conversationContext) budget -= conversationContext.length + 2;

  return [
    conversationContext,
    render("你记得的关于用户的事", preferences),
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
    minutes >= endMinutes - OFF_DUTY_WINDOW_MINUTES && minutes < endMinutes
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

/**
 * 读取当天心情状态（跨天自动重置为「活跃开心」）。
 * export 给 runtime-connections.ts 共用（入口层忽略判断也需要读心情）。
 */
export async function loadMoodState(
  dateKey: string,
): Promise<ProactiveMoodState> {
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
    const entries = await memoryService.listByCategory(role, "conversation");
    const startOfDay = new Date(now.getTime());
    startOfDay.setHours(0, 0, 0, 0);
    const startAt = startOfDay.getTime();

    const turns = entries.filter(
      (entry) =>
        entry.source === "ai-conversation" && entry.createdAt >= startAt,
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

/** 取当前角色：落到聊天角色（listChatRoles 已过滤纯工具角色），且必须排除内部功能角色 */
async function resolveRole(memoryService: MemoryService): Promise<string> {
  try {
    const roles = await memoryService.listChatRoles();

    // 1) 优先聊天窗默认角色 —— 消息直接可见
    if (roles.includes(DEFAULT_ROLE)) return DEFAULT_ROLE;

    // 2) 其次任一聊天角色（listChatRoles 已确保非工具类）
    if (roles.length > 0) return roles[0];

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
 *
 * @param presetSystemPrompt 可选：调用方已经组装好的 systemPrompt。
 *   如果传入则跳过内部的 identity + memory 组装 —— 让 runProactiveMessage
 *   可以组装一次 systemPrompt 后，首条回复和连续回复续轮都复用它。
 */
async function generateMessage(
  role: string,
  now: Date,
  closing: boolean,
  moodPrompt: string,
  presetSystemPrompt?: string,
): Promise<{ text: string; scheduledByMcp: boolean; usedScreenshot: boolean }> {
  const config = await loadAIConfig();
  if (!hasUsableAIConfig(config)) {
    throw new Error("AI 配置不可用");
  }

  // 系统提示词：优先使用调用方预设的，否则自己组装（identity + memory + 心情）
  // 时间上下文放在 systemPrompt 组装之前 —— promptSections 里也要用
  const timeContext = `现在是 ${getDateContext(now)} ${getTimePeriod(now)} ${getFormattedTime(now)}`;

  let systemPrompt: string;
  if (presetSystemPrompt) {
    systemPrompt = presetSystemPrompt;
  } else {
    const memoryService = getMemoryService();
    const identity = await memoryService.getIdentity(role);

    // 读取记忆失败不阻塞主流程，只降级为无记忆上下文
    let memoryContext = "";
    try {
      const entries = await memoryService.listEntries(role);
      memoryContext = assembleMemoryContext(entries, now.getTime());
    } catch (error) {
      maLogger.warn("[ProactiveChat] 读取记忆失败，忽略记忆上下文:", error);
    }

    // 系统提示词只放「身份 + 记忆 + 心情」这些长期设定
    systemPrompt = [
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
  }

  // 行为要求与时间一起放进 user request —— 模型对「当前这一轮」的指令更敏感
  const promptSections: string[] = [timeContext];
  promptSections.push(closing ? CLOSING_INSTRUCTION : OPENING_INSTRUCTION);
  const requestPrompt = promptSections.join("\n\n");

  let scheduledByMcp = false;
  let usedScreenshot = false;
  let roundPrompt = requestPrompt;
  let fileIds: string[] | undefined;
  let toolRounds = 0;
  const replyParts: string[] = [];

  for (;;) {
    const roundChunks: string[] = [];
    let completedText: string | undefined;
    let functionCalls: Array<{
      name: string;
      args?: Record<string, unknown>;
    }> = [];

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
        roundPrompt,
        role,
        {
          onData: (data: string) => {
            if (data) roundChunks.push(data);
          },
          onComplete: (result: unknown) => {
            if (result && typeof result === "object") {
              const completion = result as {
                text?: unknown;
                functionCalls?: unknown;
              };
              completedText =
                typeof completion.text === "string" ? completion.text : undefined;
              functionCalls = Array.isArray(completion.functionCalls)
                ? (completion.functionCalls as typeof functionCalls)
                : [];
            }
            finish();
          },
          onError: (error: unknown) => {
            finish(error instanceof Error ? error : new Error(String(error)));
          },
        },
        config.provider,
        config.modelId,
        config.apiKey,
        config.apiBaseUrl,
        systemPrompt,
        { tools: toolRounds < MAX_TOOL_ROUNDS ? LOCAL_MCP_TOOLS : [] },
        fileIds,
      )
        .then(() => finish())
        .catch((error: unknown) => {
          finish(error instanceof Error ? error : new Error(String(error)));
        });
    });

    const roundText = (completedText ?? roundChunks.join("")).trim();
    if (roundText) replyParts.push(roundText);

    const localCalls = functionCalls.filter((call) =>
      isLocalMcpTool(call.name),
    );
    if (localCalls.length === 0) break;

    const toolResults = await Promise.all(
      localCalls.map(async (call): Promise<ToolExecutionResult> => {
        const args = call.args ?? {};
        try {
          const response = await executeLocalMcpTool(call.name, args, { role });
          if (
            call.name === SET_NEXT_PROACTIVE_INTERVAL &&
            "result" in response &&
            response.result &&
            typeof response.result === "object" &&
            "ok" in response.result &&
            response.result.ok === true
          ) {
            scheduledByMcp = true;
          }
          if (call.name === CAPTURE_SCREEN) {
            const result =
              "result" in response && response.result &&
              typeof response.result === "object"
                ? response.result
                : undefined;
            const fileId =
              result && "fileId" in result && typeof result.fileId === "string"
                ? result.fileId
                : undefined;
            if (fileId) {
              fileIds = [fileId];
              usedScreenshot = true;
            }
          }
          return { name: call.name, args, response };
        } catch (error) {
          maLogger.warn(
            `[ProactiveChat] 主动消息工具调用失败 (${call.name}):`,
            error,
          );
          return {
            name: call.name,
            args,
            response: {
              error: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }),
    );

    const resultsForModel = toolResults.filter((result) =>
      shouldReturnToolResultToModel(result.name),
    );
    if (resultsForModel.length === 0) break;

    toolRounds += 1;
    roundPrompt = [
      buildToolResultPrompt(resultsForModel),
      ...(usedScreenshot
        ? ["你还收到了一张当前屏幕截图，请结合截图内容自然地回复。"]
        : []),
    ].join("\n\n");
  }

  const text = replyParts.join("\n").trim();
  if (!text) {
    throw new Error("AI 返回了空的主动消息");
  }
  return { text, scheduledByMcp, usedScreenshot };
}

/**
 * 通知当前活跃标签页的 content script 弹出 dock 提醒。
 * 只发给顶层 frame（侧边栏只在顶层注入）。
 * 页面不可注入（chrome:// / 扩展页 / 无 content script）时静默跳过。
 */
async function notifyActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    // 刻意不 await 回执：content 侧的 messenger.ext.listen 封装对每条消息
    // 都返回 true（异步保持通道），若这里 await，Promise 可能长时间 pending，
    // 拖住 runProactiveMessage 的 finally，导致后续排期停摆。
    // 提醒只是尽力而为，失败记录日志即可。
    void chrome.tabs
      .sendMessage(
        tab.id,
        {
          type: "PROACTIVE_AI_REMINDER",
          target: "content",
        },
        { frameId: 0 },
      )
      .catch((error: unknown) => {
        maLogger.warn("[ProactiveChat] 向活跃标签页发送提醒失败:", error);
      });
  } catch (error) {
    maLogger.warn("[ProactiveChat] 向活跃标签页发送提醒失败:", error);
  }
}

/**
 * 一次完整的主动对话流程：生成 → 写记忆 → 提醒。
 * 生成失败降级到模板；写记忆失败则跳过提醒（避免"提醒了却查不到消息"）。
 */
async function runProactiveMessage(): Promise<boolean> {
  const now = new Date();

  // 作息保护：上班前 / 下班后不发起任何请求，避免整夜持续消耗 token
  if (!isWorkTime(now)) return false;

  const dateKey = getDateKey(now);

  // 当天已经发过下班收尾消息 → 不再请求
  if ((await getOffDutyDate()) === dateKey) return false;

  void notifyActiveTab();

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

  /* ══════════════════════════════════════════════════════════════════
   * 组装 systemPrompt —— 一次组装，首条回复和连续回复续轮都复用
   * 避免 generateMessage 和后续 generateFollowupReply 各自独立 loadAIConfig + listEntries
   * ══════════════════════════════════════════════════════════════════ */
  let sharedSystemPrompt: string | undefined;
  let aiConfig: Awaited<ReturnType<typeof loadAIConfig>> | null = null;
  try {
    aiConfig = await loadAIConfig();
    if (hasUsableAIConfig(aiConfig)) {
      const identity = await memoryService.getIdentity(role);

      // 读取记忆失败不阻塞主流程，只降级为无记忆上下文
      let memoryContext = "";
      try {
        const entries = await memoryService.listEntries(role);
        memoryContext = assembleMemoryContext(entries, now.getTime());
      } catch (memErr) {
        maLogger.warn(
          "[ProactiveChat] 组装 systemPrompt 时读取记忆失败:",
          memErr,
        );
      }

      sharedSystemPrompt = [
        aiConfig.systemPrompt?.trim(),
        identity?.systemPromptTemplate?.trim(),
        identity?.personaDescription?.trim()
          ? `[角色身份]\n${identity.personaDescription}`
          : undefined,
        memoryContext,
        `[当前心情] ${moodPrompt}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  } catch (sysPromptErr) {
    maLogger.warn(
      "[ProactiveChat] 组装 systemPrompt 失败，续轮链将跳过:",
      sysPromptErr,
    );
  }

  let text: string;
  let scheduledByMcp = false;
  try {
    // 传入 presetSystemPrompt —— generateMessage 跳过重复组装
    const result = await generateMessage(
      role,
      now,
      closing,
      moodPrompt,
      sharedSystemPrompt,
    );
    text = result.text;
    scheduledByMcp = result.scheduledByMcp;
  } catch (error) {
    maLogger.warn("[ProactiveChat] AI 生成失败，使用本地问候:", error);
    text = getFallbackMessage(period, closing);
    scheduledByMcp = false;
  }

  // 主动消息没有 tools，但会话上下文可能让模型模仿输出工具标记 —— 先剥掉再裁剪
  const finalText = Array.from(stripToolCallMarkup(text))
    .slice(0, MAX_MESSAGE_LENGTH)
    .join("");

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
    return false;
  }

  // 推送成功后才落库心情 —— 生成/写库失败不应计入「被忽略」
  await saveMoodState(nextState);

  // 收尾消息落库成功后才打标记 —— 写库失败时不静音，留给下一次机会
  if (closing) {
    await markOffDuty(dateKey);
  }

  // MCP 工具 set_next_proactive_interval 已注入 generateMessage：
  // 模型调了工具 → scheduledByMcp=true → 返回 true 跳过 scheduleNext 兜底
  // 模型没调 / 不支持 tools → scheduledByMcp=false → 返回 false 让外层兜底 scheduleNext
  return scheduledByMcp;
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

/** MCP 工具允许设置的最大延迟（分钟）—— 2 小时，避免模型给出离谱数值 */
export const MAX_MANUAL_DELAY_MINUTES = 120;

/**
 * 按指定分钟数排下一次主动消息 —— 供 MCP 工具 `set_next_proactive_interval` 调用。
 *
 * 与随机排期不同，这里完全尊重调用方给的间隔（只做上下界夹取），
 * 用于「主人说 X 分钟后再找我」这类明确指令。
 * 若设置时间落在非工作时段，alarm 触发后 runProactiveMessage 会自行跳过并重新排期。
 *
 * @returns 实际生效的分钟数（夹取后的值）
 */
export async function scheduleProactiveMessageIn(
  minutes: number,
): Promise<number> {
  if (!chrome.alarms?.create) {
    throw new Error("chrome.alarms 不可用，无法设置主动消息间隔");
  }

  // minutes === 0 → 立即触发下一轮主动消息（不等时钟）
  if (minutes === 0) {
    await chrome.alarms.create(PROACTIVE_ALARM_NAME, { when: Date.now() });
    maLogger.info("[ProactiveChat] MCP 要求立即触发下一轮主动消息");
    return 0;
  }

  const safeMinutes = Math.min(
    MAX_MANUAL_DELAY_MINUTES,
    Math.max(MIN_DELAY_MINUTES, minutes),
  );

  await chrome.alarms.create(PROACTIVE_ALARM_NAME, {
    delayInMinutes: safeMinutes,
  });

  maLogger.info(
    `[ProactiveChat] MCP 设置下次主动消息间隔: ${safeMinutes} 分钟`,
  );
  return safeMinutes;
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
        '请检查 manifest 的 permissions 是否包含 "alarms"',
    );
    return;
  }

  // ── 启动时先过全局 AI 开关 + 主动聊天开关 ──
  void Promise.all([isAIChatEnabled(), isAIProactiveChatEnabled()]).then(
    async ([aiEnabled, proactiveEnabled]) => {
      if (!aiEnabled || !proactiveEnabled) {
        maLogger.info(
          "[ProactiveChat] 开关已关闭，清除主动对话 alarm",
          { aiEnabled, proactiveEnabled },
        );
        void chrome.alarms.clear(PROACTIVE_ALARM_NAME);
        return;
      }
      // 开关开着：保证 alarm 存在
      try {
        const existing = await chrome.alarms.get(PROACTIVE_ALARM_NAME);
        if (!existing) void scheduleNext();
      } catch (error) {
        maLogger.warn("[ProactiveChat] 读取 alarm 状态失败:", error);
        void scheduleNext();
      }
    },
  );

  // ── 全局 AI 开关变化监听（skipInitial：启动检查已覆盖初始值） ──
  onAIChatEnabledChange((enabled) => {
    if (!enabled) {
      maLogger.info(
        "[ProactiveChat] AI 聊天开关变为关闭，清除主动对话 alarm",
      );
      void chrome.alarms.clear(PROACTIVE_ALARM_NAME);
    } else {
      maLogger.info(
        "[ProactiveChat] AI 聊天开关变为开启，重新排期主动对话",
      );
      void scheduleNext();
    }
  }, true);

  // ── 主动聊天开关变化监听 ──
  onAIProactiveChatEnabledChange((enabled) => {
    if (!enabled) {
      maLogger.info(
        "[ProactiveChat] AI 自主式聊天开关变为关闭，清除主动对话 alarm",
      );
      void chrome.alarms.clear(PROACTIVE_ALARM_NAME);
    } else {
      maLogger.info(
        "[ProactiveChat] AI 自主式聊天开关变为开启，重新排期主动对话",
      );
      void scheduleNext();
    }
  }, true);

  if (!alarmListenerRegistered) {
    alarmListenerRegistered = true;
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== PROACTIVE_ALARM_NAME) return;

      void (async () => {
        // alarm 触发时再查一次开关 —— 防止 init 之后、alarm 到之前用户关了开关
        const [aiEnabled, proactiveEnabled] = await Promise.all([
          isAIChatEnabled(),
          isAIProactiveChatEnabled(),
        ]);
        if (!aiEnabled || !proactiveEnabled) {
          maLogger.info(
            "[ProactiveChat] alarm 触发但开关已关闭，跳过本次",
            { aiEnabled, proactiveEnabled },
          );
          return;
        }

        // runProactiveMessage 返回 true = 模型调了 MCP 工具精确排期，跳过兜底；
        // 返回 false = 模型没调 / 失败，走 scheduleNext 随机兜底
        let skipRandomSchedule = false;
        try {
          skipRandomSchedule = await runProactiveMessage();
        } catch (error) {
          maLogger.warn("[ProactiveChat] 主动对话执行失败:", error);
        }
        if (!skipRandomSchedule) {
          await scheduleNext();
        }
      })();
    });
  }
}
