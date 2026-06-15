/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/operation-log/OperationLog.ts
 * @date 2026-02-05T02:38:01.697Z
 */

export enum LogType {
  NETWORK = 'network',
  COOKIE = 'cookie',
  LOCALHOST = 'localhost',
  USER_ACTION = 'user_action'
}

export interface OperationLog {
  id: string;           // 记录唯一ID
  type: LogType;        // 记录类型
  timestamp: number;    // 记录时间戳
  data: any;            // 记录详细数据
  relatedLogs?: string[]; // 关联记录ID
  sessionId: string;    // 会话ID，用于分组相关记录
  description?: string; // 记录描述
}

export interface OperationLogFilter {
  type?: LogType[];
  startTime?: number;
  endTime?: number;
  keywords?: string;
  sessionId?: string;
}

export interface OperationLogStats {
  total: number;
  byType: Record<LogType, number>;
  bySession: Record<string, number>;
  startTime: number;
  endTime: number;
}
