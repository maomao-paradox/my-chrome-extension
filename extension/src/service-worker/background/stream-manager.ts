/**
 * @file service-worker/background/stream-manager.ts
 * @description 管理 AI 对话流式传输 —— 已集成记忆系统
 *
 * 记忆集成流程：
 *   1. startStream 收到 prompt 后，先调用 memoryService.buildContext(role, prompt)
 *      检索该角色相关的长期记忆 + 短期记忆 + 身份设定，拼成 assembledContext
 *   2. 把 assembledContext 追加到 systemPrompt 后面，传给 completeChatFlow
 *   3. 流式过程中累计 AI 返回的完整内容
 *   4. 对话完成后，调用 memoryService.observe(...)
 *      让记忆系统自动提取值得记住的内容（用户偏好、事实信息等）
 *
 * 工具调用轮（内置 MCP 工具）：
 *   - 同一轮里模型可能「既说话又调用工具」：文本保留为一条 AI 回复，
 *     工具由后台执行（JSON-RPC 2.0），前端只收到 TOOL_CALL 通知
 *   - 工具执行结果拼成下一轮请求，再向模型请求一次
 *   - 下一轮模型自己决定：继续调用工具，还是直接返回文本
 *   - 循环上限 MAX_TOOL_ROUNDS；只有全程没有文本时才 skipPersist（不写记忆）
 *
 * 注意：记忆相关操作全部 try-catch，记忆系统失败不会阻塞对话主流程。
 */

import { completeChatFlow } from "../deepseek";
import type { ChatHistoryMessage } from "@/types/web-mcp";
import { getMemoryService, isFunctionalRole } from "@/services/memory";
import {
    LOCAL_MCP_TOOLS,
    executeLocalMcpTool,
    isLocalMcpTool,
} from "./mcp-tools";
import {
    MAX_TOOL_ROUNDS,
    buildToolResultPrompt,
    buildToolRoundMessages,
    type ToolExecutionResult,
} from "./tool-round-prompt";

/** 一次模型返回的工具调用 */
type ToolCall = { id: string; name: string; args: Record<string, unknown> };

/** 请求层的工具声明 */
interface StreamTool {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: unknown;
    };
}

/** 传给 completeChatFlow 的选项 */
interface StreamOptions {
    messages?: ChatHistoryMessage[];
    tools?: StreamTool[];
    targetTabId?: number;
    /** 是否注入内置 MCP 工具 —— 由对话窗口显式开启 */
    enableLocalMcpTools?: boolean;
    /** 用户上传的图片已上传成 file_id 列表 —— 让 AI "看到"用户的图 */
    fileIds?: string[];
}

interface StreamConnection {
    port: chrome.runtime.Port;
}

export class StreamManager {
    private readonly connections = new Map<string, StreamConnection>();
    private readonly memoryService = getMemoryService();

    /**
     * 组装注入 system prompt 的记忆上下文
     * —— 纯辅助方法，方便测试
     * —— 纯工具角色（graph_extractor / translator_* / textarea_ai_autofill ...）
     *    不需要记忆注入，直接返回 baseSystemPrompt 原样
     */
    private async buildMemoryContext(
        role: string,
        prompt: string,
        baseSystemPrompt?: string,
    ): Promise<string | undefined> {
        // 工具角色（表单填充 / 翻译 / 知识图谱）直接返回基础 prompt，
        // 不注入记忆上下文 —— 它们是一次性任务，"记得的事"反而产生噪音
        if (isFunctionalRole(role)) {
            return baseSystemPrompt;
        }
        try {
            const { assembledContext } = await this.memoryService.buildContext(role, prompt);
            if (!assembledContext) return baseSystemPrompt;

            // 合并：base prompt + 记忆上下文
            if (!baseSystemPrompt) return assembledContext;
            return `${baseSystemPrompt}\n\n${assembledContext}`;
        } catch (error) {
            console.warn("[Memory] buildContext failed, using base prompt only:", error);
            return baseSystemPrompt;
        }
    }

