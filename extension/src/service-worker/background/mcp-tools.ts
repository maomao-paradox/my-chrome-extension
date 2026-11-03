/**
 * @file service-worker/background/mcp-tools.ts
 * @description 内置 MCP 工具注册表（JSON-RPC 2.0）
 *
 * 设计原则：
 * - 工具调用统一使用标准 JSON-RPC 2.0 信封：
 *     请求 { jsonrpc: "2.0", id, method, params }
 *     成功 { jsonrpc: "2.0", id, result }
 *     失败 { jsonrpc: "2.0", id, error: { code, message } }
 * - 对模型暴露时再降维成 OpenAI function 声明（模型 API 只认 function schema）；
 *   执行侧仍然是 JSON-RPC，method 即工具名。
 * - 所有工具都在 background 执行，前端不参与。
 *
 * 新增工具只需：
 *   1. 在 LOCAL_MCP_TOOLS 里加一条 function 声明
 *   2. 在 TOOL_HANDLERS 里加一个同名 handler
 */

import type { OpenAICompatibleTool } from "../deepseek/openai-request";
import { scheduleProactiveMessageIn } from "./proactive-chat";
import { getMemoryService } from "@/services/memory";

/** memecub 表情包搜索接口 */
const MEMECUB_SEARCH_URL = "https://memecub.com/zh/search";

/**
 * 匹配 memecub 原图 URL
 * 固定前缀 https://gpic.code-nav.cn/memecub/public/ 写死，
 * 负向前瞻 (?!thumb) 排除缩略图子目录 thumb/ 和 thumb-s/，
 * 只匹配 public/ 下直接以文件 ID 开头的图片文件。
 */
const MEMECUB_IMAGE_REGEX =
  /https:\/\/gpic\.code-nav\.cn\/memecub\/public\/(?!thumb)[a-z0-9]+\.(?:gif|jpg|jpeg|png|webp)/g;

/** JSON-RPC 2.0 请求 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

/** JSON-RPC 2.0 错误对象 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** JSON-RPC 2.0 响应（成功或失败二选一） */
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number; result: unknown }
  | { jsonrpc: "2.0"; id: string | number; error: JsonRpcError };

/** JSON-RPC 2.0 标准错误码 */
const RPC_ERROR = {
  /** 找不到方法（工具不存在） */
  METHOD_NOT_FOUND: -32601,
  /** 参数不合法 */
  INVALID_PARAMS: -32602,
  /** 服务内部错误 */
  INTERNAL_ERROR: -32603,
} as const;

/** 工具名 —— 设置为下一次主动消息的间隔 */
export const SET_NEXT_PROACTIVE_INTERVAL = "set_next_proactive_interval";

/** 工具名 —— 获取表情包 */
export const GET_MEME = "get_meme";

/** 模型可见的工具声明 */
export const LOCAL_MCP_TOOLS: OpenAICompatibleTool[] = [
  {
    type: "function",
    function: {
      name: SET_NEXT_PROACTIVE_INTERVAL,
      description:
        "设置或调整下一次主动发消息的间隔（分钟）。你可以根据自己的心情主动调用，不必等主人开口：感到寂寞、想念主人时把间隔调短（例如 2~5 分钟，更频繁地主动找主人）；生气或伤心、暂时不想说话时把间隔调长（例如 60~120 分钟）；开心时保持平常节奏即可。当主人明确要求「X 分钟后再找我」「晚点再聊」时，优先按主人的要求设置。只影响下一次主动消息的时间，不改动其他设置。",
      parameters: {
        type: "object",
        properties: {
          minutes: {
            type: "number",
            description:
              "距离下一次主动消息的分钟数，范围 0.5~120。数值越小主动消息越频繁：寂寞时可设 2~5 分钟，生气或伤心时可设 60~120 分钟，主人口头指定时以主人为准。",
            minimum: 0.5,
            maximum: 120,
          },
        },
        required: ["minutes"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: GET_MEME,
      description:
        "可以根据心情主动发送一张表情包，例如你很生气，不想回复时，可以发一张生气的表情；你很开心，可以发一张开心的表情；不用每次对话都必须发送表情包，根据上下文语境判断是否发送。返回图片的完整 URL，你可以直接用 markdown 图片语法 ![meme](url) 展示给主人，或直接把 URL 放在回复里。",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description:
              "表情包的描述关键词，例如「猫猫很生气」「大肥鱼吃米饭」「打工人」「狗头」等。尽量简洁，1-5 个字效果最好。",
          },
        },
        required: ["description"],
        additionalProperties: false,
      },
    },
  },
];

/**
 * 工具 handler 签名：params 已从 JSON-RPC 请求中取出
 * 可选的 role 参数用于需要存储记忆的工具（如 get_meme）
 */
type ToolHandler = (
  params: Record<string, unknown>,
  context?: { role?: string },
) => Promise<unknown>;

/** 参数非法时抛出，带 JSON-RPC 错误码 */
class McpToolError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

/** 从 params 中读取有限数字 */
function readNumber(params: Record<string, unknown>, key: string): number {
  const raw = params[key];
  const value = typeof raw === "number" ? raw : Number(raw);

  if (!Number.isFinite(value)) {
    throw new McpToolError(
      RPC_ERROR.INVALID_PARAMS,
      `参数 "${key}" 必须是有限数字`,
    );
  }

  return value;
}

