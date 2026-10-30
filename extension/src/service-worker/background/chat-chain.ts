/**
 * @file service-worker/background/chat-chain.ts
 * @description 心情驱动的连续回复核心模块
 *
 * 职责分层：
 *   1. 概率计算 —— 纯函数，无状态、无 chrome.storage 依赖
 *      computeNextProbability(base, round): 递减公式 base * 0.5^(round-1)
 *      shouldTrigger(prob): 掷骰 Math.random() < prob
 *
 *   2. 提示词生成 —— buildFollowupPrompt(ctx)
 *      两种场景共用一个 builder："proactive"（主动对话续轮）和 "user-dialog"（用户对话续轮）
 *
 *   3. AI 生成 —— generateFollowupReply(role, systemPrompt, followupPrompt, options)
 *      完全照搬 proactive-chat.ts 的 generateMessage 模式：
 *        Promise 包回调 + 30 秒超时看门狗 + 流式 chunks 拼接
 *      ⚠️ 刻意不接受 fileIds —— 续轮不带截图
 *
 * 依赖：
 *   completeChatFlow  —— 统一走 deepseek 模块的底层 AI 调用
 *   loadAIConfig      —— 从 chrome.storage 读取 AI 模型配置
 */

import { completeChatFlow } from "../deepseek";
import { loadAIConfig } from "../chrome-api/ai-config";

/* ══════════════════════════════════════════════════════════════════
 * 常量
 * ══════════════════════════════════════════════════════════════════ */

/** 连续回复硬上限 —— 避免无限循环浪费 token */
export const MAX_CONTINUOUS_ROUNDS = 3;

/** 概率低于此值强制停止 —— 几乎不可能再触发 */
export const MIN_PROBABILITY = 0.05;

/** AI 调用超时（毫秒）—— 续轮消息短，给 20s 就够（比主动对话 30s 少 10s） */
const FOLLOWUP_TIMEOUT_MS = 20_000;

/** 续轮消息最大长度（码点）—— 短 prompt + 短输出，严格控制 token */
const MAX_FOLLOWUP_LENGTH = 80;

/* ══════════════════════════════════════════════════════════════════
 * 纯函数 —— 概率计算 + 掷骰
 * ══════════════════════════════════════════════════════════════════ */

/**
 * 计算当前轮次的触发概率。
 * 递减公式：baseProb * (0.5 ^ (round - 1))
 *   round=1 → baseProb
 *   round=2 → baseProb * 0.5
 *   round=3 → baseProb * 0.25
 *   round≥4 → 由 MAX_CONTINUOUS_ROUNDS 在循环层面拦截，这里返回 0 兜底
 *
 * @returns 当前轮次的触发概率；≤ 0 表示应该停止
 */
export function computeNextProbability(
    baseProb: number,
    currentRound: number,
): number {
    if (currentRound < 1) return 0;
    if (currentRound >= MAX_CONTINUOUS_ROUNDS) return 0;

    const prob = baseProb * Math.pow(0.5, currentRound - 1);
    if (prob <= MIN_PROBABILITY) return 0;
    return prob;
}

/**
 * 掷骰判断 —— Math.random() < probability。
 *
 * @param probability 触发概率，范围 [0, 1]
 * @returns true = 命中，应该触发连续回复；false = 不命中，停止续轮
 */
export function shouldTrigger(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return Math.random() < probability;
}

/* ══════════════════════════════════════════════════════════════════
 * 提示词生成
 * ══════════════════════════════════════════════════════════════════ */

/** 续轮提示词 builder 的上下文 */
export interface FollowupContext {
    /** 场景：主动对话续轮 / 用户对话续轮 */
    scenario: "proactive" | "user-dialog";
    /** describeMood() 输出的心情描述 —— 让续轮保持心情一致性 */
    moodPrompt: string;
    /** 上一条消息（主动场景 = AI 的开场白；对话场景 = 用户问题） */
    lastMessage: string;
    /** 当前是第几次续轮 —— 第 1 次续轮是"多说一句"，第 2 次就可能没那么多了 */
    round: number;
}

/**
 * 构建连续回复的提示词（传给 AI 的 user request 部分）。
 * 两种场景共享同一个 builder，通过 scenario 参数切换措辞。
 */
