/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/index.ts
 * @date 2026-04-14T14:03:00.000Z
 */

// 所有引用document对象的都不应该在此处导出，因为document对象在service worker中不存在

// 导出其他工具函数
export * from './common';
export * from './componentManager';
export * from './message';
export * from './logger';
