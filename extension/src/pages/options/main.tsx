/**
 * @file src/pages/options/main.tsx
 * @description React 版 Options 页面入口。
 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
// antd 静态方法（Modal.confirm / message.*）在 React 19 下的官方兼容补丁
// —— 不引入时静态调用会静默失败（弹窗与提示均不渲染）
import "@ant-design/v5-patch-for-react-19";
import {
  installGlobalLogger,
  syncGlobalLoggerFromStorage,
} from "@/utils";
import App from "./App";
import "./styles/app.scss";
import "@/assets/styles/element-message-box.scss";

const APP_ROOT_ID = "app";

installGlobalLogger({ title: "MRIA OPTIONS", enabled: false });
void syncGlobalLoggerFromStorage();

const bootstrap = (): void => {
  const rootElement = document.getElementById(APP_ROOT_ID);

  if (!rootElement) {
    throw new Error("[options] 找不到 #app 根节点");
  }

  const root: Root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