    /**
     * 让记忆系统观察这轮对话，自动提取值得记住的内容
     */
    private async observeConversation(
        role: string,
        userPrompt: string,
        aiResponse: string,
    ): Promise<void> {
        // 纯工具角色（graph_extractor / translator_* / textarea_ai_autofill ...）
        // 的输出通常是 JSON 或结构化数据，写入记忆会污染对话历史，跳过
        if (isFunctionalRole(role)) {
            return;
        }
        try {
            await this.memoryService.observe(role, userPrompt, aiResponse);
        } catch (error) {
            console.warn("[Memory] observe failed:", error);
        }
    }

    /**
     * 把内置 MCP 工具合并进本次请求的工具列表。
     * anthropic / google 链路目前不支持 tools（completeChatFlow 会直接抛错），
     * 因此这两个提供商保持原样，避免把原本可用的对话打断。
     */
    private withLocalMcpTools(
        provider: string | undefined,
        options?: StreamOptions,
    ) {
        const supportsTools =
            !provider || ["deepseek", "openai", "custom"].includes(provider);
        if (!supportsTools || !options?.enableLocalMcpTools) return options;

        return {
            ...options,
            tools: [...LOCAL_MCP_TOOLS, ...(options?.tools ?? [])],
        };
    }

    /**
     * 执行一轮模型对话，并把结果标准化成 { text, functionCalls }。
     *
     * 兼容两种返回形态：
     *   - 带 tools 的 DeepSeek 文本协议 → onComplete 一定带回 result
     *   - 不带 tools 的链路（anthropic / google）→ onComplete 无参数，
     *     用本轮流式累计的文本兜底
     */
    private runChatRound(params: {
        prompt: string;
        role: string;
        provider?: string;
        model?: string;
        apiKey?: string;
        apiBaseUrl?: string;
        systemPrompt?: string;
        options?: StreamOptions;
        onData: (content: string) => void;
    }): Promise<{ text: string; functionCalls: ToolCall[] }> {
        return new Promise((resolve, reject) => {
            let roundText = "";
            let settled = false;

            const fail = (error: unknown): void => {
                if (settled) return;
                settled = true;
                reject(error instanceof Error ? error : new Error(String(error)));
            };

            void completeChatFlow(
                params.prompt,
                params.role,
                {
                    onData: (content: string) => {
                        if (!content) return;
                        roundText += content;
                        params.onData(content);
                    },
                    onError: fail,
                    onComplete: (result) => {
                        if (settled) return;
                        settled = true;
                        resolve({
                            text:
                                typeof result?.text === "string"
                                    ? result.text
                                    : roundText,
                            functionCalls: result?.functionCalls ?? [],
                        });
                    },
                },
                params.provider,
                params.model,
                params.apiKey,
                params.apiBaseUrl,
                params.systemPrompt,
                params.options,
                params.options?.fileIds, // ← 用户图片的 file_id 列表
            ).catch(fail);
        });
    }

    /**
     * 依次执行内置 MCP 工具（JSON-RPC 2.0）。
     * 执行失败也返回错误信封 —— 下一轮模型需要知道「工具挂了」，才能决定怎么回复。
     *
     * @param messageId 本次对话的唯一标识（用于日志）
     * @param calls 模型返回的工具调用列表
     * @param role 当前对话角色（用于需要存储记忆的工具，如 get_meme）
     */
    private async executeLocalTools(
        messageId: string,
        calls: readonly ToolCall[],
        role?: string,
    ): Promise<ToolExecutionResult[]> {
        const results: ToolExecutionResult[] = [];

        for (const call of calls) {
            const args = call.args ?? {};
            try {
                // 把 role 作为 context 传入，让工具 handler 可以存储记忆
                const response = await executeLocalMcpTool(call.name, args, { role });
                results.push({ name: call.name, args, response });
                console.log(
                    `[MCP] ${messageId} 工具执行完成: ${call.name}`,
                    response,
                );
            } catch (toolError) {
                console.warn(
                    `[MCP] ${messageId} 工具执行异常: ${call.name}`,
                    toolError,
                );
                results.push({
                    name: call.name,
                    args,
                    response: {
                        error:
                            toolError instanceof Error
                                ? toolError.message
                                : String(toolError),
                    },
                });
            }
        }

        return results;
    }

