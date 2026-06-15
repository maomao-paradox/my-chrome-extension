/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/stores/operation-log.ts
 * @date 2026-02-05T02:38:01.697Z
 */

import { OperationLog, OperationLogFilter, LogType } from '@/assets/types/operation-log';
import storage from './chromestorge';

// 存储键名
const OPERATION_LOGS_KEY = 'operation_logs';
const CURRENT_SESSION_KEY = 'current_session_id';
const LOG_CONFIG_KEY = 'log_config';

// 日志配置接口
export interface LogConfig {
  maxLogs: number;
  recordRequestBody: boolean;
  recordResponseBody: boolean;
  maxResponseBodySize: number;
  ignoredDomains: string[];
  ignoredUrls: string[];
}

// 默认配置
const DEFAULT_CONFIG: LogConfig = {
  maxLogs: 1000,
  recordRequestBody: false,
  recordResponseBody: false,
  maxResponseBodySize: 1024 * 1024, // 1MB
  ignoredDomains: [],
  ignoredUrls: ['chrome-extension://', 'chrome://']
};

export class OperationLogStorage {
  /**
   * 保存操作日志
   */
  public async saveLogs(logs: OperationLog[]): Promise<void> {
    await storage.ext.local.set(OPERATION_LOGS_KEY, logs);
  }

  /**
   * 获取所有操作日志
   */
  public async getLogs(): Promise<OperationLog[]> {
    const logs = await storage.ext.local.get(OPERATION_LOGS_KEY, []);
    return Array.isArray(logs) ? logs : [];
  }

  /**
   * 根据筛选条件获取操作日志
   */
  public async getFilteredLogs(filter: OperationLogFilter): Promise<OperationLog[]> {
    const allLogs = await this.getLogs();

    return allLogs.filter(log => {
      // 类型筛选
      if (filter.type && filter.type.length > 0 && !filter.type.includes(log.type)) {
        return false;
      }

      // 时间范围筛选
      if (filter.startTime && log.timestamp < filter.startTime) {
        return false;
      }
      if (filter.endTime && log.timestamp > filter.endTime) {
        return false;
      }

      // 会话ID筛选
      if (filter.sessionId && log.sessionId !== filter.sessionId) {
        return false;
      }

      // 关键词筛选
      if (filter.keywords) {
        const keywords = filter.keywords.toLowerCase();
        const hasKeywords =
          log.description?.toLowerCase().includes(keywords) ||
          JSON.stringify(log.data).toLowerCase().includes(keywords);

        if (!hasKeywords) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 保存当前会话ID
   */
  public async saveCurrentSessionId(sessionId: string): Promise<void> {
    await storage.ext.local.set(CURRENT_SESSION_KEY, sessionId);
  }

  /**
   * 获取当前会话ID
   */
  public async getCurrentSessionId(): Promise<string | null> {
    return await storage.ext.local.get(CURRENT_SESSION_KEY);
  }

  /**
   * 保存日志配置
   */
  public async saveConfig(config: Partial<LogConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...config };
    await storage.ext.local.set(LOG_CONFIG_KEY, newConfig);
  }

  /**
   * 获取日志配置
   */
  public async getConfig(): Promise<LogConfig> {
    const config = await storage.ext.local.get(LOG_CONFIG_KEY);
    return { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 删除指定日志
   */
  public async deleteLog(logId: string): Promise<boolean> {
    const logs = await this.getLogs();
    const initialLength = logs.length;
    const filteredLogs = logs.filter(log => log.id !== logId);

    if (filteredLogs.length < initialLength) {
      await this.saveLogs(filteredLogs);
      return true;
    }
    return false;
  }

  /**
   * 删除指定会话的所有日志
   */
  public async deleteSessionLogs(sessionId: string): Promise<number> {
    const logs = await this.getLogs();
    const initialLength = logs.length;
    const filteredLogs = logs.filter(log => log.sessionId !== sessionId);

    const deletedCount = initialLength - filteredLogs.length;
    if (deletedCount > 0) {
      await this.saveLogs(filteredLogs);
    }

    return deletedCount;
  }

  /**
   * 清除所有日志
   */
  public async clearAllLogs(): Promise<void> {
    await storage.ext.local.remove(OPERATION_LOGS_KEY);
  }

  /**
   * 按类型统计日志数量
   */
  public async getLogStats(): Promise<{
    total: number;
    byType: Record<LogType, number>;
    bySession: Record<string, number>;
    startTime: number;
    endTime: number;
  }> {
    const logs = await this.getLogs();

    const stats = {
      total: logs.length,
      byType: {
        [LogType.NETWORK]: 0,
        [LogType.COOKIE]: 0,
        [LogType.LOCALHOST]: 0,
        [LogType.USER_ACTION]: 0
      },
      bySession: {} as Record<string, number>,
      startTime: Infinity,
      endTime: 0
    };

    logs.forEach(log => {
      // 按类型统计
      stats.byType[log.type]++;

      // 按会话统计
      if (!stats.bySession[log.sessionId]) {
        stats.bySession[log.sessionId] = 0;
      }
      stats.bySession[log.sessionId]++;

      // 更新时间范围
      stats.startTime = Math.min(stats.startTime, log.timestamp);
      stats.endTime = Math.max(stats.endTime, log.timestamp);
    });

    // 如果没有日志，重置时间范围
    if (stats.total === 0) {
      stats.startTime = stats.endTime = Date.now();
    }

    return stats;
  }

  /**
   * 导出日志为JSON
   */
  public async exportLogs(filter?: OperationLogFilter): Promise<string> {
    const logs = filter ? await this.getFilteredLogs(filter) : await this.getLogs();
    return JSON.stringify(logs, null, 2);
  }

  /**
   * 导入日志
   */
  public async importLogs(jsonData: string): Promise<number> {
    try {
      const importedLogs = JSON.parse(jsonData) as OperationLog[];
      if (!Array.isArray(importedLogs)) {
        throw new Error('Invalid log format');
      }

      const existingLogs = await this.getLogs();
      const mergedLogs = [...existingLogs, ...importedLogs];
      await this.saveLogs(mergedLogs);

      return importedLogs.length;
    } catch (error) {
      maLogger.error('Failed to import logs:', error);
      throw new Error('Failed to import logs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

// 导出单例实例
export const operationLogStorage = new OperationLogStorage();
