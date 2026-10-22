export interface OpenAIToolCallDelta {
  id: string;
  name: string;
  arguments: string;
}

export type OpenAIFunctionCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export function appendOpenAIToolCallDeltas(
  payload: Record<string, unknown>,
  accumulated: Map<number, OpenAIToolCallDelta>,
): void {
  if (!Array.isArray(payload.choices)) return;
  for (const choice of payload.choices) {
    if (!choice || typeof choice !== "object") continue;
    const delta = (choice as Record<string, unknown>).delta;
    if (!delta || typeof delta !== "object") continue;
    const toolCalls = (delta as Record<string, unknown>).tool_calls;
    if (!Array.isArray(toolCalls)) continue;

    for (const item of toolCalls) {
      if (!item || typeof item !== "object") continue;
      const call = item as Record<string, unknown>;
      const index = Number.isInteger(call.index) ? Number(call.index) : 0;
      const current = accumulated.get(index) ?? {
        id: "",
        name: "",
        arguments: "",
      };
      if (typeof call.id === "string") current.id += call.id;

      const fn = call.function;
      if (fn && typeof fn === "object") {
        const func = fn as Record<string, unknown>;
        if (typeof func.name === "string") current.name += func.name;
        if (typeof func.arguments === "string") {
          current.arguments += func.arguments;
        }
      }
      accumulated.set(index, current);
    }
  }
}

export function finalizeOpenAIToolCalls(
  accumulated: Map<number, OpenAIToolCallDelta>,
): OpenAIFunctionCall[] {
  return [...accumulated.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, call]) => {
      if (!call.name) {
        throw new Error(`流式工具调用 ${index} 缺少工具名称。`);
      }
      let args: unknown;
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        throw new Error(`工具 "${call.name}" 返回了无效的 JSON 参数。`);
      }
      if (!args || typeof args !== "object" || Array.isArray(args)) {
        throw new Error(`工具 "${call.name}" 的参数必须是 JSON 对象。`);
      }
      return {
        id: call.id || `call_${index}`,
        name: call.name,
        args: args as Record<string, unknown>,
      };
    });
}
