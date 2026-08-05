/**
 * 独立的事件总线模块
 *
 * 从 event/index.ts 拆分而来，不依赖 vue。
 * React/Preact 应用可从此模块导入 bus，避免引入 vue chunk。
 *
 * event/index.ts 会 re-export bus 保持向后兼容（但 index.ts 仍依赖 vue）。
 */
import mitt from "mitt";

export const bus = mitt();