    startStream(
        port: chrome.runtime.Port,
        prompt: string,
        messageId: string,
        role: string,
        provider?: string,
        model?: string,
        apiKey?: string,
        apiBaseUrl?: string,
        systemPrompt?: string,
        options?: StreamOptions,
        /** 入口层 runtime-connections.ts 已读取好的心情状态，传进来避免重复读 storage */
        mood?: ProactiveMood,
    ): void {
        const startTime = performance.now();
        console.log(
            "开始流式传输:",
            messageId,
            prompt,
            "角色:",
            role,
            "提供商:",
            provider,
            "模型:",
            model,
        );

        this.connections.set(messageId, { port });
        let hasSentData = false;
        let firstChunkTime: number | null = null;
        let aiFullContent = ""; // 累计 AI 完整响应，供 observe 学习

        /**
         * 统一的流式推送入口 —— 工具循环的每一轮都复用它。
         * 文本会照常实时推给前端，工具标记本身由 deepseek 层过滤。
         */
        const emitStreamData = (content: string): void => {
            if (!content) return;

            aiFullContent += content;

            if (!firstChunkTime) {
                firstChunkTime = performance.now();
                const ttfb = Math.round(firstChunkTime - startTime);
                console.log(`[AI Stream] ${messageId} 首包到达: ${ttfb}ms`);
            }

            try {
                hasSentData = true;
                port.postMessage({
                    type: "AI_CONVERSATION_STREAM_DATA",
                    payload: { messageId, content },
                });
            } catch (error) {
                console.warn("发送流式数据消息失败:", error);
                this.connections.delete(messageId);
            }
        };

        // 内置 MCP 工具 + 前端传入的页面工具（anthropic/google 不支持 tools 时保持原样）
        const effectiveOptions = this.withLocalMcpTools(provider, options);

        // 1. 异步构建记忆上下文（不阻塞主流程太久，超时降级）
        const systemPromptPromise = Promise.race([
            this.buildMemoryContext(role, prompt, systemPrompt),
            new Promise<string | undefined>((resolve) =>
                setTimeout(() => resolve(systemPrompt), 1500),
            ),
        ]);

        void systemPromptPromise.then((memoryEnhancedPrompt) => {
            void (async () => {
                try {
                    /* ══════════════════════════════════════════════════════════
                     * 工具调用轮循环
                     *   - 模型同一轮可能「既说话又调用工具」：
                     *       文本 = 一条 AI 回复（前端保留）
                     *       工具 = 后台执行（前端只看到 TOOL_CALL 通知）
                     *   - 工具结果拼成下一轮 user request，再请求一次模型
                     *   - 下一轮模型决定：继续调用工具，还是直接回复文本
                     *   - 硬上限 MAX_TOOL_ROUNDS，避免无限自调用
                     * ══════════════════════════════════════════════════════════ */
                    let roundPrompt = prompt;
                    let roundOptions = effectiveOptions;
                    let totalText = "";
                    let finalRoundText = "";
                    let remoteFunctionCalls: ToolCall[] = [];
                    let didExecuteTool = false;
                    let toolRounds = 0;

                    for (;;) {
                        const roundResult = await this.runChatRound({
                            prompt: roundPrompt,
                            role,
                            provider,
                            model,
                            apiKey,
                            apiBaseUrl,
                            systemPrompt: memoryEnhancedPrompt ?? systemPrompt,
                            options: roundOptions,
                            onData: emitStreamData,
                        });

                        const roundText = roundResult.text.trim();
                        if (roundText) {
                            totalText = totalText
                                ? `${totalText}\n${roundText}`
                                : roundText;
                            finalRoundText = roundText;
                        }

                        remoteFunctionCalls = roundResult.functionCalls.filter(
                            (call) => !isLocalMcpTool(call.name),
                        );
                        const localCalls = roundResult.functionCalls.filter((call) =>
                            isLocalMcpTool(call.name),
                        );
                        if (localCalls.length === 0) break;

                        const toolResults = await this.executeLocalTools(
                            messageId,
                            localCalls,
                            role,
                        );
                        didExecuteTool = true;

                        // 本轮文本已经流式显示 → 让前端把它留作一条回复；
                        // 没有文本则直接移除空占位
                        try {
                            port.postMessage({
                                type: "AI_CONVERSATION_TOOL_CALL",
                                payload: {
                                    messageId,
                                    calls: toolResults,
                                    text: roundText,
                                },
                            });
                        } catch (postErr) {
                            console.warn("发送 TOOL_CALL 失败:", postErr);
                        }

                        // 工具结果会回填给模型，所以下一轮先建一个占位气泡
                        try {
                            port.postMessage({
                                type: "AI_CONVERSATION_CONTINUING",
                                payload: { messageId },
                            });
                        } catch (postErr) {
                            console.warn("发送 CONTINUING(工具轮) 失败:", postErr);
                            break;
                        }

                        toolRounds += 1;
                        roundPrompt = buildToolResultPrompt(toolResults);
                        roundOptions = {
                            ...roundOptions,
                            // 工具轮用尽后禁用工具，逼模型这一轮直接回复文本
                            ...(toolRounds < MAX_TOOL_ROUNDS ? {} : { tools: [] }),
                            messages: buildToolRoundMessages(
                                roundOptions?.messages,
                                prompt,
                                roundText,
                                roundPrompt,
                            ),
                        };
                    }

                    // 既没有文本、也没有工具行为 → 认定为空响应
                    if (
                        !totalText &&
                        remoteFunctionCalls.length === 0 &&
                        !didExecuteTool
                    ) {
                        this.sendError(
                            port,
                            messageId,
                            "AI 响应已完成，但没有返回可显示内容。请检查模型配置或后台流式解析日志。",
                        );
                        return;
                    }

                    const totalElapsed = Math.round(performance.now() - startTime);
                    const generationTime = firstChunkTime
                        ? Math.round(performance.now() - firstChunkTime)
                        : null;
                    console.log(`[AI Stream] ${messageId} 完成:`, {
                        totalTime: `${totalElapsed}ms`,
                        ttfb: firstChunkTime
                            ? `${Math.round(firstChunkTime - startTime)}ms`
                            : "N/A",
                        generationTime:
                            generationTime !== null ? `${generationTime}ms` : "N/A",
                        hasContent: hasSentData,
                        usedTool: didExecuteTool,
                    });

                    // 观察基底用 totalText（各工具轮解析后的干净文本拼接），
                    // 而不是 aiFullContent（原始流式内容，可能夹带 <webmcp_tool_calls> 标记），
                    // 也不是 finalRoundText（仅最后一轮，会丢掉工具调用之前的首条回复）。
                    const allAiContent = totalText || aiFullContent;

                    // 只有真正产生了对话文本才交给记忆系统观察
                    if (allAiContent.trim()) {
                        void this.observeConversation(role, prompt, allAiContent);
                    }

                    // 发最终 COMPLETE —— 前端收到后触发 persistTurn
                    try {
                        port.postMessage({
                            type: "AI_CONVERSATION_COMPLETE",
                            payload: {
                                messageId,
                                functionCalls: remoteFunctionCalls,
                                // 纯工具轮没有留下任何文本 → 不写记忆
                                skipPersist: !totalText.trim(),
                            },
                        });
                    } catch (postErr) {
                        console.warn("发送 COMPLETE 失败:", postErr);
                    }

                    this.connections.delete(messageId);
                } catch (error) {
                    const elapsed = Math.round(performance.now() - startTime);
                    console.error(
                        `[AI Stream] ${messageId} 流程异常 (${elapsed}ms):`,
                        error,
                    );
                    this.sendError(
                        port,
                        messageId,
                        error instanceof Error ? error.message : "未知错误",
                    );
                }
            })();
        });

        port.onDisconnect.addListener(() => {
            console.log("端口断开连接:", messageId);
            this.connections.delete(messageId);
        });
    }

    private sendError(
        port: chrome.runtime.Port,
        messageId: string,
        error: string,
    ): void {
        try {
            port.postMessage({
                type: "AI_CONVERSATION_ERROR",
                payload: { messageId, error },
            });
            console.log("发送错误消息成功:", error);
        } catch (postError) {
            console.warn("发送错误消息失败:", postError);
        }

        this.connections.delete(messageId);
    }
}
