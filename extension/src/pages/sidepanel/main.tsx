/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/pages/sidepanel/main.ts
 * @date 2026-02-05T02:38:01.696Z
 */

import {
  installGlobalLogger,
  syncGlobalLoggerFromStorage,
} from "@/utils/logger";
import { createRoot } from "react-dom/client";
import App from "./App";
import { useFloatingballStore } from "@/stores/floatingball";

installGlobalLogger({ title: "MRIA SIDEPANEL", enabled: false });
void syncGlobalLoggerFromStorage();

// 创建React应用
const root = createRoot(document.getElementById("app")!);

root.render(<App />);

// 监听侧边栏关闭事件
// floatingball store 已迁移为 Zustand（框架无关），通过 getState() 调用
window.addEventListener("beforeunload", () => {
  // 当侧边栏页面即将关闭时，将侧边栏激活状态设为false
  useFloatingballStore.getState().toggleSidepanel(false);
});

window.onclose = () => {
  maLogger.info("关闭侧边栏");
};
