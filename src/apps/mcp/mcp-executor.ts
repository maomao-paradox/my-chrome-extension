/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/mcp/mcp-executor.ts
 * @date 2026-02-05T02:38:01.690Z
 */

// MCP浏览器操作执行引擎，用于执行解析后的指令

import { waitForSelector } from '@/utils/element-control';
import type { MCPCommand } from './mcp-parser';

// 执行结果类型
export interface ExecuteResult {
  success: boolean;
  result?: any;
  error?: string;
  description?: string;
}

/**
 * 执行MCP指令
 * @param command 解析后的MCP指令
 * @returns 执行结果
 */
export async function executeMCPCommand(command: MCPCommand): Promise<ExecuteResult> {
  try {
    switch (command.action) {
      case 'click':
        return await executeClick(command);
      case 'input':
        return await executeInput(command);
      case 'navigate':
        return await executeNavigate(command);
      case 'get':
        return await executeGet(command);
      case 'execute':
        return await executeScript(command);
      default:
        return {
          success: false,
          error: `不支持的操作类型：${command.action}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `执行操作时发生错误：${error instanceof Error ? error.message : String(error)}`,
      description: command.description
    };
  }
}

/**
 * 执行点击操作
 * @param command 点击指令
 * @returns 执行结果
 */
async function executeClick(command: MCPCommand): Promise<ExecuteResult> {
  try {
    // 等待元素出现
    const elements = await waitForSelector({
      selector: command.selector,
      once: true,
      timeout: 5000
    });

    if (elements.length === 0) {
      return {
        success: false,
        error: `找不到元素：${command.selector}`,
        description: command.description
      };
    }

    const element = elements[0] as HTMLElement;
    element.click();

    return {
      success: true,
      result: '元素已点击',
      description: command.description
    };
  } catch (error) {
    return {
      success: false,
      error: `点击操作失败：${error instanceof Error ? error.message : String(error)}`,
      description: command.description
    };
  }
}

/**
 * 执行输入操作
 * @param command 输入指令
 * @returns 执行结果
 */
async function executeInput(command: MCPCommand): Promise<ExecuteResult> {
  try {
    // 等待元素出现
    const elements = await waitForSelector({
      selector: command.selector,
      once: true,
      timeout: 5000
    });

    if (elements.length === 0) {
      return {
        success: false,
        error: `找不到元素：${command.selector}`,
        description: command.description
      };
    }

    const element = elements[0] as HTMLInputElement | HTMLTextAreaElement;
    
    // 清除现有内容
    element.value = '';
    
    // 输入新内容
    element.value = command.value;
    
    // 触发必要的事件
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));

    return {
      success: true,
      result: `已输入文本：${command.value}`,
      description: command.description
    };
  } catch (error) {
    return {
      success: false,
      error: `输入操作失败：${error instanceof Error ? error.message : String(error)}`,
      description: command.description
    };
  }
}

/**
 * 执行导航操作
 * @param command 导航指令
 * @returns 执行结果
 */
async function executeNavigate(command: MCPCommand): Promise<ExecuteResult> {
  try {
    // 验证URL格式
    const url = command.value;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return {
        success: false,
        error: `无效的URL格式：${url}`,
        description: command.description
      };
    }

    // 执行导航
    window.location.href = url;

    return {
      success: true,
      result: `正在导航到：${url}`,
      description: command.description
    };
  } catch (error) {
    return {
      success: false,
      error: `导航操作失败：${error instanceof Error ? error.message : String(error)}`,
      description: command.description
    };
  }
}

/**
 * 执行获取信息操作
 * @param command 获取信息指令
 * @returns 执行结果
 */
async function executeGet(command: MCPCommand): Promise<ExecuteResult> {
  try {
    // 等待元素出现
    const elements = await waitForSelector({
      selector: command.selector,
      once: true,
      timeout: 5000
    });

    if (elements.length === 0) {
      return {
        success: false,
        error: `找不到元素：${command.selector}`,
        description: command.description
      };
    }

    const element = elements[0] as HTMLElement;
    let result: any;

    switch (command.value) {
      case 'text':
        result = element.textContent || '';
        break;
      case 'html':
        result = element.innerHTML;
        break;
      case 'value':
        result = (element as HTMLInputElement).value;
        break;
      case 'id':
        result = element.id;
        break;
      case 'className':
        result = element.className;
        break;
      case 'tagName':
        result = element.tagName;
        break;
      default:
        // 尝试获取自定义属性
        result = element.getAttribute(command.value) || '';
    }

    return {
      success: true,
      result,
      description: command.description
    };
  } catch (error) {
    return {
      success: false,
      error: `获取信息操作失败：${error instanceof Error ? error.message : String(error)}`,
      description: command.description
    };
  }
}

/**
 * 执行JavaScript代码
 * @param command 执行脚本指令
 * @returns 执行结果
 */
async function executeScript(command: MCPCommand): Promise<ExecuteResult> {
  try {
    // 执行JavaScript代码
    const result = eval(command.value);

    return {
      success: true,
      result,
      description: command.description
    };
  } catch (error) {
    return {
      success: false,
      error: `执行JavaScript代码失败：${error instanceof Error ? error.message : String(error)}`,
      description: command.description
    };
  }
}

/**
 * 批量执行MCP指令
 * @param commands MCP指令数组
 * @returns 执行结果数组
 */
export async function executeMultipleCommands(commands: MCPCommand[]): Promise<ExecuteResult[]> {
  const results: ExecuteResult[] = [];
  
  for (const command of commands) {
    const result = await executeMCPCommand(command);
    results.push(result);
    
    // 如果遇到失败，可以选择继续执行或停止
    // 这里选择继续执行所有指令
  }
  
  return results;
}