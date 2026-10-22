import type { ChatHistoryMessage } from "@/types/web-mcp";

export interface OpenAICompatibleTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
}

export interface OpenAICompatibleRequestOptions {
  messages?: ChatHistoryMessage[];
  tools?: OpenAICompatibleTool[];
}

export function buildOpenAICompatibleRequestBody(
  model: string,
  prompt: string,
  systemPrompt: string | undefined,
  options?: OpenAICompatibleRequestOptions,
): Record<string, unknown> {
  const messages = options?.messages?.length
    ? options.messages.map((message) => ({ ...message }))
    : [{ role: "user" as const, content: prompt }];

  if (
    systemPrompt &&
    !messages.some((message) => message.role === "system")
  ) {
    messages.unshift({ role: "system", content: systemPrompt });
  }

  return {
    model,
    messages,
    stream: true,
    ...(options?.tools?.length
      ? { tools: options.tools, tool_choice: "auto" }
      : {}),
  };
}
