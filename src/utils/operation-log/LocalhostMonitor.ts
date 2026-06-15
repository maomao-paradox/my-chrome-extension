/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/operation-log/LocalhostMonitor.ts
 * @date 2026-02-05T02:38:01.699Z
 */

import { operationLogManager } from './OperationLogManager';
import { LogType, LocalhostLog, LocalhostChangeType, LocalhostChange, LocalhostResource } from '../../assets/types/operation-log';

class LocalhostMonitor {
  private isMonitoring = false;
  private tabIdMap: Map<number, string> = new Map(); // 标签页ID到URL的映射
  private resourceLoadMap: Map<string, number> = new Map(); // 资源URL到开始时间的映射

  /**
   * 开始监控Localhost变化
   */
  public startMonitoring() {
    if (this.isMonitoring) return;

    // 监听标签页更新事件
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));

    // 监听标签页激活事件
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));

    // 监听标签页关闭事件
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));

    // 监听网络请求，特别关注localhost请求
    chrome.webRequest.onBeforeRequest.addListener(
      this.handleLocalhostRequest.bind(this),
      { urls: ['*://localhost/*', '*://127.0.0.1/*'] }
    );

    // 监听网络请求完成，用于计算资源加载时间
    chrome.webRequest.onCompleted.addListener(
      this.handleLocalhostRequestCompleted.bind(this),
      { urls: ['*://localhost/*', '*://127.0.0.1/*'] }
    );

    this.isMonitoring = true;
    maLogger.log('Localhost monitoring started');
  }

  /**
   * 停止监控Localhost变化
   */
  public stopMonitoring() {
    if (!this.isMonitoring) return;

    // 移除所有监听器
    chrome.tabs.onUpdated.removeListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onActivated.removeListener(this.handleTabActivated.bind(this));
    chrome.tabs.onRemoved.removeListener(this.handleTabRemoved.bind(this));
    chrome.webRequest.onBeforeRequest.removeListener(this.handleLocalhostRequest.bind(this));
    chrome.webRequest.onCompleted.removeListener(this.handleLocalhostRequestCompleted.bind(this));

    this.isMonitoring = false;
    this.tabIdMap.clear();
    this.resourceLoadMap.clear();
    maLogger.log('Localhost monitoring stopped');
  }

  /**
   * 处理标签页更新事件
   */
  private async handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    if (!tab.url || (!tab.url.startsWith('http://localhost') && !tab.url.startsWith('https://localhost') &&
        !tab.url.startsWith('http://127.0.0.1') && !tab.url.startsWith('https://127.0.0.1'))) {
      return;
    }

    // 记录标签页URL变化
    if (changeInfo.url) {
      const oldUrl = this.tabIdMap.get(tabId);
      if (oldUrl && oldUrl !== changeInfo.url) {
        await this.logLocalhostChange(LocalhostChangeType.REQUEST, {
          tabId,
          url: changeInfo.url,
          oldUrl,
          newUrl: changeInfo.url
        });
      }
      this.tabIdMap.set(tabId, changeInfo.url);
    }

    // 记录标签页加载完成事件
    if (changeInfo.status === 'complete') {
      await this.logLocalhostChange(LocalhostChangeType.RESPONSE, {
        tabId,
        url: tab.url || '',
        status: 'complete'
      });
    }
  }

  /**
   * 处理标签页激活事件
   */
  private async handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.url && (tab.url.startsWith('http://localhost') || tab.url.startsWith('https://localhost') ||
          tab.url.startsWith('http://127.0.0.1') || tab.url.startsWith('https://127.0.0.1'))) {
        await this.logLocalhostChange(LocalhostChangeType.REQUEST, {
          tabId: activeInfo.tabId,
          url: tab.url,
          action: 'activated'
        });
        this.tabIdMap.set(activeInfo.tabId, tab.url);
      }
    } catch (error) {
      maLogger.error('Failed to handle tab activated:', error);
    }
  }

  /**
   * 处理标签页关闭事件
   */
  private async handleTabRemoved(tabId: number) {
    const url = this.tabIdMap.get(tabId);
    if (url) {
      await this.logLocalhostChange(LocalhostChangeType.RESPONSE, {
        tabId,
        url,
        action: 'closed'
      });
      this.tabIdMap.delete(tabId);
    }
  }

  /**
   * 处理Localhost请求
   */
  private async handleLocalhostRequest(details: chrome.webRequest.WebRequestDetails) {
    // 记录请求开始时间，用于计算耗时
    this.resourceLoadMap.set(details.requestId, Date.now());

    // 记录请求事件
    await this.logLocalhostChange(LocalhostChangeType.REQUEST, {
      url: details.url,
      method: details.method,
      tabId: details.tabId,
      type: details.type,
      requestId: details.requestId
    });
  }

  /**
   * 处理Localhost请求完成
   */
  private async handleLocalhostRequestCompleted(details: chrome.webRequest.WebResponseCacheDetails) {
    const startTime = this.resourceLoadMap.get(details.requestId);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    this.resourceLoadMap.delete(details.requestId);

    // 记录资源加载完成事件
    await this.logLocalhostChange(LocalhostChangeType.RESOURCE_LOAD, {
      url: details.url,
      tabId: details.tabId,
      type: details.type,
      status: details.statusCode,
      duration,
      fromCache: details.fromCache
    });
  }

  /**
   * 记录Localhost变化
   */
  private async logLocalhostChange(type: LocalhostChangeType, data: any) {
    const localhostLog: LocalhostLog = {
      type,
      url: data.url || '',
      data,
      tabId: data.tabId,
      timestamp: Date.now(),
      duration: data.duration
    };

    // 生成描述信息
    const description = this.generateLocalhostDescription(type, data);

    // 记录到操作日志
    await operationLogManager.addLog(
      LogType.LOCALHOST,
      localhostLog,
      description,
      [data.url || 'localhost']
    );
  }

  /**
   * 生成Localhost变化的描述信息
   */
  private generateLocalhostDescription(type: LocalhostChangeType, data: any): string {
    switch (type) {
      case LocalhostChangeType.REQUEST:
        return `Localhost请求: ${data.method || 'GET'} ${data.url}`;
      case LocalhostChangeType.RESPONSE:
        return `Localhost响应: ${data.url} ${data.status || ''}`;
      case LocalhostChangeType.DOM_CHANGE:
        return `Localhost DOM变化: ${data.element || '元素'} ${data.property || '属性'} 改变`;
      case LocalhostChangeType.RESOURCE_LOAD:
        return `Localhost资源加载: ${data.type} ${data.url} (${data.status || 200})`;
      case LocalhostChangeType.SERVER_START:
        return `Localhost服务器启动: ${data.url || 'localhost'}`;
      case LocalhostChangeType.SERVER_STOP:
        return `Localhost服务器停止: ${data.url || 'localhost'}`;
      default:
        return `Localhost变化: ${data.url || 'localhost'}`;
    }
  }

  /**
   * 手动记录Localhost DOM变化
   */
  public async logDomChange(tabId: number, change: LocalhostChange, url: string) {
    await this.logLocalhostChange(LocalhostChangeType.DOM_CHANGE, {
      tabId,
      url,
      change
    });
  }

  /**
   * 手动记录Localhost服务器状态变化
   */
  public async logServerStatus(status: 'start' | 'stop', url: string = 'http://localhost') {
    const type = status === 'start' ? LocalhostChangeType.SERVER_START : LocalhostChangeType.SERVER_STOP;
    await this.logLocalhostChange(type, { url });
  }

  /**
   * 获取当前监控状态
   */
  public getMonitoringStatus() {
    return this.isMonitoring;
  }
}

// 导出单例实例
export const localhostMonitor = new LocalhostMonitor();
