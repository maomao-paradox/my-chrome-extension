import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import "./styles/app.scss";

const APP_ROOT_ID = "app";

const bootstrap = (): void => {
  const rootElement = document.getElementById(APP_ROOT_ID);

  if (!rootElement) {
    throw new Error("[components] 找不到 #app 根节点");
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
