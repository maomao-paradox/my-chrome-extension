/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-mria.ts
 * @date 2026-02-05T02:38:01.694Z
 */
import {
  whenDomReady,
  waitForSelector,
} from "@/document-api";
import type { Tool } from "@/types";
import { storage } from "@/stores";

import messenger from "@/message";
import { createContentFeatureRegistry } from "./runtime/content-feature-manager";
import { request } from "@/utils";

const ADMIN = "admin";

export default (ctx: AppContext & { userInfo: any }, config = {}) => {
  const featureRegistry = createContentFeatureRegistry({
    scriptId: "alweb",
    scriptName: "ALWEB",
  });

  const quickLogin = async (username: string, password: string) => {
    if (!username || !password) {
      ctx.message.error("用户名或密码不能为空");
      return;
    }
    try {
      await request.post("/portal/logout");
      const loginRes = await request.post("/portal/login", {
        account_no: username,
        password,
      });
      if (loginRes.code === 10000) {
        ctx.message.success("登录成功");
      } else {
        ctx.message.error(loginRes.msg);
      }
      storage.page.local.set("Manteia-UserInfo", JSON.stringify(loginRes.data));
      // document.cookie = "Portal-token=" + loginRes.data["access_token"];
      // 使用接口响应标头的set-Cookie设置cookie
      // 重新构建requester
      location.reload();
    } catch (err) {
      maLogger.error(err);
    }
  };

  featureRegistry.register("alweb.enrichQuickLogin", "管理员一键登录", () => {
    const controller = new AbortController();
    const cleanupHandlers: Array<() => void> = [];

    if (location.hash.match("#/login")) {
      void waitForSelector({
        selector:
          "#app > div > div.auth-page__main > div > form > div.login-title > img",
        signal: controller.signal,
        once: true,
        callback: (el) => {
          const image = el as HTMLImageElement;
          const originalCursor = image.style.cursor;
          const originalTransition = image.style.transition;
          const originalTransform = image.style.transform;
          const handleClick = () => {
            void quickLogin("mp" + ADMIN, ADMIN + "123");
          };
          const handlePointerDown = () => {
            image.style.transform = "scale(0.9)";
          };
          const restoreImage = () => {
            image.style.transform = originalTransform;
          };

          image.style.cursor = "pointer";
          image.style.transition = "transform 120ms ease";
          image.addEventListener("click", handleClick);
          image.addEventListener("pointerdown", handlePointerDown);
          image.addEventListener("pointerup", restoreImage);
          image.addEventListener("pointercancel", restoreImage);
          image.addEventListener("pointerleave", restoreImage);

          cleanupHandlers.push(() => {
            image.removeEventListener("click", handleClick);
            image.removeEventListener("pointerdown", handlePointerDown);
            image.removeEventListener("pointerup", restoreImage);
            image.removeEventListener("pointercancel", restoreImage);
            image.removeEventListener("pointerleave", restoreImage);
            image.style.cursor = originalCursor;
            image.style.transition = originalTransition;
            image.style.transform = originalTransform;
          });
        },
        useMutationObserver: true,
        timeout: 5000,
      }).catch((error) => {
        if (!controller.signal.aborted) {
          maLogger.error("等待管理员登录图片失败:", error);
        }
      });
    }

    return () => {
      controller.abort();
      cleanupHandlers.forEach((cleanup) => cleanup());
    };
  }, { restartOnRouteChange: true });

  const updateSidebar = async (tools: Tool[]) => {
    // 侧边栏配置
    try {
      // 只在主页面更新侧边栏，避免iframe中重复创建
      if (ctx.self === ctx.top) {
        const sideBarInstance = ctx.gmod("__MODULE_SIDEBAR");
        maLogger.info("当前sidebar实例:", sideBarInstance);

        // 如果sidebar实例不存在，尝试获取sidebar模块并加载
        if (!sideBarInstance) {
          // 发送消息给content/index.ts，请求加载sidebar并更新工具
          messenger.ext.send({
            type: "UPDATE_SIDEBAR_TOOLS",
            payload: { tools },
            target: "content",
          });
        } else {
          // 如果sidebar实例存在，直接调用updateTools
          sideBarInstance.updateTools(tools);
        }
      }
    } catch (error: any) {
      maLogger.error("发送侧边栏工具更新请求失败:", error.message);
    }
  };

  // featureRegistry.register("mria.removeDisabled", "解除元素禁用状态", () =>
  //   whenDomReady(removeDisabled),
  // );

  // featureRegistry.register("mria.xhrPatch", "XHR补丁注入", () =>
  //   whenDomReady(() => injectXhrPatch(xhrRules["mria"])),
  // );

  whenDomReady(() => {
    // 初始化侧边栏
    // updateSidebar(tools);
  });

  ctx.message.success("ALWEB 脚本初始化完成！");

  void featureRegistry.initialize();
  return {};
};
