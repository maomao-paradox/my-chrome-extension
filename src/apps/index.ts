/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/index.ts
 * @date 2026-02-05T02:38:01.689Z
 */

import { PluginConfigs } from "@/types";

// export const appConfigKey = 'appConfig';

export const defaultPluginConfigs: PluginConfigs = {
    "floatingball": {
        "desc": "悬浮球",
        "type": "sidepanel",
        "value": true
    },
    "pianoEffect": {
        "desc": "钢琴音效",
        "value": true
    },
    "sidebar": {
        "desc": "侧边工具栏",
        "value": true
    },
    "textSelectionToolbar": {
        "desc": "文本选择工具栏",
        "value": true
    },
    // "componentCapture": {
    //     "desc": "组件捕获",
    //     "value": true
    // },
    // "errorMonitor": {
    //     "desc": "异常监控",
    //     "value": true
    // },
}
