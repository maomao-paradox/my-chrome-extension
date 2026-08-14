/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/sidebar/index.ts
 * @date 2026-02-05T02:38:01.692Z
 *
 * Sidebar 应用入口（React 版）
 * 从 Vue 版 index.ts 迁移而来
 *
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import SidebarApp from "./App";
import type { Tool, AppModule, Bookmark } from "@/types";
import {
  $id,
  addElementToDom,
  shadowHost,
  shadowRoot,
  injectStyles,
} from "@/utils";
import { bus } from "@/event/bus";
import { storage } from "@/stores";
import { appConfigKey, shadowHostId } from "@/config";
import { IconDocument, IconBookmark } from "@/assets/icons";
import { BookmarkStorage } from "@/services/bookmarkStorage";

// 通过 ?raw 导入聚合 SCSS 为字符串
import sidebarStyles from "./styles/index.scss?raw";

/**
 * @author 不可以是我吗
 * @version v1.8.0
 * @license MIT
 * @sequence 阳光炽烈
 */

declare interface SideBarOptions {
  layout?: "vertical" | "horizontal" | "fold";
  tools?: Tool[];
  visible?: boolean;
}

class SideBar implements AppModule {
  _ctx: any = null;
  _root: Root | null = null;
  _instance: any | null = null;
  _container: HTMLElement | null = null;
  _name: string = "sidebar";
  isInjected: boolean = false;
  visible: boolean = false;
  isEnabled: boolean = false;
  stylesInjected: boolean = false;

  // 自定义工具配置
  private customTools: Tool[];

  // 自定义事件
  private loadSidebarEvent: CustomEvent;
  private unloadSidebarEvent: CustomEvent;

  constructor(options?: SideBarOptions) {
    // 初始化自定义工具配置
    // 注：原 Vue 版直接使用 IconDocument（?component svg），React 版保留引用但实际渲染由 HoverMenu 内部图标映射处理
    this.visible = options?.visible || false;
    this.customTools = options?.tools || [
      {
        id: "1",
        label: "关于",
        icon: IconDocument,
        color: "#409eff",
        children: [{ id: "hello", label: "bug", icon: IconDocument }],
      },
      {
        id: "2",
        label: "从三个选项中发现一个",
        icon: IconDocument,
        color: "#67c23a",
        children: [
          {
            id: "2-1",
            label: "喝一口水",
            details: "补充水分，保持身体水分平衡，提高工作效率",
          },
          {
            id: "2-2",
            label: "伸个懒腰",
            details: "缓解肌肉紧张，促进血液循环，减轻久坐带来的疲劳",
          },
          {
            id: "2-3",
            label: "眺望窗外",
            details: "放松眼部肌肉，缓解视疲劳，调节心情，提高工作效率",
          },
        ],
      },
    ];

    // 初始化自定义事件
    this.loadSidebarEvent = new CustomEvent("load-sidebar", {
      detail: { message: "Hello, World!" },
      bubbles: true,
      cancelable: true,
    });

    this.unloadSidebarEvent = new CustomEvent("unload-sidebar", {
      detail: { message: "Hello, World!" },
      bubbles: true,
      cancelable: true,
    });
  }

  /**
   * 将书签转换为工具格式
   */
  private async convertBookmarksToTools(): Promise<Tool[]> {
    try {
      const bookmarks = await BookmarkStorage.getBookmarks();

      // 按时间倒序排序
      bookmarks.sort((a, b) => b.timestamp - a.timestamp);

      // 转换为工具格式
      const bookmarkTools: Tool[] = bookmarks.map((bookmark: Bookmark) => ({
        id: `bookmark-${bookmark.id}`,
        label:
          bookmark.text.length > 30
            ? bookmark.text.substring(0, 28) + "..."
            : bookmark.text,
        icon: IconBookmark,
        color: "#f59e0b",
        details: new Date(bookmark.timestamp).toLocaleString(),
        onClick: () => this.openBookmark(bookmark),
      }));

      return bookmarkTools;
    } catch (error) {
      maLogger.error("转换书签失败:", error);
      return [];
    }
  }

  /**
   * 打开书签
   */
  private openBookmark(bookmark: Bookmark): void {
    chrome.runtime.sendMessage({
      type: "OPEN_BOOKMARK",
      payload: bookmark,
      target: "background",
    });
  }

  /**
   * 加载并更新书签工具
   */
  private async loadBookmarkTools(): Promise<void> {
    try {
      const bookmarkTools = await this.convertBookmarksToTools();

      // 更新工具列表，保留原有工具并添加书签
      const updatedTools = [
        ...this.customTools.filter((tool) => !tool.id.startsWith("bookmark-")),
        {
          id: "bookmarks",
          label: "书签",
          icon: IconBookmark,
          color: "#f59e0b",
          children: bookmarkTools,
        },
      ];

      this.updateTools(updatedTools);
    } catch (error) {
      maLogger.error("加载书签工具失败:", error);
    }
  }

  /**
   * 获取加载事件
   */
  public getLoadEvent(): CustomEvent {
    return this.loadSidebarEvent;
  }

  /**
   * 获取卸载事件
   */
  public getUnloadEvent(): CustomEvent {
    return this.unloadSidebarEvent;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 原 Vue 版的 load-sidebar / unload-sidebar 监听被注释，保留空实现
  }

