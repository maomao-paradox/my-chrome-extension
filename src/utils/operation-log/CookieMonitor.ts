/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/operation-log/CookieMonitor.ts
 * @date 2026-02-05T02:38:01.699Z
 */

import { operationLogManager } from './OperationLogManager';
import { LogType, CookieLog, CookieAction } from '../../assets/types/operation-log';

class CookieMonitor {
  private isMonitoring = false;
  private config = {
    recordAllDomains: true,
    ignoredDomains: ['localhost', '127.0.0.1'] // 默认不忽略本地域名
  };

  /**
   * 开始监控Cookie变化
   */
  public startMonitoring() {
    if (this.isMonitoring) return;

    // 监听Cookie变化事件
    chrome.cookies.onChanged.addListener(this.handleCookieChanged.bind(this));

    this.isMonitoring = true;
    maLogger.log('Cookie monitoring started');
  }

  /**
   * 停止监控Cookie变化
   */
  public stopMonitoring() {
    if (!this.isMonitoring) return;

    // 移除Cookie变化监听器
    chrome.cookies.onChanged.removeListener(this.handleCookieChanged.bind(this));

    this.isMonitoring = false;
    maLogger.log('Cookie monitoring stopped');
  }

  /**
   * 处理Cookie变化事件
   */
  private async handleCookieChanged(changeInfo: chrome.cookies.CookieChangeInfo) {
    // 检查是否应该忽略该域名
    if (!this.shouldMonitorDomain(changeInfo.cookie.domain)) {
      return;
    }

    // 确定操作类型
    let action: CookieAction;
    if (changeInfo.removed) {
      action = CookieAction.REMOVED;
    } else if (changeInfo.cause === 'overwrite') {
      action = CookieAction.CHANGED;
    } else {
      action = CookieAction.ADDED;
    }

    // 构建Cookie日志
    const cookieLog: CookieLog = {
      action,
      cookie: changeInfo.cookie,
      previousCookie: changeInfo.cause === 'overwrite' ? changeInfo.removed ? changeInfo.cookie : undefined : undefined,
      url: this.getCookieUrl(changeInfo.cookie)
    };

    // 生成描述信息
    const description = this.generateCookieDescription(action, changeInfo.cookie);

    // 记录到操作日志
    await operationLogManager.addLog(
      LogType.COOKIE,
      cookieLog,
      description,
      [changeInfo.cookie.name + '@' + changeInfo.cookie.domain]
    );
  }

  /**
   * 检查是否应该监控该域名
   */
  private shouldMonitorDomain(domain: string | undefined): boolean {
    if (!domain) return true;

    // 如果配置为记录所有域名，则监控所有域名
    if (this.config.recordAllDomains) {
      return !this.config.ignoredDomains.some(ignoredDomain => 
        domain.endsWith(ignoredDomain) || domain === ignoredDomain
      );
    }

    return false;
  }

  /**
   * 生成Cookie的完整URL
   */
  private getCookieUrl(cookie: chrome.cookies.Cookie): string {
    const protocol = cookie.secure ? 'https://' : 'http://';
    // 处理域名前缀点号
    const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
    return `${protocol}${domain}${cookie.path}`;
  }

  /**
   * 生成Cookie变化的描述信息
   */
  private generateCookieDescription(action: CookieAction, cookie: chrome.cookies.Cookie): string {
    const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
    
    switch (action) {
      case CookieAction.ADDED:
        return `Cookie添加: ${cookie.name} @ ${domain}`;
      case CookieAction.CHANGED:
        return `Cookie修改: ${cookie.name} @ ${domain}`;
      case CookieAction.REMOVED:
        return `Cookie删除: ${cookie.name} @ ${domain}`;
      default:
        return `Cookie变化: ${cookie.name} @ ${domain}`;
    }
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

  /**
   * 手动记录Cookie状态
   */
  public async logCurrentCookies(domain?: string) {
    try {
      const cookies = await chrome.cookies.getAll(domain ? { domain } : {});
      
      for (const cookie of cookies) {
        const cookieLog: CookieLog = {
          action: CookieAction.ADDED,
          cookie,
          url: this.getCookieUrl(cookie)
        };

        await operationLogManager.addLog(
          LogType.COOKIE,
          cookieLog,
          `Cookie当前状态: ${cookie.name} @ ${cookie.domain}`,
          [cookie.name + '@' + cookie.domain]
        );
      }
      
      maLogger.log(`Logged ${cookies.length} cookies for domain: ${domain || 'all'}`);
    } catch (error) {
      maLogger.error('Failed to log current cookies:', error);
    }
  }
}

// 导出单例实例
export const cookieMonitor = new CookieMonitor();
