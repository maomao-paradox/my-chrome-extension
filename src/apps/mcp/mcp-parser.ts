/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/mcp/mcp-parser.ts
 * @date 2026-02-05T02:38:01.690Z
 */

// MCP指令解析引擎，用于解析AI生成的JSON指令

// 支持的操作类型
export type MCPActionType = 'click' | 'input' | 'navigate' | 'get' | 'execute';

// MCP指令类型
export interface MCPCommand {
  action: MCPActionType;
  selector: string;
  value: string;
  description: string;
}

// 解析结果类型
export interface ParseResult {
  success: boolean;
  command?: MCPCommand;
  error?: string;
}

// 支持的操作类型列表
const SUPPORTED_ACTIONS: MCPActionType[] = ['click', 'input', 'navigate', 'get', 'execute'];

/**
 * 从AI响应中提取JSON指令
 * AI可能会在响应中包含其他内容，需要提取纯JSON部分
 */
export function extractJSONFromResponse(response: string): string | null {
  try {
    // 尝试直接解析整个响应
    JSON.parse(response);
    return response;
  } catch (error) {
    // 如果直接解析失败，尝试提取JSON部分
    const jsonMatch = response.match(/\{[^}]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    return null;
  }
}

/**
 * 解析AI生成的指令
 * @param response AI生成的响应字符串
 * @returns 解析结果
 */
export function parseMCPCommand(response: string): ParseResult {
  try {
    // 从响应中提取JSON
    const jsonStr = extractJSONFromResponse(response);
    if (!jsonStr) {
      return {
        success: false,
        error: '无法从响应中提取有效的JSON指令'
      };
    }

    // 解析JSON
    const command = JSON.parse(jsonStr) as MCPCommand;

    // 验证必要字段
    if (!command.action || !command.description) {
      return {
        success: false,
        error: '指令缺少必要字段（action或description）'
      };
    }

    // 验证操作类型
    if (!SUPPORTED_ACTIONS.includes(command.action as MCPActionType)) {
      return {
        success: false,
        error: `不支持的操作类型：${command.action}，支持的操作类型：${SUPPORTED_ACTIONS.join(', ')}`
      };
    }

    // 验证特定操作类型的字段要求
    switch (command.action) {
      case 'click':
        // click操作不需要value，但需要selector
        if (!command.selector) {
          return {
            success: false,
            error: 'click操作缺少必要的selector字段'
          };
        }
        break;
      
      case 'input':
        // input操作需要selector和value
        if (!command.selector || command.value === undefined) {
          return {
            success: false,
            error: 'input操作缺少必要的selector或value字段'
          };
        }
        break;
      
      case 'navigate':
        // navigate操作需要value（URL），不需要selector
        if (!command.value) {
          return {
            success: false,
            error: 'navigate操作缺少必要的value字段（URL）'
          };
        }
        break;
      
      case 'get':
        // get操作需要selector和value（要获取的属性）
        if (!command.selector || !command.value) {
          return {
            success: false,
            error: 'get操作缺少必要的selector或value字段'
          };
        }
        break;
      
      case 'execute':
        // execute操作需要value（JavaScript代码），不需要selector
        if (!command.value) {
          return {
            success: false,
            error: 'execute操作缺少必要的value字段（JavaScript代码）'
          };
        }
        break;
    }

    // 指令验证通过
    return {
      success: true,
      command: {
        action: command.action as MCPActionType,
        selector: command.selector || '',
        value: command.value || '',
        description: command.description
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `指令解析失败：${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 批量解析AI生成的指令
 * AI可能会生成多个指令，需要逐个解析
 * @param response AI生成的响应字符串
 * @returns 解析结果数组
 */
export function parseMultipleCommands(response: string): ParseResult[] {
  // 简单实现：目前只支持单个指令
  // 后续可以扩展支持多个指令，如通过换行分隔或数组格式
  return [parseMCPCommand(response)];
}