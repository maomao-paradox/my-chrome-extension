/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/floatingball/index.ts
 * @date 2026-02-05T02:38:01.689Z
 *
 * Floatingball 应用入口（React 版）
 * 从 Vue 版 index.ts 迁移而来
 *
 * 关键变更：
 * - createApp → createRoot（react-dom/client）
 * - Vue 应用实例 → React Root
 * - CSS 通过 chrome-extension:// 加载 → 通过 ?inline SCSS 注入 shadow root
 *   （避免 Vite CSS 代码分割创建 <link> 标签导致相对路径请求失败）
 * - Drawer 通过 getContainer 挂载到 shadow root 内，确保样式生效
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import type { Tool } from "@/types/index.js";
import { $id, addElementToDom } from "@/utils/element-control";
import { createShadowHost, injectStyles } from "@/utils/shadow-dom";
import { getStaticAbstractPath } from "@/utils/common";
import { storage } from "@/stores";
import { appConfigKey } from "@/config";
import { shadowHostId } from "@/config";
import type { AppModule } from "@/types/utils/index.js";

// 通过 ?inline 导入所有聚合 SCSS 为字符串
// 这样 Vite 会把所有样式打包到当前 chunk，避免创建 <link> 标签
import floatingballStyles from "./styles/index.scss?raw";

/**
 * @author 月光下的牧师
 * @version v1.0.0
 * @license MIT
 * @sequence Ⅲ 牧师
 */

// 悬浮球选项接口
declare interface FloatingBallOptions {
  tools?: Tool[];
  visible?: boolean;
  icon?: string;
}

/** 等待 body 就绪 */
const waitForBodyReady = async (): Promise<void> => {
  if (document.body) {
    return;
  }
  await new Promise<void>((resolve) => {
    const check = () =>
      document.body ? resolve() : requestAnimationFrame(check);
    check();
  });
};

/**
 * FloatingBall - 悬浮球应用模块
 * 实现 AppModule 接口，支持注入/启用/禁用/初始化
 */
class FloatingBall implements AppModule {
  _ctx: any = null;
  shadowHostId: string = shadowHostId;
  isInjected: boolean = false;
  reactContainer: HTMLElement | null = null;
  drawerContainer: HTMLElement | null = null;
  shadowRoot: ShadowRoot | null = null;
  appRoot: Root | null = null;
  isEnabled: boolean = false;
  stylesInjected: boolean = false;

  // 自定义工具配置
  private customTools: Tool[] = [
    {
      id: "glass-card",
      label: "悬浮毛玻璃卡片",
      details:
        "创建一个可拖动、可调宽高和透明度的毛玻璃悬浮卡片，双击空白区域即可关闭",
    },
    {
      id: "spectrum",
      label: "光谱效应",
      icon: "BgColors",
      details: "预览棱镜、极光、光谱环和衍射薄膜等 CSS 视觉效果",
    },
    {
      id: "image",
      label: "下载图片",
      details:
        "下载当前页面的所有图片，包括base64编码的图片，src属性中的图片和svg矢量图",
    },
    {
      id: "mock",
      label: "构造数据",
      details: "构造模拟数据，支持构造数组、对象、字符串、数字等类型",
    },
    {
      id: "brute",
      label: "密码爆破",
      details: "对密码进行爆破，支持字典攻击、规则攻击等",
    },
    {
      id: "crypto",
      label: "加解密",
      details: "对数据进行加解密，支持AES、DES等加密算法",
    },
    {
      id: "json",
      label: "JSON格式化",
      details: "格式化JSON数据，支持缩进、换行等",
    },
    { id: "script", label: "执行脚本", details: "执行自定义脚本，支持ES6语法" },
  ];

  // 自定义事件
  private unloadFloatingballEvent: CustomEvent;
  private loadFloatingballEvent: CustomEvent;

