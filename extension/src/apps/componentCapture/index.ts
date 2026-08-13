/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @file src/apps/componentCapture/index.ts
 *
 * ComponentCapture 应用入口（React 版）
 * 从 Vue 版 index.ts 迁移而来
 *
 * 关键变更：
 * - createApp → createRoot（react-dom/client）
 * - Vue 应用实例 → React Root
 * - 移除 pinia 依赖（App 组件不使用 store）
 * - CSS 通过 chrome-extension:// 加载 → 通过 ?inline SCSS 注入 shadow root
 *   （避免 Vite CSS 代码分割创建 <link> 标签导致相对路径请求失败）
 * - 保留 triggerComponentCapture / captureComponent API（message-handlers.ts 依赖）
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import ComponentCaptureApp from "./App";
import { AppModule } from "@/types/index";
import { shadowHostId } from "@/config";
import { createShadowHost, injectStyles } from "@/utils/shadow-dom";
import { $id, addElementToDom } from "@/utils/element-control";
import { bus } from "@/event/bus";

// 通过 ?inline 导入聚合 SCSS 为字符串
// 这样 Vite 会把所有样式打包到当前 chunk，避免创建 <link> 标签
import componentCaptureStyles from "./styles/app.scss?raw";

const pluginName = "componentCapture";

class ComponentCaptureModule implements AppModule {
  _ctx = null;
  _root: Root | null = null;
  _container: HTMLElement | null = null;
  _instance = null;
  isInjected: boolean = false;
  isCapturing: boolean = false;
  isEnabled: boolean = false;
  stylesInjected: boolean = false;

  constructor() {
    maLogger.log("ComponentCaptureModule initialized");
  }

  /**
   * 注入模块
   */
  async inject(): Promise<void> {
    try {
      if (window.self !== window.top) {
        maLogger.log("不是主页面，不注入组件捕获模块");
        return;
      }

      if (!document.body) {
        await new Promise((resolve) => {
          const checkBody = () => {
            if (document.body) {
              resolve(null);
            } else {
              requestAnimationFrame(checkBody);
            }
          };
          checkBody();
        });
      }

      // 已注入则跳过
      if (
        this.isInjected &&
        this._root &&
        this._container &&
        $id(shadowHostId)
      ) {
        return;
      }

      // 创建 shadow root
      const { shadowRoot } = createShadowHost(shadowHostId, "open");

      // 注入聚合 SCSS（?raw 导入的字符串）
      if (!this.stylesInjected && shadowRoot) {
        injectStyles(shadowRoot, componentCaptureStyles);
        this.stylesInjected = true;
      }

      // 创建 React 容器
      if (!this._container) {
        this._container =
          shadowRoot?.getElementById(`shadow-app-${pluginName}`) ||
          addElementToDom({
            tag: "div",
            attrs: {
              id: `shadow-app-${pluginName}`,
            },
            style: "position: fixed; z-index: var(--z-index);",
          })(shadowRoot);
      }

      if (!this._root) {
        // 创建 React root 并渲染组件
        this._root = createRoot(this._container);
        this._root.render(React.createElement(ComponentCaptureApp));
      }
    } catch (error) {
      maLogger.error("注入组件捕获模块失败:", error);
    }
  }

  /**
   * 启用模块
   */
  enable(): void {
    this.inject().catch((error) => {
      maLogger.error("启用组件捕获模块失败:", error);
    });
  }

  /**
   * 禁用模块
   */
  disable(): void {
    this.hide();
    this.cleanup();
  }

  /**
   * 触发组件捕获
   * 通过事件总线通知 React 组件启动捕获模式
   */
  async triggerComponentCapture(): Promise<void> {
    try {
      maLogger.log("开始组件捕获...");
      await this.inject();

      // 显示 React 容器
      if (this._container) {
        this._container.style.display = "block";
      }

      // 通过事件总线启动捕获（React 组件监听此事件）
      bus.emit("start-component-capture");
    } catch (error) {
      maLogger.error("触发组件捕获失败:", error);
    }
  }

  /**
   * 触发组件捕获（别名，保持向后兼容）
   */
  async captureComponent(): Promise<void> {
    return this.triggerComponentCapture();
  }

  /**
   * 隐藏捕获界面
   */
  private hide(): void {
    if (this._container) {
      this._container.style.display = "none";
      this.isCapturing = false;
      maLogger.log("组件捕获界面已隐藏");
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }

    if (this._container) {
      try {
        this._container.remove();
      } catch (error) {
        // 元素可能已经被移除
      }
      this._container = null;
    }

    this.isCapturing = false;
  }

  /**
   * 初始化
   */
  async init(context?: any): Promise<void> {
    this._ctx = context;
    maLogger.log("ComponentCaptureModule initialized with context");
  }
}

let moduleInstance: ComponentCaptureModule | null = null;

export default (context: AppContext): AppModule => {
  if (!moduleInstance) {
    moduleInstance = new ComponentCaptureModule();
    moduleInstance.init(context);
  }
  return moduleInstance;
};

/**
 * 触发组件捕获的快捷函数
 */
export function triggerComponentCapture(): void {
  if (moduleInstance) {
    moduleInstance.captureComponent();
  }
}
