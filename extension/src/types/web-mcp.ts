export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: string;
  annotations?: string;
  frameId: number;
}

export interface WebMcpFunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChatHistoryMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}
