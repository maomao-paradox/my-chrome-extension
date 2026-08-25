/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/main.tsx
 * @description React 版 Popup 入口文件
 */
import {
  installGlobalLogger,
  syncGlobalLoggerFromStorage,
} from "@/utils/logger";
import { createRoot, type Root } from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { StrictMode } from "react";
import App from "./App";
import "./styles/themes.scss";

/** 应用根元素 ID */
const APP_ROOT_ID = "app";

installGlobalLogger({ title: "MRIA POPUP", enabled: false });
syncGlobalLoggerFromStorage().then((bootstrap) => bootstrap.setEnabled(true));

/** 初始化并渲染 Popup 应用 */
const bootstrap = (): void => {
  const rootElement = document.getElementById(APP_ROOT_ID);

  if (!rootElement) {
    throw new Error(`[popup] 找不到 #${APP_ROOT_ID} 根节点`);
  }

  const root: Root = createRoot(rootElement);

  root.render(
    <StrictMode>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: "var(--popup-accent-strong)",
            colorBgBase: "var(--popup-page-background)",
            colorTextBase: "var(--popup-text-primary)",
          },
        }}
      >
        <App />
      </ConfigProvider>
    </StrictMode>,
  );
};

if (document.readyState === "complete") {
  bootstrap();
} else {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
}
