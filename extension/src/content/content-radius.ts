/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-radius.ts
 * @date 2026-02-05T02:38:01.694Z
 */

import { addElementToDom, waitForSelector } from "@/utils/element-control";
import { Tool } from "@/types";
import messenger from "@/message";
import { requestAI } from "@/utils/ai-request";
import { event } from "jquery";

export default (ctx: AppContext, config = {}) => {
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

  // 切换版本
  waitForSelector({
    selector:
      "#app > div > div > div.top-menu-bar > div.top-menu-bar__left > span",
    timeout: 10000,
    callback: switchVersion,
  });

  // cypress();
  // updateSidebar(tools)

  const handleFillForm = (tableElement?: HTMLElement) => {
    const EL_TABLE_HEADER = "table.el-table__header";
    const EL_TABLE_BODY = "table.el-table__body";

    const tableEl =
      tableElement || document.querySelector(".el-table__inner-wrapper");
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
        // 调用AI生成JSON数据
        const result = await requestAI(
          `请根据表头 \`${headerTitle.map((item) =>
            item.textContent.startsWith("*")
              ? item.textContent.slice(1)
              : item.textContent || "",
          )}\` 和表体${bodyRows.length}行，生成一个合法的JSON字符串。JSON输出结构如下：[{"${headerTitle[0].textContent}": "value1", "${headerTitle[1].textContent}": "value2", "..."}]`,
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
          cells.forEach((cell, index) => {
            const input = cell.querySelector("input");
            if (input && headerTitle[index]) {
              input.value = rowData[headerTitle[index].textContent || ""] || "";
              const event = new Event("input", { bubbles: true });
              input.dispatchEvent(event);
              maLogger.log(
                `已填入${headerTitle[index].textContent || ""},输入框值:`,
                input.value,
              );
            }
          });
        });
      } catch (error) {
        console.error("处理表格数据失败:", error);
      }
    };
  };

  waitForSelector({
    selector:
      "#app > div > div > div.main-content > div.main-content-wrapper > div > div.data-input-content > div.right-content > div.right-content-body > div",
    timeout: 10000,
    callback: (el: HTMLElement) => {
      const buttonEl = el.querySelector<HTMLButtonElement>(
        ".operation-buttons-wrapper > div > button:nth-child(3)",
      )!;
      addElementToDom({
        tag: buttonEl,
        attrs: {
          innerText: "填充表单",
        },
        eventlistener: {
          click: handleFillForm(el),
        },
      })(buttonEl, "afterend");
    },
  });

  return {};
};