  /**
   * 注入侧边工具栏到页面
   */
  public async inject(options?: SideBarOptions): Promise<void> {
    try {
      // 只有在主页面才注入侧边工具栏
      if (window.self !== window.top) {
        maLogger.log("不是主页面，不注入侧边工具栏");
        return;
      }

      // 确保 DOM 准备好
      await this.waitForBodyReady();

      // 如果已经注入，则不重复注入
      if (this.isInjected && this._root && this._container && shadowRoot) {
        return;
      }

      // 注入聚合 SCSS（?inline 导入的字符串）
      if (!this.stylesInjected && shadowRoot) {
        injectStyles(shadowRoot, sidebarStyles);
        this.stylesInjected = true;
        this.isInjected = true;
      }

      // 创建 React 容器
      if (
        !this._container &&
        !shadowRoot?.getElementById(`shadow-app-${this._name}`)
      ) {
        this._container = addElementToDom({
          tag: "div",
          attrs: { id: `shadow-app-${this._name}` },
          style: "position: fixed; z-index: var(--z-index);",
        })(shadowRoot);
      }

      // 设置事件监听器
      this.setupEventListeners();

      // 卸载旧的 React root
      if (this._root) {
        this._root.unmount();
        this._root = null;
      }

      // 创建 React root 并渲染 App
      const { tools, visible = this.visible } = options || {};
      this._root = createRoot(this._container!);
      this._root.render(
        React.createElement(SidebarApp, {
          tools: tools || this.customTools,
          visible,
        }),
      );
    } catch (error) {
      maLogger.error("注入侧边工具栏失败:", error);
    }
  }

  /**
   * 等待 document.body 准备好
   */
  private async waitForBodyReady(): Promise<void> {
    if (document.body) return;
    await new Promise<void>((resolve) => {
      const check = () =>
        document.body ? resolve() : requestAnimationFrame(check);
      check();
    });
  }

  /**
   * 启用侧边工具栏
   */
  public async enable(): Promise<void> {
    try {
      // 如果未注入，则先注入
      if (!this.isInjected) {
        await this.inject({ visible: true });
      } else {
        // 触发加载事件
        window.dispatchEvent(this.loadSidebarEvent);
        setTimeout(() => {
          window.dispatchEvent(this.unloadSidebarEvent);
        }, 1000);

        // 直接操作 DOM，确保组件显示
        if (this._container) {
          this._container.style.display = "block";
        }
      }
    } catch (error) {
      maLogger.error("启用侧边工具栏失败:", error);
    }
  }

  /**
   * 禁用侧边工具栏
   */
  public disable(): void {
    try {
      // 触发卸载事件
      window.dispatchEvent(this.unloadSidebarEvent);

      // 直接操作 DOM，确保组件被隐藏
      if (this._container) {
        this._container.style.display = "none";
        maLogger.info("侧边栏已直接隐藏");
      }
    } catch (error) {
      maLogger.error("禁用侧边工具栏失败:", error);
    }
  }

  /**
   * 初始化侧边工具栏
   */
  public async init(options?: SideBarOptions): Promise<void> {
    try {
      maLogger.log("初始化侧边工具栏");
      this.visible = options?.visible || false;
      this.customTools = options?.tools || this.customTools;

      // 加载书签工具
      await this.loadBookmarkTools();

      // 可以从存储中加载配置
      const config = await storage.ext.local.get(appConfigKey);
      if (config && config.sidebar && config.sidebar.value !== false) {
        this.enable();
      }
      // 设置事件监听器
      this.setupEventListeners();

      // 监听书签变化
      this.setupBookmarkListeners();
    } catch (error) {
      maLogger.error("初始化侧边工具栏失败:", error);
    }
  }

  /**
   * 设置书签变化监听器
   */
  private setupBookmarkListeners(): void {
    // 监听存储变化，当书签数据更新时重新加载
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.bookmarks) {
        maLogger.log("书签数据已更新，重新加载");
        this.loadBookmarkTools();
      }
    });
  }

  /**
   * 根据设置更新状态
   */
  public updateStatus(enabled: boolean): void {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }

  /**
   * 更新工具列表
   * @param tools 新的工具列表
   */
  public updateTools(tools: Tool[]): void {
    try {
      maLogger.log("开始更新侧边工具栏工具列表", tools);

      if (!tools || tools.length === 0) {
        maLogger.warn("更新侧边工具栏工具列表：工具列表为空");
        return;
      }

      // 更新内部工具列表
      this.customTools = [...tools];
      maLogger.log("已更新内部工具列表", this.customTools);

      // 使用事件总线发送更新事件
      maLogger.log("通过事件总线发送tools更新事件");
      bus.emit("update:sidebar:tools", this.customTools);

      // 如果工具栏还未注入，则注入
      if (!this._root && !this.isInjected) {
        this.inject({
          tools: this.customTools,
        });
      }
    } catch (error) {
      maLogger.error("更新侧边工具栏工具列表失败:", error);
    }
  }
}

export default (ctx: AppContext, options?: any): AppModule => {
  const appInstance = new SideBar(options);
  appInstance.init(options);
  return appInstance;
};
