/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/operation-log/NetworkMonitor.ts
 * @date 2026-02-05T02:38:01.699Z
 */

import { operationLogManager } from './OperationLogManager';
import { LogType, NetworkLog } from '@/assets/types/operation-log';

// 记录请求的临时存储，用于跟踪请求生命周期
interface PendingRequest {
  requestId: string;
  startTime: number;
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  requestBody?: any;
  tabId?: number;
  frameId?: number;
  type: string;
  initiator?: string;
}

class NetworkMonitor {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isMonitoring = false;
  private config = {
    recordRequestBody: false,
    recordResponseBody: false,
    maxResponseBodySize: 1024 * 1024, // 1MB
    ignoreUrls: ['chrome-extension://', 'chrome://']
  };

  /**
   * 开始监控网络请求
   */
  public startMonitoring() {
    if (this.isMonitoring) return;

    // 监听请求发送前事件
    chrome.webRequest.onBeforeRequest.addListener(
      this.handleBeforeRequest.bind(this),
      { urls: ['*://*/*'] },
      ['requestBody']
    );

    // 监听请求头发送事件
    chrome.webRequest.onBeforeSendHeaders.addListener(
      this.handleBeforeSendHeaders.bind(this),
      { urls: ['*://*/*'] },
      ['requestHeaders']
    );

    // 监听响应头接收事件
    chrome.webRequest.onHeadersReceived.addListener(
      this.handleHeadersReceived.bind(this),
      { urls: ['*://*/*'] },
      ['responseHeaders']
    );

    // 监听请求完成事件
    chrome.webRequest.onCompleted.addListener(
      this.handleCompleted.bind(this),
      { urls: ['*://*/*'] }
    );

    // 监听请求错误事件
    chrome.webRequest.onErrorOccurred.addListener(
      this.handleErrorOccurred.bind(this),
      { urls: ['*://*/*'] }
    );

    this.isMonitoring = true;
    maLogger.log('Network monitoring started');
  }

  /**
   * 停止监控网络请求
   */
  public stopMonitoring() {
    if (!this.isMonitoring) return;

    // 移除所有监听器
    chrome.webRequest.onBeforeRequest.removeListener(this.handleBeforeRequest.bind(this));
    chrome.webRequest.onBeforeSendHeaders.removeListener(this.handleBeforeSendHeaders.bind(this));
    chrome.webRequest.onHeadersReceived.removeListener(this.handleHeadersReceived.bind(this));
    chrome.webRequest.onCompleted.removeListener(this.handleCompleted.bind(this));
    chrome.webRequest.onErrorOccurred.removeListener(this.handleErrorOccurred.bind(this));

    this.isMonitoring = false;
    this.pendingRequests.clear();
    maLogger.log('Network monitoring stopped');
  }

  /**
   * 检查URL是否应该被忽略
   */
  private shouldIgnoreUrl(url: string): boolean {
    return this.config.ignoreUrls.some(ignoreUrl => url.startsWith(ignoreUrl));
  }

  /**
   * 处理请求发送前事件
   */
  private handleBeforeRequest(details: chrome.webRequest.WebRequestDetails) {
    if (this.shouldIgnoreUrl(details.url)) return;

    const pendingRequest: PendingRequest = {
      requestId: details.requestId,
      startTime: Date.now(),
      url: details.url,
      method: details.method || 'GET',
      requestHeaders: {},
      tabId: details.tabId,
      frameId: details.frameId,
      type: details.type || 'other',
      initiator: details.initiator
    };

    // 记录请求体（如果配置了）
    if (this.config.recordRequestBody && details.requestBody) {
      try {
        pendingRequest.requestBody = details.requestBody;
      } catch (error) {
        maLogger.error('Failed to record request body:', error);
      }
    }

    this.pendingRequests.set(details.requestId, pendingRequest);
  }

  /**
   * 处理请求头发送事件
   */
  private handleBeforeSendHeaders(details: chrome.webRequest.WebRequestHeadersDetails) {
    const pendingRequest = this.pendingRequests.get(details.requestId);
    if (!pendingRequest) return;

    // 转换请求头格式
    if (details.requestHeaders) {
      pendingRequest.requestHeaders = this.headersArrayToObject(details.requestHeaders);
    }

    this.pendingRequests.set(details.requestId, pendingRequest);
  }

  /**
   * 处理响应头接收事件
   */
  private async handleHeadersReceived(details: chrome.webRequest.WebResponseHeadersDetails) {
    const pendingRequest = this.pendingRequests.get(details.requestId);
    if (!pendingRequest) return;

    // 这里可以处理响应头，但完整的请求记录需要等到请求完成
  }

  /**
   * 处理请求完成事件
   */
  private async handleCompleted(details: chrome.webRequest.WebResponseCacheDetails) {
    await this.handleRequestDone(details, null);
  }

  /**
   * 处理请求错误事件
   */
  private async handleErrorOccurred(details: chrome.webRequest.WebResponseErrorDetails) {
    await this.handleRequestDone(details, details.error);
  }

  /**
   * 处理请求完成或错误
   */
  private async handleRequestDone(details: chrome.webRequest.WebResponseDetails, error?: string) {
    const pendingRequest = this.pendingRequests.get(details.requestId);
    if (!pendingRequest) return;

    // 计算请求耗时
    const duration = Date.now() - pendingRequest.startTime;

    // 转换响应头格式
    const responseHeaders = this.headersArrayToObject(details.responseHeaders || []);

    // 构建网络日志
    const networkLog: NetworkLog = {
      url: pendingRequest.url,
      method: pendingRequest.method,
      status: details.statusCode || (error ? 0 : 200),
      requestHeaders: pendingRequest.requestHeaders,
      responseHeaders,
      requestBody: pendingRequest.requestBody,
      duration,
      initiator: pendingRequest.initiator,
      tabId: pendingRequest.tabId,
      frameId: pendingRequest.frameId,
      requestId: details.requestId,
      type: pendingRequest.type,
      fromCache: details.fromCache || false,
      ip: (details as any).ip
    };

    // 记录操作日志
    await operationLogManager.addLog(
      LogType.NETWORK,
      networkLog,
      `${pendingRequest.method} ${pendingRequest.url} ${details.statusCode || 'ERROR'}`,
      [pendingRequest.requestId]
    );

    // 移除临时记录
    this.pendingRequests.delete(details.requestId);
  }

  /**
   * 将Chrome的HeadersArray转换为Record对象
   */
  private headersArrayToObject(headers: chrome.webRequest.HttpHeader[]): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const header of headers) {
      if (header.name) {
        result[header.name.toLowerCase()] = header.value || '';
      }
    }
    
    return result;
  }

  /**
   * 更新监控配置
   */
  public updateConfig(config: Partial<typeof this.config>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前监控状态
   */
  public getMonitoringStatus() {
    return this.isMonitoring;
  }
}

// 导出单例实例
export const networkMonitor = new NetworkMonitor();
