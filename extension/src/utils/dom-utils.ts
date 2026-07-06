/**
 * DOM 工具函数 - 依赖 DOM/Window 对象
 * 仅可在 Content Script、Popup、Options Page、DevTools 等有 DOM 访问权限的上下文中使用
 * 不可在 Service Worker (Background Script) 中使用
 */

// 导出各模块
export * from './shadow-dom';
export * from './element-control';
export * from './route-watcher';
export * from './llm-code-executor';
export * from './esm-module-loader';
export * from './image-zip-download';
export * from './ai-config';
export * from './auth';

// 命名空间导出，便于统一导入
import * as ShadowDomExports from './shadow-dom';
import * as ElementControlExports from './element-control';
import * as RouteWatcherExports from './route-watcher';
import * as LlmCodeExecutorExports from './llm-code-executor';
import * as EsmModuleLoaderExports from './esm-module-loader';
import * as ImageZipDownloadExports from './image-zip-download';
import * as AiConfigExports from './ai-config';
import * as AuthExports from './auth';

export const domUtils = {
  ...ShadowDomExports,
  ...ElementControlExports,
  ...RouteWatcherExports,
  ...LlmCodeExecutorExports,
  ...EsmModuleLoaderExports,
  ...ImageZipDownloadExports,
  ...AiConfigExports,
  ...AuthExports,
};

export type DomUtils = typeof domUtils;
