/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/rainmeter/index.ts
 * @date 2026-02-05T02:38:01.691Z
 */

import { addElementToDom } from "@/utils/element-control";
import { shadowRoot } from "@/utils/shadow-dom";
import { AppModule } from "@/types";
import { useSingletonEffect } from "@/utils/singleton";
import { storage } from "@/stores";
import { Rain } from "./rain";

// 天气模拟工具类 - 使用Shadow DOM隔离
class Weather implements AppModule {
  _name: string = "天气模拟工具";
  _ctx: any = null;
  _root: any = null;
  _instance: any = null;
  _container: any = null;
  isInjected: boolean = false;
  isEnabled: boolean = false;
  constructor() {
    maLogger.log("天气模拟工具实例已创建");
  }

  async inject(): Promise<void> {
    try {
      if (window.self !== window.top) {
        maLogger.log("不是主页面，不注入文本选择工具栏");
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

      // 如果已经注入，则不重复注入
      if (this.isInjected && this._container && this._root && shadowRoot) {
        return;
      }

      if (!this.isInjected) {
        this.isInjected = true;
        this._container = addElementToDom({
          tag: "canvas",
          attrs: {
            id: "rainCanvas",
            width: window.innerWidth,
            height: window.innerHeight,
          },
          style: {
            position: "absolute",
            top: "0",
            left: "0",
            zIndex: "9999",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            backgroundColor: "transparent !important",
            opacity: "0.5",
          },
        })(document.documentElement);
      }
    } catch (error) {
      maLogger.error("注入文本选择工具栏失败:", error);
    }
  }

  enable(options?: any): void {
    try {
      if (!this.isInjected) {
        this.inject().catch((error) => {
          maLogger.error("注入文本选择工具栏失败:", error);
        });
        Rain();
      }

      this._container.style.display = "block";

      this.isEnabled = true;
      maLogger.log("沉浸式雨天已启用");
    } catch (error) {
      maLogger.error("启用沉浸式雨天失败:", error);
    }
  }
  disable(): void {
    try {
      this.isEnabled = false;
      this._container.style.display = "none";
      maLogger.log("文本选择工具栏已禁用");
    } catch (error) {
      maLogger.error("禁用文本选择工具栏失败:", error);
    }
  }

  /**
   * 初始化文本选择工具栏
   */
  async init(context?: any, options?: any): Promise<void> {
    this._ctx = context;
    try {
      const config = await storage.ext.local.get("appConfig");
      if (config?.appConfig?.[this._name] !== false) {
        this.enable();
      }
    } catch (error) {
      maLogger.error("初始化文本选择工具栏失败:", error);
    }
  }
}

const WeatherInstance = useSingletonEffect(new Weather());

export default (ctx: AppContext, options?: any): AppModule => {
  WeatherInstance.init(ctx);
  return WeatherInstance;
};
