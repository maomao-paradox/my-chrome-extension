/**
 * @file service-worker/background/stream-manager.ts
 * @description 管理 AI 对话流式传输 —— 已集成记忆系统
 *
 * 记忆集成流程：
 *   1. startStream 收到 prompt 后，先调用 memoryService.buildContext(role, prompt)
 *      检索该角色相关的长期记忆 + 短期记忆 + 身份设定，拼成 assembledContext
 *   2. 把 assembledContext 追加到 systemPrompt 后面，传给 completeChatFlow
 *   3. 流式过程中累计 AI 返回的完整内容
 *   4. 对话完成后，调用 memoryService.observe(role, prompt, aiFullContent)
 *      让记忆系统自动提取值得记住的内容（用户偏好、事实信息等）
 *
 * 注意：记忆相关操作全部 try-catch，记忆系统失败不会阻塞对话主流程。
 */

import { completeChatFlow } from "../deepseek";
import type { ChatHistoryMessage } from "@/types/web-mcp";
import { getMemoryService } from "@/services/memory";

interface StreamConnection {
    port: chrome.runtime.Port;
}

export class StreamManager {
    private readonly connections = new Map<string, StreamConnection>();
    private readonly memoryService = getMemoryService();

    /**
     * 组装注入 system prompt 的记忆上下文
     * —— 纯辅助方法，方便测试
     */
    private async buildMemoryContext(
        role: string,
        prompt: string,
        baseSystemPrompt?: string,
    ): Promise<string | undefined> {
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
        try {
            await this.memoryService.observe(role, userPrompt, aiResponse);
        } catch (error) {
            console.warn("[Memory] observe failed:", error);
        }
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
        options?: {
            messages?: ChatHistoryMessage[];
            tools?: Array<{
                type: "function";
                function: {
                    name: string;
                    description?: string;
                    parameters: unknown;
                };
            }>;
            targetTabId?: number;
        },
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

        // 1. 异步构建记忆上下文（不阻塞主流程太久，超时降级）
        const systemPromptPromise = Promise.race([
            this.buildMemoryContext(role, prompt, systemPrompt),
            new Promise<string | undefined>((resolve) =>
                setTimeout(() => resolve(systemPrompt), 1500),
            ),
        ]);

        void systemPromptPromise.then((memoryEnhancedPrompt) => {
            void completeChatFlow(
                prompt,
                role,
                {
                    onData: (content) => {
                        if (!content) {
                            return;
                        }

                        // 累计完整内容供 observe 使用
                        aiFullContent += content;

                        // 记录首包时间
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
                    },
                    onError: (error) => {
                        const elapsed = Math.round(performance.now() - startTime);
                        console.error(`[AI Stream] ${messageId} 错误 (${elapsed}ms):`, error);
                        this.sendError(
                            port,
                            messageId,
                            error instanceof Error ? error.message : "未知错误",
                        );
                    },
                    onComplete: (result) => {
                        const totalElapsed = Math.round(performance.now() - startTime);
                        const generationTime = firstChunkTime
                            ? Math.round(performance.now() - firstChunkTime)
                            : null;
                        const functionCalls = result?.functionCalls ?? [];
                        console.log(`[AI Stream] ${messageId} 完成:`, {
                            totalTime: `${totalElapsed}ms`,
                            ttfb: firstChunkTime
                                ? `${Math.round(firstChunkTime - startTime)}ms`
                                : "N/A",
                            generationTime:
                                generationTime !== null ? `${generationTime}ms` : "N/A",
                            hasContent: hasSentData,
                        });

                        // 3. 对话完成后：让记忆系统观察学习
                        void this.observeConversation(role, prompt, aiFullContent);

                        if (!hasSentData && functionCalls.length === 0) {
                            this.sendError(
                                port,
                                messageId,
                                "AI 响应已完成，但没有返回可显示内容。请检查模型配置或后台流式解析日志。",
                            );
                            return;
                        }

                        try {
                            port.postMessage({
                                type: "AI_CONVERSATION_COMPLETE",
                                payload: { messageId, functionCalls },
                            });
                        } catch (error) {
                            console.warn("发送完成消息失败:", error);
                        }

                        this.connections.delete(messageId);
                    },
                },
                provider,
                model,
                apiKey,
                apiBaseUrl,
                memoryEnhancedPrompt, // ← 注入了记忆的 system prompt
                options,
            ).catch((error) => {
                const elapsed = Math.round(performance.now() - startTime);
                console.error(`[AI Stream] ${messageId} 流程异常 (${elapsed}ms):`, error);
                if (this.connections.has(messageId)) {
                    this.sendError(
                        port,
                        messageId,
                        error instanceof Error ? error.message : "未知错误",
                    );
                }
            });
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
