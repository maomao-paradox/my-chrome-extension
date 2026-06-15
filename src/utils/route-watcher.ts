/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/route-watcher.ts
 * @date 2026-04-14T14:02:00.000Z
 */

/**
 * 路由变化回调函数类型
 */
type RouteChangeCallback = (url: string, previousUrl: string) => void;

/**
 * 路由监听器类
 */
export class RouteWatcher {
  private callbacks: Set<RouteChangeCallback> = new Set();
  private currentUrl: string;
  private historyStateListener: ((event: PopStateEvent) => void) | null = null;
  private hashChangeListener: ((event: HashChangeEvent) => void) | null = null;

  /**
   * 构造函数
   */
  constructor() {
    this.currentUrl = window.location.href;
    this.setupListeners();
  }

  /**
   * 设置路由监听器
   */
  private setupListeners() {
    // 监听 History API 变化
    this.historyStateListener = (event: PopStateEvent) => {
      const newUrl = window.location.href;
      if (newUrl !== this.currentUrl) {
        const previousUrl = this.currentUrl;
        this.currentUrl = newUrl;
        this.notifyCallbacks(newUrl, previousUrl);
      }
    };

    // 监听 hash 变化
    this.hashChangeListener = (event: HashChangeEvent) => {
      const newUrl = window.location.href;
      const previousUrl = event.oldURL || this.currentUrl;
      this.currentUrl = newUrl;
      this.notifyCallbacks(newUrl, previousUrl);
    };

    // 添加事件监听器
    window.addEventListener('popstate', this.historyStateListener);
    window.addEventListener('hashchange', this.hashChangeListener);

    // 重写 pushState 和 replaceState 方法，以便捕获这些变化
    this.overrideHistoryMethods();
  }

  /**
   * 重写 History API 方法，以便捕获 pushState 和 replaceState 调用
   */
  private overrideHistoryMethods() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // 重写 pushState
    history.pushState = ((...args) => {
      const result = originalPushState.apply(history, args);
      const newUrl = window.location.href;
      if (newUrl !== this.currentUrl) {
        const previousUrl = this.currentUrl;
        this.currentUrl = newUrl;
        this.notifyCallbacks(newUrl, previousUrl);
      }
      return result;
    }) as typeof history.pushState;

    // 重写 replaceState
    history.replaceState = ((...args) => {
      const result = originalReplaceState.apply(history, args);
      const newUrl = window.location.href;
      if (newUrl !== this.currentUrl) {
        const previousUrl = this.currentUrl;
        this.currentUrl = newUrl;
        this.notifyCallbacks(newUrl, previousUrl);
      }
      return result;
    }) as typeof history.replaceState;
  }

  /**
   * 通知所有回调函数
   * @param url 当前 URL
   * @param previousUrl 之前的 URL
   */
  private notifyCallbacks(url: string, previousUrl: string) {
    this.callbacks.forEach(callback => {
      try {
        callback(url, previousUrl);
      } catch (error) {
        maLogger.error('Route change callback error:', error);
      }
    });
  }

  /**
   * 订阅路由变化
   * @param callback 路由变化回调函数
   * @returns 取消订阅的函数
   */
  subscribe(callback: RouteChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll() {
    this.callbacks.clear();
  }

  /**
   * 销毁路由监听器
   */
  destroy() {
    // 移除事件监听器
    if (this.historyStateListener) {
      window.removeEventListener('popstate', this.historyStateListener);
    }
    if (this.hashChangeListener) {
      window.removeEventListener('hashchange', this.hashChangeListener);
    }

    // 清除回调
    this.callbacks.clear();
  }

  /**
   * 获取当前 URL
   * @returns 当前 URL
   */
  getCurrentUrl(): string {
    return this.currentUrl;
  }
}

/**
 * 创建路由监听器实例
 */
export const routeWatcher = new RouteWatcher();

/**
 * 监听路由变化的工具函数
 * @param callback 路由变化回调函数
 * @returns 取消订阅的函数
 */
export function useRouteWatcher(callback: RouteChangeCallback): () => void {
  return routeWatcher.subscribe(callback);
}

/**
 * 导航到指定 URL
 * @param url 目标 URL
 * @param replace 是否替换当前历史记录
 */
export function navigate(url: string, replace: boolean = false): void {
  if (replace) {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
  }
}
