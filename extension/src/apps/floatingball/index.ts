/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/floatingball/index.ts
 * @date 2026-02-05T02:38:01.689Z
 */

import { pinia } from "@/stores";
import FloatBallApp from "./App.vue";
import { createApp } from "vue";
import { $id, addElementToDom } from "@/utils/element-control";
import { createShadowHost, injectCssDom } from "@/utils/shadow-dom";
import { Tool } from "@/types/index.js";
import {
  getAssetsAbstractPathSync,
  getStaticAbstractPath,
} from "@/utils/common";
import { storage } from "@/stores";
import { appConfigKey } from "@/config";
import { AppModule } from "@/types/utils/index.js";
import { shadowHostId } from "@/config";

/**
 * @author 月光下的牧师
 * @version v1.0.0
 * @license MIT
 * @sequence Ⅲ 牧师
 */

// export const shadowHostId = "floating-shadow"

// 定义悬浮球选项接口
declare interface FloatingBallOptions {
  tools?: Tool[];
  visible?: boolean;
  icon?: string;
}

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

class FloatingBall implements AppModule {
  _ctx: any = null;
  shadowHostId: string = shadowHostId;
  isInjected: boolean = false;
  vueContainer: HTMLElement | null = null;
  shadowRoot: ShadowRoot | null = null;
  appInstance: any | null = null;
  isEnabled: boolean = false;
  // 自定义工具配置
  private customTools: Tool[] = [
    {
      id: "glass-card",
      label: "悬浮毛玻璃卡片",
      details:
        "创建一个可拖动、可调宽高和透明度的毛玻璃悬浮卡片，双击空白区域即可关闭",
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
      if (window.self !== window.top) {
        return (maLogger.log("不是主页面，不注入悬浮球"), void 0);
      }
      await waitForBodyReady();
      if (
        this.isInjected &&
        this.appInstance &&
        this.vueContainer &&
        this.shadowRoot &&
        $id(this.shadowHostId)
      ) {
        return;
      }

      if (!this.shadowRoot) {
        const { shadowRoot } = createShadowHost(this.shadowHostId, "open");
        this.shadowRoot = shadowRoot;
      }

      const { tools, visible = true, icon } = options || {};

      if (!this.isInjected) {
        injectCssDom(
          this.shadowRoot as ShadowRoot,
          getAssetsAbstractPathSync("css/floatingball"),
        );
        this.isInjected = true;
      }

      if (
        !this.vueContainer &&
        !this.shadowRoot?.getElementById("shadow-app-floatingball")
      ) {
        this.vueContainer = addElementToDom({
          tag: "div",
          attrs: { id: "shadow-app-floatingball" },
          style: "position: fixed; z-index: var(--z-index);",
        })(this.shadowRoot as ShadowRoot);
      }

      this.setupEventListeners();

      if (this.appInstance) {
        this.appInstance.unmount();
        this.appInstance = null;
      }

      this.appInstance = createApp(FloatBallApp, {
        tools: tools || this.customTools,
        visible,
        icon: icon || getStaticAbstractPath("icons/floatingball.png"),
      });

      this.appInstance.use(pinia);
      this.appInstance.mount(this.vueContainer);
    } catch (error) {
      maLogger.error("注入悬浮球失败:", error);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.vueContainer) {
      return;
    }

    // 监听显示/隐藏事件
    window.addEventListener("unload-floatingball", () => {
      if (this.vueContainer) {
        this.vueContainer.style.display = "none";
      }
    });

    window.addEventListener("load-floatingball", () => {
      if (this.vueContainer) {
        this.vueContainer.style.display = "block";
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

      // 直接操作DOM，确保组件被隐藏
      if (this.vueContainer) {
        this.vueContainer.style.display = "none";
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
      // 可以从存储中加载配置
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

// 导出默认函数，兼容ESMModuleLoader
export default (ctx: AppContext, options?: any): AppModule => {
  const appInstance = new FloatingBall();
  appInstance.init();
  return appInstance;
};
