/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/operation-log/LocalhostLog.ts
 * @date 2026-02-05T02:38:01.697Z
 */

export enum LocalhostChangeType {
  REQUEST = 'request',
  RESPONSE = 'response',
  DOM_CHANGE = 'dom_change',
  RESOURCE_LOAD = 'resource_load',
  SERVER_START = 'server_start',
  SERVER_STOP = 'server_stop'
}

export interface LocalhostLog {
  type: LocalhostChangeType;  // 变化类型
  url: string;                // 相关URL
  data?: any;                 // 详细数据
  tabId?: number;             // 关联的标签页ID
  timestamp: number;          // 变化时间戳
  duration?: number;          // 耗时（毫秒）
}

export interface LocalhostChange {
  element?: string;           // 变化的DOM元素
  property?: string;          // 变化的属性
  oldValue?: any;             // 旧值
  newValue?: any;             // 新值
  selector?: string;          // DOM选择器
}

export interface LocalhostResource {
  url: string;                // 资源URL
  type: string;               // 资源类型（script、image、css等）
  size?: number;              // 资源大小
  duration?: number;          // 加载耗时
  status?: number;            // 加载状态码
}
