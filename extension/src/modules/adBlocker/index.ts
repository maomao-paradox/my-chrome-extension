import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { createShadowHost, injectStyles } from "@/utils/shadow-dom";
import { applyRules } from "./adBlocker";
import AdBlockerApp from "./App";
import { stopEarlyAdBlocker } from "./early";
import styles from "./style.scss?raw";

const HOST_ID = "ma-extension-adblocker-host";

class AdBlockerModule {
  private root: Root | null = null;
  private observer: MutationObserver | null = null;
  private startRequest = 0;

  async inject(): Promise<void> {
    if (window.self !== window.top) return;
    stopEarlyAdBlocker();
    applyRules();
    this.mountUi();
    if (!this.observer) {
      this.observer = new MutationObserver(() => applyRules());
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  enable(): void { void this.inject(); }

  disable(): void {
    stopEarlyAdBlocker();
    this.observer?.disconnect();
    this.observer = null;
    this.root?.unmount();
    this.root = null;
    document.getElementById(HOST_ID)?.remove();
  }

  async triggerAdBlocker(): Promise<void> {
    await this.inject();
    this.startRequest += 1;
    this.renderUi();
  }

  private mountUi(): void {
    if (this.root) return;
    const { shadowRoot } = createShadowHost(HOST_ID, "open");
    injectStyles(shadowRoot, styles);
    const container = document.createElement("div");
    container.className = "ad-blocker-ui-root";
    shadowRoot.appendChild(container);
    this.root = createRoot(container);
    this.renderUi();
  }

  private renderUi(): void {
    this.root?.render(React.createElement(AdBlockerApp, { startRequest: this.startRequest }));
  }
}

let moduleInstance: AdBlockerModule | null = null;

export default (_context: AppContext): AdBlockerModule => {
  if (!moduleInstance) moduleInstance = new AdBlockerModule();
  return moduleInstance;
};

export const triggerAdBlocker = (): void => { void moduleInstance?.triggerAdBlocker(); };
