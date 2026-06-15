/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/operation-log/CookieLog.ts
 * @date 2026-02-05T02:38:01.697Z
 */

export enum CookieAction {
  ADDED = 'added',
  CHANGED = 'changed',
  REMOVED = 'removed'
}

export interface CookieLog {
  action: CookieAction;  // 操作类型
  cookie: chrome.cookies.Cookie;  // cookie详情
  previousCookie?: chrome.cookies.Cookie;  // 变化前的cookie（仅修改时）
  tabId?: number;        // 关联的标签页ID
  url?: string;          // 关联的URL
}

export interface CookieFilter {
  name?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  session?: boolean;
}
