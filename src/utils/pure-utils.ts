/**
 * 纯工具函数 - 不依赖 DOM/Window 对象
 * 可在 Service Worker、Content Script、Background Script 中安全使用
 */

// 导出各模块
export * from './base';
export * from './common';
export * from './message';
export * from './logger';
export * from './componentManager';
export * from './tool-definition';
export * from './fileMapDecryptor';

// 命名空间导出，便于统一导入
import * as BaseExports from './base';
import * as CommonExports from './common';
import * as MessageExports from './message';
import * as LoggerExports from './logger';
import * as ComponentManagerExports from './componentManager';
import * as ToolDefinitionExports from './tool-definition';
import * as FileMapDecryptorExports from './fileMapDecryptor';

export const pureUtils = {
  ...BaseExports,
  ...CommonExports,
  ...MessageExports,
  ...LoggerExports,
  ...ComponentManagerExports,
  ...ToolDefinitionExports,
  ...FileMapDecryptorExports,
};

export type PureUtils = typeof pureUtils;
