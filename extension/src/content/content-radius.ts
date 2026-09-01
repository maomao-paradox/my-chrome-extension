/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-radius.ts
 * @date 2026-02-05T02:38:01.694Z
 */

import {
  addElementToDom,
  injectScriptToActivateTab,
  waitForSelector,
  whenDomReady,
} from "@/utils/element-control";
import { Tool } from "@/types";
import messenger from "@/message";
import { requestAI } from "@/utils/ai-request";
import { createContentFeatureRegistry } from "./runtime/content-feature-manager";
import lmaskStyles from "@/assets/styles/lmask.scss?inline";

function addLoadingMask(el: HTMLElement, loadingText: string = "填写中...") {
  if (!el) {
    console.warn(`[addLoadingMask] 未找到元素`);
    return 0;
  }
  // 注入全局动画样式 (只注入一次)
  const styleId = "lmask-global-styles";
  if (!document.getElementById(styleId)) {
    const styleSheet = document.createElement("style");
    styleSheet.id = styleId;
    styleSheet.textContent = lmaskStyles;
    document.head.appendChild(styleSheet);
  }

  let count = 0;

  // 如果已有遮罩，更新文案并返回
  const existing = el.querySelector<HTMLElement>(".lmask-overlay");
  if (existing) {
    const txt = existing.querySelector(".lmask-text");
    if (txt) {
      // 保留文案但更新内容
      const textNode = txt.childNodes[0];
      if (textNode) textNode.textContent = loadingText;
    }
    existing.style.display = "flex";
    existing.style.opacity = "1";
    count++;
    return;
  }

  // 确保父元素有定位上下文
  const style = window.getComputedStyle(el);
  if (style.position === "static") {
    el.style.position = "relative";
  }

  // 创建遮罩容器
  const mask = document.createElement("div");
  mask.className = "lmask-overlay";

  // 创建 spinner
  const spinner = document.createElement("div");
  spinner.className = "lmask-spinner";

  // 创建文字
  const textEl = document.createElement("div");
  textEl.className = "lmask-text";
  textEl.textContent = loadingText;

  mask.appendChild(spinner);
  mask.appendChild(textEl);
  el.appendChild(mask);
  count++;

  return count;
}

function removeLoadingMask(el: HTMLElement): number {
  if (!el) {
    console.warn(`[removeLoadingMask] 未找到元素`);
    return 0;
  }

  let removedCount = 0;
  const masks = el.querySelectorAll(".lmask-overlay");
  if (masks.length) {
    masks.forEach((mask) => mask.remove());
    removedCount += masks.length;
  }
  return removedCount;
}

