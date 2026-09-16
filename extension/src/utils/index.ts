/**
 * 纯工具函数 - 不依赖 DOM/Window 对象
 * 可在 Service Worker、Content Script、Background Script 中安全使用
 */

// 导出各模块
export * from "./base";
export * from "./common";
export * from "./logger";
export * from "./componentManager";
export * from "./fileMapDecryptor";
export * from "./request";
export * from "./singleton";

// 命名空间导出，便于统一导入
import * as BaseExports from "./base";
import * as CommonExports from "./common";
import * as LoggerExports from "./logger";
import * as ComponentManagerExports from "./componentManager";
import * as FileMapDecryptorExports from "./fileMapDecryptor";
import * as RequestExports from "./request";
import * as SingletonExports from "./singleton";

export const pureUtils = {
  ...BaseExports,
  ...CommonExports,
  ...LoggerExports,
  ...ComponentManagerExports,
  ...FileMapDecryptorExports,
  ...RequestExports,
  ...SingletonExports,
};

export type PureUtils = typeof pureUtils;
