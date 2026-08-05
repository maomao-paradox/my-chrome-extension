/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/floatingball/views/index.ts
 * @date 2026-02-05T02:38:01.688Z
 *
 * React 工具映射表：从 Vue 版迁移而来，仅导出已迁移至 React 的工具组件。
 * 未迁移的 AIConversation.vue / HiddenPathScanner.vue 不在此导出，
 * 它们仍由 Vue 应用（如 sidebar）直接引用 .vue 文件。
 */

import type { ComponentType } from "react";
import ImageDownload from "./ImageDownload";
import ScriptRunner from "./ScriptRunner";

/** 工具组件类型：带 onAddMessage 回调的 React 组件 */
export type ToolComponent = ComponentType<{
  onAddMessage?: (msg: {
    message: string;
    type: "success" | "info" | "warning" | "error";
  }) => void;
}>;

/** 工具映射表：toolId → React 组件 */
const toolMap: Record<string, ToolComponent> = {
  image: ImageDownload,
  script: ScriptRunner,
};

export default toolMap;
