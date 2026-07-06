/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/index.ts
 * @date 2026-04-14T14:03:00.000Z
 */

/**
 * 工具函数模块
 *
 * 注意：所有引用 document/window 对象的工具函数都不应在此处直接导出，
 * 因为这些对象在 Service Worker (Background Script) 中不存在。
 *
 * 工具函数分为两类：
 * - pure-utils: 纯函数，不依赖 DOM/Window，可在任何上下文中使用
 * - dom-utils: 需要 DOM/Window，仅限 Content Script、Popup、Options 等有 DOM 访问权限的上下文
 *
 * 使用时按需导入：
 *   import { xxx } from '@/utils/pure-utils';  // 通用工具
 *   import { xxx } from '@/utils/dom-utils';   // DOM相关工具
 */

// 导出纯工具函数（可在 Service Worker 中使用）
export * from './pure-utils';

// 导出 DOM 工具函数（不可在 Service Worker 中使用）
export * from './dom-utils';

// 重新导出命名空间
export { pureUtils, type PureUtils } from './pure-utils';
export { domUtils, type DomUtils } from './dom-utils';