export default (ctx: AppContext, config = {}) => {
  const featureRegistry = createContentFeatureRegistry({
    scriptId: "radius",
    scriptName: "Radius",
  });
  const tools: Tool[] = [
    {
      id: "contentReplace",
      label: "批量替换",
    },
    {
      id: "ExportPatientData",
      label: "批量导出患者数据",
    },
  ];

  const updateSidebar = async (tools: Tool[]) => {
    // 侧边栏配置
    try {
      // 只在主页面更新侧边栏，避免iframe中重复创建
      if (ctx.self === ctx.top) {
        const sideBarInstance: any = ctx.gmod("__MODULE_SIDEBAR");

        // 如果sidebar实例不存在，尝试获取sidebar模块并加载
        if (!sideBarInstance) {
          // 使用封装好的messenger发送消息给content/index.ts
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
    } catch (error) {
      maLogger.log("发送侧边栏工具更新请求失败: ", error);
    }
  };

  /**
   * 切换版本函数
   * @param element 版本选择元素
   */
  const switchVersion = (element: HTMLElement) => {
    // 创建 select 元素
    const selectElement = document.createElement("select");
    selectElement.className = element.className;
    selectElement.style.cssText =
      element.style.cssText +
      "border: none; background: #202020; outline: none; cursor: pointer; font-family: MicrosoftYaHei; font-size: 12px; color: rgba(255, 255, 255, .8);";

    // 添加选项
    const versions = [
      { value: "v3.0.0", text: "v3.0.0.11" },
      { value: "v3.0.1", text: "v3.0.1.11" },
      { value: "v3.0.2", text: "v3.0.2.11" },
    ];

    versions.forEach((version) => {
      const option = document.createElement("option");
      option.value = version.value;
      option.textContent = version.text;
      selectElement.appendChild(option);
    });

    // 添加切换事件
    selectElement.addEventListener("change", (e) => {
      const selectedVersion = (e.target as HTMLSelectElement).value;
      maLogger.log("切换到版本:", selectedVersion);
      // 这里可以添加版本切换的逻辑
      // 发送指令到后台脚本
      messenger.ext.send({
        type: "SWITCH_VERSION",
        payload: { version: selectedVersion, name: "radius" },
        target: "background",
      });
    });

    // 替换元素
    element.parentNode?.replaceChild(selectElement, element);
  };

  featureRegistry.register("radius.version-label", "版本标记", async () => {
    const controller = new AbortController();
    waitForSelector({
      selector:
        "#app > div > div > div.top-menu-bar > div.top-menu-bar__left > span",
      signal: controller.signal,
      timeout: 10000,
      callback: (element: HTMLElement) => {
        element.innerText = "内测版";
      },
    }).catch((err) => maLogger.error(err));
    return () => controller.abort();
  });

  // cypress();
  // updateSidebar(tools)

  const handleFillForm = (tableElement?: HTMLElement) => {
    const EL_TABLE_HEADER = "table.el-table__header";
    const EL_TABLE_BODY = "table.el-table__body";

    const tableEl =
      tableElement ||
      document.querySelector<HTMLElement>(".el-table__inner-wrapper");

    maLogger.log("tableEl:", tableEl);
    if (!tableEl) {
      return () => Promise.resolve(null);
    }
    const header = tableEl.querySelector(EL_TABLE_HEADER);
    const body = tableEl.querySelector(EL_TABLE_BODY);
    if (!header || !body) {
      return () => Promise.resolve(null);
    }

    const headerTitle = Array.from(
      header.querySelectorAll("thead > tr:last-child > th"),
    );
    maLogger.log(
      "表头:",
      headerTitle.map((item) => item.textContent),
    );
    const bodyRows = Array.from(body.querySelectorAll("tbody > tr"));
    maLogger.log("表体:", bodyRows.length);

    return async () => {
      try {
        addLoadingMask(tableEl);
        // 调用AI生成JSON数据
        const result = await requestAI(
          `请根据表头 \`${headerTitle.map(
            (item) => item.textContent,
          )}\` 和表体${bodyRows.length}行，生成一个合法的JSON字符串。JSON输出结构如下：[{"key1": "你好", "key2": "2026-04-21", "..."}, {...}, {...} ...]`,
          {
            systemPrompt:
              "你是一个数据处理助手，请只输出合法的JSON字符串，不要包含任何其他文字或解释。",
            timeoutMs: 30000,
            role: "table_data_generator",
          },
        );

        if (!result.success) {
          console.error("AI请求失败:", result.error);
        }

        const jsonData = JSON.parse(result.content);

        bodyRows.forEach((item) => {
          const cells = Array.from(item.querySelectorAll("td"));
          const rowData = jsonData.pop();
          if (!rowData) {
            return;
          }
          maLogger.log("rowData:", rowData);
          cells.forEach((cell, index) => {
            const input =
              cell.querySelector("input") || cell.querySelector("textarea");
            if (input && headerTitle[index]) {
              input.value = rowData[headerTitle[index].textContent || ""] || "";
              input.dispatchEvent(new Event("input", { bubbles: true }));
              if (input.ariaHasPopup === "dialog") {
                input.dispatchEvent(new Event("change", { bubbles: true }));
                input.dispatchEvent(new Event("blur", { bubbles: true }));
              }
            }
          });
        });
      } catch (error) {
        console.error("处理表格数据失败:", error);
      } finally {
        removeLoadingMask(tableEl);
      }
    };
  };

  featureRegistry.register("radius.fill-form", "AI 填充表单", async () => {
    const controller = new AbortController();
    const inserted: HTMLElement[] = [];
    void waitForSelector({
      selector: [
        "#app > div > div > div.main-content > div.main-content-wrapper > div > div.data-input-content > div.right-content > div.right-content-body > div",
        "#app > div > div > div.main-content > div.main-content-wrapper > div > div.data-input-content > div.right-content > div.right-content-body > div > div.el-overlay.el-modal-dialog > div > div > div.el-dialog__body",
      ],
      signal: controller.signal,
      timeout: 10000,
      callback: (el: HTMLElement) => {
        const buttonEl =
          el.querySelector<HTMLButtonElement>(
            ".operation-buttons-wrapper > div > button:nth-child(3)",
          ) ||
          el.querySelector<HTMLButtonElement>(
            ".sub-form-toolbar > .el-button--primary",
          );
        maLogger.log("buttonEl:", buttonEl);
        const tableEl = el.querySelector<HTMLElement>(
          ".el-table__inner-wrapper",
        );
        if (!buttonEl || !tableEl) {
          return;
        }
        const added = addElementToDom({
          tag: buttonEl,
          attrs: {
            innerText: "填充表单",
          },
          eventlistener: {
            click: handleFillForm(tableEl),
          },
        })(buttonEl, "afterend") as HTMLElement;
        inserted.push(added);
      },
    }).catch((err) => maLogger.error(err));
    return () => {
      controller.abort();
      inserted.forEach((element) => element.remove());
    };
  });

  featureRegistry.register(
    "radius.general-config-link",
    "通用配置入口",
    async () => {
      const controller = new AbortController();
      let inserted: HTMLElement | null = null;
      waitForSelector({
        selector:
          "#app > div > div > div.main-content > div.main-content-wrapper > div > div.data-source-header > span",
        signal: controller.signal,
        timeout: 10000,
        callback: (element: HTMLElement) => {
          inserted = addElementToDom({
            tag: "a",
            attrs: {
              href: "/#/datalake/config-driven-designer",
              target: "_self",
              innerText: "通用配置",
            },
            style: {
              marginLeft: "10px",
              color: "var(--el-color-primary)",
              fontSize: "14px",
            },
          })(element, "afterend") as HTMLElement;
        },
      }).catch((err) => maLogger.error(err));
      return () => {
        controller.abort();
        inserted?.remove();
      };
    },
  );

  featureRegistry.register(
    "radius.database-view-link",
    "数据库视图入口",
    async () => {
      const controller = new AbortController();
      let inserted: HTMLElement | null = null;
      waitForSelector({
        selector:
          "#app > div > div > div.main-content > div.main-content-wrapper > div > div.search-header-wrapper > div.search-header-left > span",
        signal: controller.signal,
        timeout: 10000,
        callback: (element: HTMLElement) => {
          inserted = addElementToDom({
            tag: "a",
            attrs: {
              href: "/#/dict-config/dbviewer",
              target: "_self",
              innerText: "数据库视图",
            },
            style: {
              marginLeft: "10px",
              color: "var(--el-color-primary)",
              fontSize: "14px",
            },
          })(element, "afterend") as HTMLElement;
        },
      }).catch((err) => maLogger.error(err));
      return () => {
        controller.abort();
        inserted?.remove();
      };
    },
  );

  featureRegistry.register(
    "radius.legacy-import-tab",
    "注入旧版数据页签配置",
    async () => {
      await new Promise<void>((resolve) => whenDomReady(resolve));
      await injectScriptToActivateTab({
        scriptStr: "__APP_CONFIG__.ENABLE_LEGACY_DATA_INPUT_TAB_IMPORT=true",
      });
      return async () => {
        await injectScriptToActivateTab({
          scriptStr:
            "__APP_CONFIG__.ENABLE_LEGACY_DATA_INPUT_TAB_IMPORT=undefined",
        });
      };
    },
  );

  void featureRegistry.initialize();

  return {};
};
