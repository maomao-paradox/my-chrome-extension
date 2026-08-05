/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @file src/apps/menu/index.ts
 *
 * Menu 应用入口（React 版）
 * 从 Vue 版 index.ts 迁移而来
 *
 * 关键变更：
 * - createApp → createRoot（react-dom/client）
 * - 移除 pinia 依赖（App 组件不使用 store）
 * - CSS 通过 chrome-extension:// 加载 → 通过 ?inline SCSS 注入 shadow root
 *   （避免 Vite CSS 代码分割创建 <link> 标签导致相对路径请求失败）
 * - App.vue → App.tsx（React 组件）
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import MenuApp from "./App";
import type { Tool, AppModule } from "@/types";
import { $id, addElementToDom } from "@/utils/element-control";
import { createShadowHost, injectStyles } from "@/utils/shadow-dom";
import { storage } from "@/stores";
import { appConfigKey, shadowHostId } from "@/config";

// 通过 ?inline 导入聚合 SCSS 为字符串
import menuStyles from "./styles/index.scss?inline";

// 定义菜单选项接口
declare interface MenuOptions {
  tools?: Tool[];
  visible?: boolean;
}

const waitForBodyReady = async (): Promise<void> => {
  if (document.body) {
    return;
  }
  await new Promise<void>((resolve) => {
    const check = () => (document.body ? resolve() : requestAnimationFrame(check));
    check();
  });
};

class Menu implements AppModule {
  _context: any = null;
  _name: string = "menu";
  shadowHostId: string = shadowHostId;
  isInjected: boolean = false;
  reactContainer: HTMLElement | null = null;
  shadowRoot: ShadowRoot | null = null;
  appRoot: Root | null = null;
  isEnabled: boolean = false;
  stylesInjected: boolean = false;

  // 自定义工具配置
  private customTools: Tool[] = [
    {
      id: "glass-card",
      label: "悬浮毛玻璃卡片",
      details: "创建一个可拖动、可调宽高和透明度的毛玻璃悬浮卡片，双击空白区域即可关闭",
      icon: "ai-chat",
    },
    {
      id: "image",
      label: "下载图片",
      details: "下载当前页面的所有图片，包括base64编码的图片，src属性中的图片和svg矢量图",
      icon: "ai-chat",
    },
    {
      id: "ai-chat",
      label: "AI聊天",
      details: "与AI进行聊天，支持中文、英文等语言",
      icon: "ai-chat",
    },
    {
      id: "autoClick",
      label: "自动点击元素",
      details: "自动点击页面上的元素",
      icon: "ai-chat",
    },
  ];

  // 自定义事件
  private unloadMenuEvent: CustomEvent;
  private loadMenuEvent: CustomEvent;

  constructor() {
    this.unloadMenuEvent = new CustomEvent("unload-menu", {
      detail: { message: "Hello, World!" },
      bubbles: true,
      cancelable: true,
    });

    this.loadMenuEvent = new CustomEvent("load-menu", {
      detail: { message: "Hello, World!" },
      bubbles: true,
      cancelable: true,
    });
  }

  /**
   * 获取卸载事件
   */
  getUnloadEvent(): CustomEvent {
    return this.unloadMenuEvent;
  }

  /**
   * 获取加载事件
   */
  getLoadEvent(): CustomEvent {
    return this.loadMenuEvent;
  }

  /**
   * 注入菜单到页面
   */
  async inject(options?: MenuOptions): Promise<void> {
    try {
      if (window.self !== window.top) {
        maLogger.log("不是主页面，不注入固定菜单");
        return;
      }
      await waitForBodyReady();

      // 已注入则跳过
      if (
        this.isInjected &&
        this.appRoot &&
        this.reactContainer &&
        this.shadowRoot &&
        $id(this.shadowHostId)
      ) {
        return;
      }

      // 创建 shadow root
      if (!this.shadowRoot) {
        const { shadowRoot } = createShadowHost(this.shadowHostId, "open");
        this.shadowRoot = shadowRoot;
      }

      // 注入聚合 SCSS（?inline 导入的字符串）
      if (!this.stylesInjected && this.shadowRoot) {
        injectStyles(this.shadowRoot, menuStyles);
        this.stylesInjected = true;
      }

      const { tools, visible = true } = options || {};

      // 创建 React 容器
      if (
        !this.reactContainer &&
        !this.shadowRoot?.getElementById(`shadow-app-${this._name}`)
      ) {
        this.reactContainer = addElementToDom({
          tag: "div",
          attrs: { id: `shadow-app-${this._name}` },
          style: "position: fixed; z-index: var(--z-index);",
        })(this.shadowRoot as ShadowRoot);
      }

      this.setupEventListeners();

      // 卸载旧的 React root
      if (this.appRoot) {
        this.appRoot.unmount();
        this.appRoot = null;
      }

      // 创建 React root 并渲染 App
      this.appRoot = createRoot(this.reactContainer!);
      this.appRoot.render(
        React.createElement(MenuApp, {
          tools: tools || this.customTools,
          visible,
        })
      );
    } catch (error) {
      maLogger.error("注入固定菜单失败:", error);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.reactContainer) {
      return;
    }

    window.addEventListener(`unload-${this._name}`, () => {
      if (this.reactContainer) {
        this.reactContainer.style.display = "none";
      }
    });

    window.addEventListener(`load-${this._name}`, () => {
      if (this.reactContainer) {
        this.reactContainer.style.display = "block";
      }
    });
  }

  /**
   * 启用固定菜单
   */
  async enable(): Promise<void> {
    try {
      if (!this.isInjected || !$id(this.shadowHostId)) {
        await this.inject({ visible: true });
      } else {
        window.dispatchEvent(this.loadMenuEvent);
      }
    } catch (error) {
      maLogger.error("启用固定菜单失败:", error);
    }
  }

  /**
   * 禁用固定菜单
   */
  disable(): void {
    try {
      window.dispatchEvent(this.unloadMenuEvent);
      if (this.reactContainer) {
        this.reactContainer.style.display = "none";
        maLogger.info("固定菜单已直接隐藏");
      }
    } catch (error) {
      maLogger.error("禁用固定菜单失败:", error);
    }
  }

  /**
   * 初始化固定菜单
   */
  async init(): Promise<void> {
    try {
      const config = await storage.ext.local.get(appConfigKey);
      if (config && config.floatingBall && config.floatingBall.value !== false) {
        this.enable();
      }
      this.setupEventListeners();
    } catch (error) {
      maLogger.error("初始化固定菜单失败:", error);
    }
  }

  /**
   * 根据设置更新状态
   */
  updateStatus(enabled: boolean): void {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
}

// 导出默认函数，兼容 ESMModuleLoader
export default (ctx: AppContext, options?: any): AppModule => {
  const appInstance = new Menu();
  appInstance.init();
  return appInstance;
};
