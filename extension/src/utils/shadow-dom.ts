/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/shadow-dom.ts
 * @date 2026-02-05T02:38:01.699Z
 */

import { $id, addElementToDom } from "./element-control";
// 直接导入CSS文件内容，Vite会将其转换为字符串
//@ts-ignore
import shadowThemeCss from "@/assets/styles/shadow-theme.css?raw";
//@ts-ignore
import elementPlusCss from "element-plus/dist/index.css?raw";

export function createShadowHost(id: string, mode: ShadowRootMode) {
  // 检查是否已存在
  let existingHost = $id(id);
  if (existingHost) {
    // maLogger.log("已存在Shadow Host:", existingHost);
    return {
      shadowHost: existingHost,
      shadowRoot: existingHost.shadowRoot,
    };
  }

  // 创建新的宿主元素（使用普通 div 元素）
  const shadowHost = document.createElement("div");
  shadowHost.id = id;
  Object.assign(shadowHost.style, {
    overflow: "visible",
    position: "absolute",
    top: "0px",
    left: "0px",
    display: "block",
  });

  // 添加到文档体的开头
  document.body.insertBefore(shadowHost, document.body.firstChild);

  // 创建 Shadow Root
  const shadowRoot = shadowHost.attachShadow({ mode });
  // 注入 Element Plus 样式
  injectStyles(shadowRoot, elementPlusCss, true);
  // 注入主题CSS，覆盖 Element Plus 样式
  injectStyles(shadowRoot, shadowThemeCss);

  return { shadowHost, shadowRoot };
}

/**
 * 向 Shadow DOM 中注入内联样式
 * @param {ShadowRoot} shadowRoot - Shadow Root 实例
 * @param {string} styles - CSS 字符串
 * @param {boolean} replaceRootSelector - 是否将 :root 替换为 :host (默认: false)
 */
export function injectStyles(
  shadowRoot: ShadowRoot,
  styles: string,
  replaceRootSelector: boolean = false,
) {
  // 如果需要替换 :root 选择器为 :host
  if (replaceRootSelector) {
    styles = styles.replace(/:root/g, ":host");
  }

  const styleElement = document.createElement("style");
  styleElement.textContent = styles;
  // 在顶部插入样式，确保覆盖默认样式
  shadowRoot.insertBefore(styleElement, shadowRoot.firstChild);
}

/**
 * 读取CSS文件并注入到Shadow DOM中
 * @param {ShadowRoot} shadowRoot - Shadow Root 实例
 * @param {string} cssUrl - CSS文件URL
 */
export async function injectCssDom(shadowRoot: ShadowRoot, cssUrl: string) {
  try {
    const cssContent = await fetch(cssUrl).then((res) => res.text());
    injectStyles(shadowRoot, cssContent);
    return cssContent;
  } catch (error) {
    maLogger.error(
      "Error reading and injecting CSS:",
      error,
      `CSS URL: ${cssUrl}`,
    );
    throw error;
  }
}

/**
 * 向 Shadow DOM 中注入外部样式文件
 * @param {ShadowRoot} shadowRoot - Shadow Root 实例
 * @param {string} href - 样式文件URL
 */
export function injectStyleLink(shadowRoot: ShadowRoot, href: string) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  shadowRoot.appendChild(link);
}
