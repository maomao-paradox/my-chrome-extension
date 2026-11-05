/**
 * @file src/service-worker/background/slash-commands.ts
 * @description 斜杠指令拦截层 —— AI 请求前的本地命令处理
 *
 * 设计原则：
 *   1. 指令在 background 层最早拦截（runtime-connections.START_AI_CONVERSATION），
 *      拦截后立即返回前端确认消息，**不进入** completeChatFlow / observeConversation 链路。
 *   2. 指令本身和指令结果**不写入记忆** —— 它们是用户显式控制，不是对话内容。
 *   3. 只处理 `/xxx` 开头的纯指令，任何后续文本（比如 `/new 新主题`）当前忽略，
 *      未来可以扩展成带参数指令。
 *
 * 已实现指令：
 *   /new   —— 重置 DeepSeek session，让后续对话脱离历史上下文
 */

import { clearSessionData } from "../deepseek";

/** 指令匹配 —— 以 `/` 开头，后接字母/数字/下划线/短横线 */
const SLASH_COMMAND_RE = /^\/([a-zA-Z][\w-]*)(?:\s.*)?$/;

/** 单个指令的 handler */
export interface SlashCommandHandler {
    /** 执行指令；返回给前端的确认文本（空则不发） */
    (ctx: SlashCommandContext): Promise<string | void> | string | void;
}

/** handler 收到的上下文 */
export interface SlashCommandContext {
    /** 用户输入原文（可能带参数） */
    rawInput: string;
    /** 指令名（小写），如 "new" */
    command: string;
    /** 指令后的参数文本（trim 后），空字符串表示无参数 */
    args: string;
    /** 当前对话角色（用于清 session 等） */
    role: string;
}

/** 指令注册表 —— 未来扩展时直接 push */
const HANDLERS: Record<string, SlashCommandHandler> = {
    new: handleNew,
};

/**
 * 解析并尝试执行一条斜杠指令
 * @returns { handled: true, reply: "..." } 拦截成功，调用方应直接回复前端；
 *          { handled: false } 不是指令，继续走正常 AI 对话链路
 */
export async function tryHandleSlashCommand(
    prompt: string,
    role: string,
): Promise<
    | { handled: true; reply: string }
    | { handled: false; command?: undefined }
> {
    const match = prompt.trim().match(SLASH_COMMAND_RE);
    if (!match) return { handled: false };

    const command = match[1].toLowerCase();
    const args = prompt.trim().slice(match[0].length).trim();

    const handler = HANDLERS[command];
    if (!handler) {
        return {
            handled: true,
            reply: `未知指令「/${command}」，当前可用：${Object.keys(HANDLERS)
                .map((c) => `/${c}`)
                .join(" ")}`,
        };
    }

    const reply = await handler({ rawInput: prompt, command, args, role });
    return {
        handled: true,
        reply: reply ?? `「/${command}」已执行`,
    };
}

// ─── 具体指令实现 ───

/**
 * /new —— 重置 DeepSeek session + parent_message_id
 *   清除：
 *     - chat_session_id（新对话上下文）
 *     - parent_message_id（每次对话 +2，重置为 null → 首轮对话后变成 2）
 *     - 内存 session 缓存
 *   下一次对话会自动创建新的 session，脱离历史上下文。
 *   不影响：记忆系统（记忆写入照常，只是 observe 不会收到这一轮的 AI 回复）
 */
async function handleNew(ctx: SlashCommandContext): Promise<string> {
    await clearSessionData(ctx.role);
    return `好的主人，新对话开始喵～ 之前的上下文已经清掉啦 (ฅ´ω\`ฅ)`;
}
