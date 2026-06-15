/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/mcp/mcp-context.ts
 * @date 2026-02-05T02:38:01.690Z
 */

// MCP上下文管理模块，用于管理对话历史和上下文信息

// 对话历史项类型
export interface ConversationItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// 上下文管理类
export class MCPContext {
  private history: ConversationItem[] = [];
  private maxHistoryLength = 10; // 最大历史记录长度

  // 添加对话记录
  addItem(role: ConversationItem['role'], content: string): void {
    const item: ConversationItem = {
      role,
      content,
      timestamp: Date.now()
    };
    
    this.history.push(item);
    
    // 限制历史记录长度
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift(); // 移除最早的记录
    }
  }

  // 获取对话历史
  getHistory(): ConversationItem[] {
    return [...this.history];
  }

  // 清空对话历史
  clearHistory(): void {
    this.history = [];
  }

  // 获取格式化的对话历史，用于AI提示词
  getFormattedHistory(): Array<{ role: string; content: string }> {
    return this.history.map(item => ({
      role: item.role,
      content: item.content
    }));
  }

  // 保存对话历史到本地存储
  saveToStorage(): void {
    try {
      localStorage.setItem('mcp-conversation-history', JSON.stringify(this.history));
    } catch (error) {
      maLogger.error('Failed to save conversation history:', error);
    }
  }

  // 从本地存储加载对话历史
  loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('mcp-conversation-history');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (error) {
      maLogger.error('Failed to load conversation history:', error);
      this.history = [];
    }
  }

  // 设置最大历史记录长度
  setMaxHistoryLength(length: number): void {
    this.maxHistoryLength = length;
    
    // 如果当前历史记录超过新的限制，截断
    if (this.history.length > length) {
      this.history = this.history.slice(-length);
    }
  }
}

// 导出单例实例
export const mcpContext = new MCPContext();