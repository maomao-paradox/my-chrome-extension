/**
 * @file service-worker/background/tool-round-prompt.ts
 * @description 工具调用轮之间的衔接逻辑（纯函数）
 *
 * 目标流程：
 *   1. 模型在同一轮里可能「既想说话、又想调用工具」
 *   2. 后台把文本当成一条 AI 回复，把工具当后台动作，两者分开处理
 *   3. 工具执行结果再拼成下一轮的 user request，交回模型
 *   4. 下一轮模型自行决定：继续调用工具，还是直接用文本回复主人
 *
 * 抽成纯函数模块的原因：
 *   - 不依赖 chrome / AI 客户端，便于单测
 *   - 避免 stream-manager 的测试需要 mock 整套 completeChatFlow
 */

import type { ChatHistoryMessage } from "@/types/web-mcp";

/** 工具调用轮硬上限 —— 和连续回复一样，避免模型无限自调用 */
export const MAX_TOOL_ROUNDS = 3;

/** 一次工具执行的结果（回填给模型用） */
export interface ToolExecutionResult {
    /** 工具名 */
    name: string;
    /** 调用参数 */
    args: Record<string, unknown>;
    /** JSON-RPC 2.0 响应（成功或失败信封） */
    response: unknown;
}

/** 安全序列化 —— 参数里可能有循环引用或不可序列化的值 */
function safeStringify(value: unknown): string {
    try {
        const text = JSON.stringify(value);
        return text ?? String(value);
    } catch {
        return String(value);
    }
}

/**
 * 把工具执行结果拼成下一轮的 user request。
 *
 * 明确告诉模型「结果已经回来了，接下来你自己决定」，
 * 这样它才不会重复调用同一个工具、也不会把工具块当普通文本吐出来。
 */
export function buildToolResultPrompt(
    results: readonly ToolExecutionResult[],
): string {
    const lines = results.map((item) => {
        const args = safeStringify(item.args);
        const response = safeStringify(item.response);
        return `- ${item.name}(${args}) => ${response}`;
    });

    return [
        "[TOOL RESULTS]",
        ...lines,
        "",
        "工具已经执行完毕。请根据结果决定下一步：",
        "· 还需要调用工具 → 只输出一个 <webmcp_tool_calls> 块；",
        "· 不需要了 → 直接用自然语言回复主人，不要再输出任何工具块。",
    ].join("\n");
}

/**
 * 为下一轮请求准备聊天历史（主要给 OpenAI 兼容链路用；DeepSeek Web 走会话续写会忽略它）。
 *
 * @param baseMessages      当前轮已使用的 messages；为空时用原始 prompt 起头
 * @param originalPrompt    用户最初发送的内容
 * @param assistantText     本轮 AI 说的话（可能为空 —— 说明它只调用了工具）
 * @param toolResultPrompt  buildToolResultPrompt() 的输出
 */
export function buildToolRoundMessages(
    baseMessages: readonly ChatHistoryMessage[] | undefined,
    originalPrompt: string,
    assistantText: string,
    toolResultPrompt: string,
): ChatHistoryMessage[] {
    const messages: ChatHistoryMessage[] = baseMessages?.length
        ? baseMessages.map((message) => ({ ...message }))
        : [{ role: "user", content: originalPrompt }];

    const trimmed = assistantText.trim();
    if (trimmed) {
        messages.push({ role: "assistant", content: trimmed });
    }
    messages.push({ role: "user", content: toolResultPrompt });
    return messages;
}