/**
 * 从 memecub 搜索页面提取原图 URL 列表
 * @param html memecub 搜索页的 HTML
 * @returns 去重后的原图 URL 数组
 */
function extractMemeUrls(html: string): string[] {
  const urls = new Set<string>();
  let match: RegExpExecArray | null;

  // 重置正则 lastIndex，确保每次调用都是从头开始
  MEMECUB_IMAGE_REGEX.lastIndex = 0;

  while ((match = MEMECUB_IMAGE_REGEX.exec(html)) !== null) {
    const fullUrl = match[0];
    // 确保不是缩略图路径（双重保险）
    if (!fullUrl.includes("/thumb") && !fullUrl.includes("/thumb-s")) {
      urls.add(fullUrl);
    }
  }

  return Array.from(urls);
}

/**
 * 从 memecub 搜索页获取随机一张表情包
 * @param description 表情包描述关键词
 * @returns 表情包图片 URL
 */
async function fetchRandomMeme(description: string): Promise<string> {
  const searchUrl = `${MEMECUB_SEARCH_URL}?q=${encodeURIComponent(description)}`;

  let html: string;
  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`memecub 搜索请求失败: HTTP ${response.status}`);
    }

    html = await response.text();
  } catch (error) {
    console.warn("[get_meme] fetch memecub 失败:", error);
    throw new McpToolError(
      RPC_ERROR.INTERNAL_ERROR,
      `表情包搜索服务暂时不可用：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const urls = extractMemeUrls(html);

  if (urls.length === 0) {
    throw new McpToolError(
      RPC_ERROR.INTERNAL_ERROR,
      `没找到与「${description}」相关的表情包，换个关键词试试？`,
    );
  }

  // 随机选一张
  return urls[Math.floor(Math.random() * urls.length)];
}

/** 内置工具实现表 —— method 与 LOCAL_MCP_TOOLS 中的 name 一一对应 */
const TOOL_HANDLERS: Record<string, ToolHandler> = {
  [SET_NEXT_PROACTIVE_INTERVAL]: async (params) => {
    const minutes = readNumber(params, "minutes");
    const appliedMinutes = await scheduleProactiveMessageIn(minutes);

    return {
      ok: true,
      minutes: appliedMinutes,
      scheduledAt: Date.now() + appliedMinutes * 60_000,
    };
  },

  [GET_MEME]: async (params, context) => {
    // description 可选：缺失时用随机默认词
    const description =
      typeof params.description === "string" && params.description.trim()
        ? params.description.trim()
        : (() => {
            const defaults = [
              "猫猫",
              "狗狗",
              "打工人",
              "开心",
              "笑哭",
              "狗头",
            ];
            return defaults[Math.floor(Math.random() * defaults.length)];
          })();

    const imageUrl = await fetchRandomMeme(description);

    // 存储表情包记录到记忆系统（category: episodic，不参与对话记忆）
    const role = context?.role;
    if (role) {
      try {
        const svc = getMemoryService();
        await svc.addEntry({
          role,
          content: `表情包：${description} → ${imageUrl}`,
          category: "episodic",
          importance: "low",
          source: "mcp:get_meme",
          tags: ["meme", description],
        });
      } catch (storeErr) {
        console.warn("[get_meme] 存储表情包记录失败:", storeErr);
        // 存储失败不影响主流程
      }
    }

    return {
      ok: true,
      description,
      imageUrl,
      message: `找到啦！一张关于「${description}」的表情包：${imageUrl}`,
    };
  },
};

/** 判断某个 function call 是否属于内置 MCP 工具 */
export function isLocalMcpTool(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(TOOL_HANDLERS, name);
}

/**
 * 执行一次 JSON-RPC 2.0 请求。
 * 无论成功失败都返回标准响应对象，不向外抛异常。
 *
 * @param request 标准 JSON-RPC 2.0 请求信封
 * @param context 可选的执行上下文（如 role），会透传给 handler
 */
export async function executeJsonRpcRequest(
  request: JsonRpcRequest,
  context?: { role?: string },
): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  const handler = TOOL_HANDLERS[method];
  if (!handler) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: RPC_ERROR.METHOD_NOT_FOUND,
        message: `未知的 MCP 工具: ${method}`,
      },
    };
  }

  if (params !== undefined && (typeof params !== "object" || params === null)) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: RPC_ERROR.INVALID_PARAMS,
        message: "params 必须是对象",
      },
    };
  }

  try {
    const result = await handler(
      (params ?? {}) as Record<string, unknown>,
      context,
    );
    return { jsonrpc: "2.0", id, result };
  } catch (error) {
    if (error instanceof McpToolError) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: error.code, message: error.message },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: RPC_ERROR.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * 便捷入口：按工具名 + 参数执行一次内置工具。
 * 内部自动包装成 JSON-RPC 2.0 请求，便于调用方无需关心信封格式。
 *
 * @param name 工具名（对应 TOOL_HANDLERS 的 key）
 * @param args 工具参数对象
 * @param context 可选的执行上下文（如 role），会透传给 handler
 */
export async function executeLocalMcpTool(
  name: string,
  args: Record<string, unknown>,
  context?: { role?: string },
): Promise<JsonRpcResponse> {
  return executeJsonRpcRequest(
    {
      jsonrpc: "2.0",
      id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: name,
      params: args,
    },
    context,
  );
}