  constructor() {
    // 初始化自定义事件
    this.unloadFloatingballEvent = new CustomEvent("unload-floatingball", {
      detail: { message: "Hello, World!" },
      bubbles: true,
      cancelable: true,
    });

    this.loadFloatingballEvent = new CustomEvent("load-floatingball", {
      detail: { message: "Hello, World!" },
      bubbles: true,
      cancelable: true,
    });
  }

  /**
   * 获取卸载事件
   */
  getUnloadEvent(): CustomEvent {
    return this.unloadFloatingballEvent;
  }

  /**
   * 获取加载事件
   */
  getLoadEvent(): CustomEvent {
    return this.loadFloatingballEvent;
  }

  /**
   * 注入悬浮球到页面
   */
  async inject(options?: FloatingBallOptions): Promise<void> {
    try {
      // 仅主页面注入
      if (window.self !== window.top) {
        return (maLogger.log("不是主页面，不注入悬浮球"), void 0);
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
        injectStyles(this.shadowRoot, floatingballStyles);
        this.stylesInjected = true;
      }

      const { tools, visible = true, icon } = options || {};

      // 创建 React 容器（用于渲染 App）
      if (
        !this.reactContainer &&
        !this.shadowRoot?.getElementById("shadow-app-floatingball")
      ) {
        this.reactContainer = addElementToDom({
          tag: "div",
          attrs: { id: "shadow-app-floatingball" },
          style: "position: fixed; z-index: var(--z-index);",
        })(this.shadowRoot as ShadowRoot);
      }

      // 创建 Drawer 专用容器（antd Drawer 通过 getContainer 挂载到此处）
      // 确保 Drawer 的 portal 元素在 shadow root 内，样式才能生效
      if (
        !this.drawerContainer &&
        !this.shadowRoot?.getElementById("shadow-drawer-floatingball")
      ) {
        this.drawerContainer = addElementToDom({
          tag: "div",
          attrs: { id: "shadow-drawer-floatingball" },
          style: "position: fixed; top: 0; left: 0; width: 0; height: 0;",
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
        React.createElement(App, {
          tools: tools || this.customTools,
          visible,
          icon: icon || getStaticAbstractPath("icons/floatingball.png"),
          drawerContainer: this.drawerContainer,
        }),
      );
    } catch (error) {
      maLogger.error("注入悬浮球失败:", error);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.reactContainer) {
      return;
    }

    // 监听显示/隐藏事件
    window.addEventListener("unload-floatingball", () => {
      if (this.reactContainer) {
        this.reactContainer.style.display = "none";
      }
    });

    window.addEventListener("load-floatingball", () => {
      if (this.reactContainer) {
        this.reactContainer.style.display = "block";
      }
    });
  }

  /**
   * 启用悬浮球
   */
  async enable(): Promise<void> {
    try {
      // 如果未注入，则先注入
      if (!this.isInjected || !$id(this.shadowHostId)) {
        await this.inject({ visible: true });
      } else {
        window.dispatchEvent(this.loadFloatingballEvent);
      }
    } catch (error) {
      maLogger.error("启用悬浮球失败:", error);
    }
  }

  /**
   * 禁用悬浮球
   */
  disable(): void {
    try {
      // 触发卸载事件
      window.dispatchEvent(this.unloadFloatingballEvent);

      // 直接操作 DOM，确保组件被隐藏
      if (this.reactContainer) {
        this.reactContainer.style.display = "none";
        maLogger.info("悬浮球已直接隐藏");
      }
    } catch (error) {
      maLogger.error("禁用悬浮球失败:", error);
    }
  }

  /**
   * 初始化悬浮球
   */
  async init(): Promise<void> {
    try {
      // 从 storage 加载配置
      const config = await storage.ext.local.get(appConfigKey);
      if (
        config &&
        config.floatingBall &&
        config.floatingBall.value !== false
      ) {
        this.enable();
      }
      this.setupEventListeners();
    } catch (error) {
      maLogger.error("初始化悬浮球失败:", error);
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
  const appInstance = new FloatingBall();
  appInstance.init();
  return appInstance;
};
