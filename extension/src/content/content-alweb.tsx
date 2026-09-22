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
  getElementAbsolutePosition,
  PositionStrategy,
  cloneEl,
  addElementToDom,
  createEl,
} from "@/chrome-api";
import { InsertDomPosition, type Tool } from "@/types";
import { storage } from "@/stores";

import messenger from "@/message";
import { createContentFeatureRegistry } from "./runtime/content-feature-manager";
import { request } from "@/utils";
import JungleKnotButton from "@/components/Jungle-knot/Button";
import JungleKnotButtonStyle from "@/components/Jungle-knot/styles/button.scss?inline";
import { createRoot } from "react-dom/client";

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

  /**
   * 在指定元素旁挂载 QuickLogin Vue 组件到 Shadow DOM
   */
  const enrichQuickLogin = (
    byElement: HTMLElement,
    position: {
      strategy?: PositionStrategy;
      offset?: { x?: number; y?: number };
    },
  ): void => {
    if (!byElement) {
      return;
    }

    const shadowRoot = ctx.gmod("__SHADOW_DOM");
    if (!shadowRoot) {
      maLogger.error("Shadow DOM 不存在");
      return;
    }

    const positionInfo = getElementAbsolutePosition(byElement);
    // maLogger.log("positionInfo:", positionInfo);

    const adminButtonWrapper = createEl({
      tag: "div",
      attrs: {
        className: "quick-login-shadow-container",
      },
    });

    shadowRoot.appendChild(adminButtonWrapper);

    const root = createRoot(adminButtonWrapper);
    root.render(
      <>
        <style>
          {JungleKnotButtonStyle +
            ".operation-button__content span { font-size: 16px; }"}
        </style>
        <JungleKnotButton
          onClick={() => quickLogin("mp" + ADMIN, ADMIN + "123")}
          mainTitle="管理员登录"
        />
      </>,
    );

    const { strategy = PositionStrategy.Down, offset } = position;

    positionInfo.positionElement({
      targetElement: adminButtonWrapper,
      strategy,
      alignment: "center",
      offset,
      pinned: true,
      observeReference: true,
    });
  };

  featureRegistry.register("alweb.enrichQuickLogin", "管理员一键登录", () => {
    // 监听 quickLogin 事件
    if (location.hash.match("#/login")) {
      waitForSelector({
        selector: "#app > div > div.auth-page__main > div > form > button",
        filter: (el) => el.textContent === "登录",
        callback: (el) =>
          enrichQuickLogin(el!, { strategy: PositionStrategy.Down }),
        // addElementToDom({
        //   el,
        //   attrs: {
        //     textContent: "管理员登录",
        //     className: [
        //       "quick-login-shadow-container",
        //       ...el!.classList,
        //     ].join(" "),
        //   },
        //   eventlistener: {
        //     click: () => {
        //       quickLogin("mp" + ADMIN, ADMIN + "123");
        //     },
        //   },
        // })(el, InsertDomPosition.AE),
        maxWaitTimes: 10,
        useMutationObserver: true,
        timeout: 5000,
        once: true,
      });
    }
  });

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
