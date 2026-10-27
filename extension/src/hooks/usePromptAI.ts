import { useCallback, useRef, useState } from "react";
import { buildConfig } from "@/utils/config";
import { executeTool } from "@/utils/executeTool";
import { requestAI } from "@/service-worker/deepseek/ai-request";
import { loadAIConfig } from "@/service-worker/chrome-api";
import {
  buildTaskReminder,
  buildToolContinuationPrompt,
  limitToolResultForContext,
  trimPriorConversationHistory,
} from "@/utils/webMcpConversation";
import type {
  ChatHistoryMessage,
  WebMcpTool,
} from "@/types/web-mcp";

type ConversationMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
};

const MAX_TOOL_ROUNDS = 6;

const serializeToolResult = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

export function usePromptAI({
  tools,
  tabId,
}: {
  tools: WebMcpTool[];
  tabId: number | null;
}) {
  const historyRef = useRef<ChatHistoryMessage[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const promptAI = useCallback(
    async (userMessage: string): Promise<void> => {
      const prompt = userMessage.trim();
      if (!prompt || busy) return;
      if (typeof tabId !== "number") {
        setError("无法获取当前标签页。");
        return;
      }

      setBusy(true);
      setError("");
      setMessages((current) => [
        ...current,
        { role: "user", content: prompt },
        { role: "assistant", content: "" },
      ]);
      historyRef.current = trimPriorConversationHistory(historyRef.current);
      historyRef.current.push({ role: "user", content: prompt });

      try {
        const config = buildConfig(tools);
        const aiConfig = await loadAIConfig();
        const systemPrompt = [
          aiConfig.systemPrompt,
          ...config.systemInstruction,
        ]
          .filter((part) => part?.trim())
          .join("\n");
        const supportsToolCalls = !["anthropic", "google"].includes(
          aiConfig.provider.toLowerCase(),
        );
        let toolRounds = 0;
        let requestPrompt = prompt;
        let isContinuationRequest = false;

        while (true) {
          const result = await requestAI(requestPrompt, {
            systemPrompt,
            messages: isContinuationRequest
              ? [
                  ...historyRef.current,
                  { role: "user", content: buildTaskReminder(prompt) },
                ]
              : historyRef.current,
            tools: supportsToolCalls ? config.tools : [],
            targetTabId: tabId,
            onDelta: (delta) => {
              setMessages((current) => {
                const next = [...current];
                let index = -1;
                for (let cursor = next.length - 1; cursor >= 0; cursor -= 1) {
                  if (next[cursor].role === "assistant") {
                    index = cursor;
                    break;
                  }
                }
                if (index >= 0) {
                  next[index] = {
                    ...next[index],
                    content: next[index].content + delta,
                  };
                }
                return next;
              });
            },
          });

          if (!result.success) {
            throw new Error(result.error || "AI 请求失败。");
          }

          const functionCalls = result.functionCalls ?? [];
          historyRef.current.push({
            role: "assistant",
            content: result.content || null,
            ...(functionCalls.length
              ? {
                  tool_calls: functionCalls.map((call, index) => ({
                    id: call.id || `call_${toolRounds}_${index}`,
                    type: "function" as const,
                    function: {
                      name: call.name,
                      arguments: JSON.stringify(call.args),
                    },
                  })),
                }
              : {}),
          });

          if (functionCalls.length === 0) {
            if (!result.content.trim()) {
              throw new Error("AI 返回了空响应。");
            }
            return;
          }

          if (toolRounds >= MAX_TOOL_ROUNDS) {
            throw new Error(`AI 工具调用超过 ${MAX_TOOL_ROUNDS} 轮，已停止。`);
          }
          toolRounds += 1;

          const toolResults = await Promise.all(
            functionCalls.map(async (call, index) => {
              const availableTool = config.toolByName.get(call.name);
              let resultPayload: unknown;

              if (!availableTool) {
                resultPayload = {
                  error: `工具 "${call.name}" 不在当前页面的可用工具列表中。`,
                };
              } else {
                try {
                  const value = await executeTool(
                    tabId,
                    availableTool.name,
                    JSON.stringify(call.args),
                    availableTool.frameId,
                  );
                  resultPayload = { result: value };
                } catch (toolError) {
                  resultPayload = {
                    error:
                      toolError instanceof Error
                        ? toolError.message
                        : String(toolError),
                  };
                }
              }

              const toolCallId = call.id || `call_${toolRounds}_${index}`;
              const content = serializeToolResult(resultPayload);
              return { toolCallId, name: call.name, content };
            }),
          );
          for (const toolResult of toolResults) {
            historyRef.current.push({
              role: "tool",
              tool_call_id: toolResult.toolCallId,
              content: limitToolResultForContext(toolResult.content),
            });
            setMessages((current) => [
              ...current,
              { role: "tool", content: `${toolResult.name}: ${toolResult.content}` },
            ]);
          }
          requestPrompt = buildToolContinuationPrompt(prompt, toolResults);
          isContinuationRequest = true;

          setMessages((current) => [
            ...current,
            { role: "assistant", content: "" },
          ]);
        }
      } catch (promptError) {
        const message =
          promptError instanceof Error ? promptError.message : String(promptError);
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, tabId, tools],
  );

  const reset = useCallback(() => {
    historyRef.current = [];
    setMessages([]);
    setError("");
  }, []);

  return { promptAI, messages, busy, error, reset };
}