export function buildFollowupPrompt(ctx: FollowupContext): string {
    const { scenario, moodPrompt, lastMessage, round } = ctx;

    const base = scenario === "proactive"
        ? "你刚才主动和主人说了一句话，但你还有些没聊完。"
        : "你刚才回答了主人的问题，但你觉得还可以补充一些内容。";

    const lengthHint = round === 1
        ? "自然地再补充 **1 句**"
        : round === 2
          ? "再简短地说 **半句话**"
          : "再用 **1 到 2 个短语**";

    return [
        base,
        `[当前心情] ${moodPrompt}`,
        `[上一条消息] "${lastMessage}"`,
        `行为要求：${lengthHint}。不要重述、不要提问、不要换话题、不要改变语气。不超过 ${MAX_FOLLOWUP_LENGTH} 字。`,
    ].join("\n\n");
}

/* ══════════════════════════════════════════════════════════════════
 * AI 生成
 * ══════════════════════════════════════════════════════════════════ */

/** generateFollowupReply 的 AI 配置参数 —— 从调用方传入，避免内部重复 loadAIConfig */
export interface FollowupAIConfig {
    provider?: string;
    modelId?: string;
    apiKey?: string;
    apiBaseUrl?: string;
}

/**
 * 生成连续回复的 AI 调用。
 * 完全照搬 proactive-chat.ts 的 generateMessage 模式：
 *   Promise 包回调式 completeChatFlow + 超时看门狗 + 流式 chunks 拼接。
 *
 * ⚠️ 刻意不接受 fileIds —— 只有每轮的首条消息才截图（captureVisibleTab），
 *    续轮复用首条已经上传的截图（或干脆不带图），
 *    避免每次续轮都 captureVisibleTab + uploadFile 的双重开销。
 *
 * @param role           角色 key —— completeChatFlow 需要
 * @param systemPrompt   已组装好的 system prompt（含身份 + 记忆 + 心情描述）
 * @param followupPrompt buildFollowupPrompt() 的输出 —— 本轮的 user request
 * @param aiConfig       AI 配置 —— 从调用方传入，若全部为空则内部 loadAIConfig
 * @returns AI 返回的文本（已 trim + 按码点裁剪）
 * @throws 配置不可用 / 请求失败 / 超时 / 空结果时抛出，由调用方 catch 并 break 续轮
 */
export async function generateFollowupReply(
    role: string,
    systemPrompt: string,
    followupPrompt: string,
    aiConfig?: FollowupAIConfig,
): Promise<string> {
    // 如果调用方没给完整配置，内部兜底 loadAIConfig
    let effectiveProvider = aiConfig?.provider;
    let effectiveModelId = aiConfig?.modelId;
    let effectiveApiKey = aiConfig?.apiKey;
    let effectiveApiBaseUrl = aiConfig?.apiBaseUrl;

    if (!effectiveApiKey && !effectiveProvider) {
        const fullConfig = await loadAIConfig();
        if (fullConfig) {
            effectiveProvider ??= fullConfig.provider;
            effectiveModelId ??= fullConfig.modelId;
            effectiveApiKey ??= fullConfig.apiKey;
            effectiveApiBaseUrl ??= fullConfig.apiBaseUrl;
        }
    }

    const chunks: string[] = [];

    // Promise 包回调 + 超时看门狗 —— 与 proactive-chat.ts 的 generateMessage 完全一致
    await new Promise<void>((resolve, reject) => {
        let settled = false;

        const finish = (error?: Error): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            error ? reject(error) : resolve();
        };

        const timeoutId = setTimeout(() => {
            finish(new Error("连续回复 AI 生成超时"));
        }, FOLLOWUP_TIMEOUT_MS);

        void completeChatFlow(
            followupPrompt,
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
            effectiveProvider,
            effectiveModelId,
            effectiveApiKey,
            effectiveApiBaseUrl,
            systemPrompt,
            // options —— 不传 tools / messages / targetTabId，续轮不需要这些
            undefined,
            // ⚠️ fileIds 刻意不传 —— 续轮不带截图
        )
            .then(() => finish())
            .catch((error: unknown) => {
                finish(error instanceof Error ? error : new Error(String(error)));
            });
    });

    const text = chunks.join("").trim();
    if (!text) {
        throw new Error("AI 返回了空的连续回复");
    }

    // 按码点裁剪，避免 emoji 被切坏
    return Array.from(text).slice(0, MAX_FOLLOWUP_LENGTH).join("");
}
