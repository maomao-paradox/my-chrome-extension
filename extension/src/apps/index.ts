/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/index.ts
 * @date 2026-02-05T02:38:01.689Z
 */

import { PluginConfigMap } from "@/types";

export const defaultPluginConfigs: PluginConfigMap = {
  floatingball: {
    id: "floatingball",
    name: "悬浮球",
    type: "floating",
    enabled: false
  },

  pianoEffect: {
    id: "pianoEffect",
    name: "钢琴音效",
    type: "effect",
    enabled: false,
  },

  sidebar: {
    id: "sidebar",
    name: "侧边工具栏",
    type: "sidebar",
    enabled: false,
  },

  textSelectionToolbar: {
    id: "textSelectionToolbar",
    name: "文本选择工具栏",
    type: "toolbar",
    enabled: false,
    options: {
      brandColor: "#ff0dc5",
    },
  },

  menu: {
    id: "menu",
    name: "菜单",
    type: "menu",
    enabled: true,
  },
};
