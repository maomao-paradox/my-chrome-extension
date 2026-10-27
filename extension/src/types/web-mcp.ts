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

/** 可释放资源（注册的工具/监听器都应能取消） */
interface Disposable {
  dispose(): void;
}

/** 取消信号，AI 调用可能中途取消 */
interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): Disposable;
}

enum ToolType {
  OBJECT = "object",
  STRING = "string",
  NUMBER = "number",
  BOOLEAN = "boolean",
  ARRAY = "array",
}

/** JSON Schema 子集，用于约束工具入参 */
type JSONSchema = {
  type: ToolType;
  description?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: boolean | string[];
  enum?: readonly unknown[];
  default?: unknown;
} & Record<string, unknown>;

/** 工具执行结果：文本、结构化对象或富内容片段 */
type ToolResult = string | { type: string; [key: string]: unknown }[] | unknown;

/** 单个工具定义；TParams 与 execute 的入参强关联 */
interface ToolDefinition<
  TParams = Record<string, unknown>,
  TResult = ToolResult,
> {
  /** 工具名，建议「动词 + 对象」，如 `getWeather`、`readFile`，全局唯一 */
  name: string;
  /** 面向模型的自然语言说明：做什么、何时用、何时不要用。直接影响调用准确率 */
  description: string;
  /** 入参 JSON Schema，模型据此生成参数 */
  inputSchema: JSONSchema;
  /** 出参 JSON Schema，模型据此解析结果；可选，若不提供则默认是文本 */
  outputSchema?: JSONSchema;
  /** AI 调用该工具时执行的逻辑；入参已由 parameters 校验 */
  execute(params: TParams, context: ToolContext): TResult | Promise<TResult>;
  // 可选，元数据提示
  annotations?: any;
}

/** 执行期上下文，供工具读取取消状态、日志等 */
interface ToolContext {
  readonly cancellationToken: CancellationToken;
  readonly [key: string]: unknown;
}

/** 文档/编辑器暴露给模型的工具注册入口 */
export interface ModelContext extends EventTarget {
  /**
   * 注册一个可被 AI 调用的工具
   * @param tool 工具定义
   * @returns 取消注册的句柄
   */
  registerTool<TParams = Record<string, unknown>, TResult = ToolResult>(
    tool: ToolDefinition<TParams, TResult>,
  ): Disposable;
}
