/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/operation-log/OperationLogManager.ts
 * @date 2026-02-05T02:38:01.699Z
 */

import { generateId } from '../base';
import { OperationLog, LogType, OperationLogFilter } from '../../types/operation-log';
import { storage } from '../../assets/stores';

// 存储键名
const OPERATION_LOGS_KEY = 'operation_logs';
const CURRENT_SESSION_KEY = 'current_session_id';

class OperationLogManager {
  private sessionId: string;
  private logs: OperationLog[] = [];
  private isInitialized = false;
  private maxLogsPerSession = 1000; // 每个会话最大记录数

  constructor() {
    this.sessionId = this.getCurrentSessionId();
    this.initialize();
  }

  /**
   * 初始化日志管理器
   */
  private async initialize() {
    if (this.isInitialized) return;
    
    try {
      // 从存储加载现有日志
      const savedLogs = await storage.ext.local.get(OPERATION_LOGS_KEY, []);
      if (Array.isArray(savedLogs)) {
        this.logs = savedLogs;
      }
      
      this.isInitialized = true;
      maLogger.log('OperationLogManager initialized with', this.logs.length, 'logs');
    } catch (error) {
      maLogger.error('Failed to initialize OperationLogManager:', error);
      this.isInitialized = false;
    }
  }

  /**
   * 获取当前会话ID，不存在则创建
   */
  private async getCurrentSessionId(): Promise<string> {
    try {
      let sessionId = await storage.ext.local.get(CURRENT_SESSION_KEY);
      if (!sessionId) {
        sessionId = this.generateSessionId();
        await storage.ext.local.set(CURRENT_SESSION_KEY, sessionId);
      }
      return sessionId;
    } catch (error) {
      maLogger.error('Failed to get current session ID:', error);
      return this.generateSessionId();
    }
  }

  /**
   * 生成新的会话ID
   */
  private generateSessionId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 创建新会话
   */
  public async createNewSession(): Promise<string> {
    this.sessionId = this.generateSessionId();
    await storage.ext.local.set(CURRENT_SESSION_KEY, this.sessionId);
    return this.sessionId;
  }

  /**
   * 获取当前会话ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 记录操作日志
   */
  public async addLog(type: LogType, data: any, description?: string, relatedLogs?: string[]): Promise<OperationLog> {
    await this.initialize();
    
    const log: OperationLog = {
      id: generateId(),
      type,
      timestamp: Date.now(),
      data,
      relatedLogs,
      sessionId: this.sessionId,
      description
    };

    // 添加到日志列表
    this.logs.push(log);

    // 限制每个会话的日志数量
    this.trimLogs();

    // 保存到存储
    await this.saveLogs();

    return log;
  }

  /**
   * 限制日志数量
   */
  private trimLogs() {
    // 按会话分组
    const logsBySession = new Map<string, OperationLog[]>();
    
    this.logs.forEach(log => {
      if (!logsBySession.has(log.sessionId)) {
        logsBySession.set(log.sessionId, []);
      }
      logsBySession.get(log.sessionId)?.push(log);
    });

    // 对每个会话的日志按时间排序并限制数量
    this.logs = [];
    logsBySession.forEach((sessionLogs, sessionId) => {
      // 按时间倒序排序
      sessionLogs.sort((a, b) => b.timestamp - a.timestamp);
      // 保留最新的maxLogsPerSession条
      const trimmed = sessionLogs.slice(0, this.maxLogsPerSession);
      this.logs.push(...trimmed);
    });

    // 重新按时间排序
    this.logs.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 保存日志到存储
   */
  private async saveLogs() {
    try {
      await storage.ext.local.set(OPERATION_LOGS_KEY, this.logs);
    } catch (error) {
      maLogger.error('Failed to save operation logs:', error);
    }
  }

  /**
   * 获取所有日志
   */
  public async getAllLogs(): Promise<OperationLog[]> {
    await this.initialize();
    return [...this.logs].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 根据筛选条件获取日志
   */
  public async getLogs(filter: OperationLogFilter): Promise<OperationLog[]> {
    await this.initialize();
    
    return this.logs.filter(log => {
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
   * 获取特定会话的日志
   */
  public async getSessionLogs(sessionId: string): Promise<OperationLog[]> {
    return this.getLogs({ sessionId });
  }

  /**
   * 获取最近的日志
   */
  public async getRecentLogs(limit: number = 50): Promise<OperationLog[]> {
    await this.initialize();
    return [...this.logs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .reverse();
  }

  /**
   * 根据ID获取日志
   */
  public async getLogById(id: string): Promise<OperationLog | undefined> {
    await this.initialize();
    return this.logs.find(log => log.id === id);
  }

  /**
   * 删除指定日志
   */
  public async deleteLog(id: string): Promise<boolean> {
    await this.initialize();
    const initialLength = this.logs.length;
    this.logs = this.logs.filter(log => log.id !== id);
    
    if (this.logs.length < initialLength) {
      await this.saveLogs();
      return true;
    }
    return false;
  }

  /**
   * 删除指定会话的所有日志
   */
  public async deleteSessionLogs(sessionId: string): Promise<number> {
    await this.initialize();
    const initialLength = this.logs.length;
    this.logs = this.logs.filter(log => log.sessionId !== sessionId);
    
    const deletedCount = initialLength - this.logs.length;
    if (deletedCount > 0) {
      await this.saveLogs();
    }
    
    return deletedCount;
  }

  /**
   * 清除所有日志
   */
  public async clearAllLogs(): Promise<boolean> {
    try {
      this.logs = [];
      await storage.ext.local.set(OPERATION_LOGS_KEY, []);
      return true;
    } catch (error) {
      maLogger.error('Failed to clear all logs:', error);
      return false;
    }
  }

  /**
   * 获取日志统计信息
   */
  public async getStats() {
    await this.initialize();
    
    const stats = {
      total: this.logs.length,
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
    
    this.logs.forEach(log => {
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
}

// 导出单例实例
export const operationLogManager = new OperationLogManager();
