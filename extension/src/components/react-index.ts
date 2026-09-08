/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/assets/components/react-index.ts
 * @date 2026-02-05T02:38:01.688Z
 */

/**
 * React 共享组件出口
 * 与 Vue 版 index.ts 隔离，避免 React 组件污染 Vue 应用的构建
 * React 应用通过 `@/assets/components/react-index` 引入
 */

export { default as Draggable } from "./Draggable";
export type {
  DraggableProps,
  DraggableHandle,
  InitialPosition,
} from "./Draggable";

export { default as Static404 } from "./Static404";
