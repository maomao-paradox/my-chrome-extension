/**
 * DOM 工具函数 - 依赖 DOM/Window 对象
 * 仅可在 Content Script、Popup、Options Page、DevTools 等有 DOM 访问权限的上下文中使用
 * 不可在 Service Worker (Background Script) 中使用
 */

// 导出各模块
export * from "./ai-config";

// 命名空间导出，便于统一导入
import * as AIConfig from "./ai-config";

export const chromeApis = {
  ...AIConfig,
};

export type ChromeApis = typeof chromeApis;
