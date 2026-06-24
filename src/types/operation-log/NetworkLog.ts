/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/operation-log/NetworkLog.ts
 * @date 2026-02-05T02:38:01.697Z
 */

export interface NetworkLog {
  url: string;          // 请求URL
  method: string;       // 请求方法
  status: number;       // 响应状态码
  requestHeaders: Record<string, string>; // 请求头
  responseHeaders: Record<string, string>; // 响应头
  requestBody?: any;    // 请求体（根据配置决定是否记录）
  responseBody?: any;   // 响应体（根据配置决定是否记录）
  duration: number;     // 请求耗时（毫秒）
  initiator?: string;   // 请求发起者
  tabId?: number;       // 发起请求的标签页ID
  frameId?: number;     // 发起请求的帧ID
  requestId: string;    // Chrome分配的请求ID
  type: string;         // 请求类型（如main_frame、script、image等）
  fromCache: boolean;   // 是否来自缓存
  ip?: string;          // 服务器IP地址
  serverTiming?: any;   // 服务器计时信息
}

export interface NetworkLogConfig {
  recordRequestHeaders: boolean;
  recordResponseHeaders: boolean;
  recordRequestBody: boolean;
  recordResponseBody: boolean;
  maxResponseBodySize: number; // 最大记录响应体大小（字节）
  filterUrls?: string[];       // 筛选记录的URL
  ignoreUrls?: string[];       // 忽略记录的URL
}
