/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/chrome-api/element-control.ts
 * @date 2026-02-05T02:38:01.698Z
 */

import {
  StyleObject,
  AttributeObject,
  EventListenerObject,
  CreateElemOpts,
  CloneElemOpts,
  AddElemOpts,
  InsertDomPosition,
} from "@/types";
import { getSingleFileScript } from "@/utils";

function getDoc(): Document {
  if (typeof document === "undefined") {
    const err = new Error("当前环境没有 document，$id / $query 被调用");
    console.error(err.stack);
    throw err;
  }
  return document;
}

export function $id<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return getDoc().getElementById(id) as T | null;
}

export function $query<T extends Element = Element>(
  selector: string,
): NodeListOf<T> {
  return getDoc().querySelectorAll<T>(selector);
}

export function whenDomReady(callback: () => void) {
  if (document?.body) {
    callback();
  } else {
    window.addEventListener("load", callback, { once: true });
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  if (typeof func !== "function") {
    throw new Error("func is not a function");
  }
  let timeout: NodeJS.Timeout | null = null;
  let lastRun = 0;
  return function (this: any, ...args: any[]) {
    const now = Date.now();
    if (now - lastRun >= wait) {
      func.apply(this, args);
      lastRun = now;
    } else if (!timeout) {
      timeout = setTimeout(() => {
        func.apply(this, args);
        lastRun = Date.now();
        timeout = null;
      }, wait);
    }
  };
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  if (typeof func !== "function") {
    throw new Error("func is not a function");
  }
  let timeout: NodeJS.Timeout | null = null;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeout!);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export function getElStyle(el: HTMLElement): CSSStyleDeclaration {
  return el.style || window.getComputedStyle(el, null);
}

export function setElStyle(el: HTMLElement, style: string | StyleObject): void {
  if (typeof style === "string") {
    el.style.cssText = style;
  } else if (typeof style === "object" && Object.keys(style).length > 0) {
    try {
      for (const i in style) {
        el.style[i as any] = style[i];
      }
    } catch (error) {
      maLogger.error(`setElStyle error: ${error}`);
    }
  }
}

export function setElAttributes(el: HTMLElement, attrs: AttributeObject): void {
  // maLogger.log("setElAttributes:", attrs);
  if (typeof attrs === "object" && Object.keys(attrs).length > 0) {
    for (const [k, v] of Object.entries(attrs)) {
      try {
        // maLogger.log(k, v);
        k === "class" ? (el.className = v as string) : ((el as any)[k] = v);
      } catch (error) {
        maLogger.error(`setElAttributes ${k} error: ${error}`);
      }
    }
  }
  // maLogger.log("设置之后的:", el);
}

export function setElEventListeners(
  el: HTMLElement,
  events: EventListenerObject,
): void {
  if (typeof events === "object" && Object.keys(events).length > 0) {
    for (const i in events) {
      try {
        el.removeEventListener(i, events[i]);
        el.addEventListener(i, events[i]);
      } catch (error) {
        maLogger.error(`setElEventListeners ${i} error: ${error}`);
      }
    }
  }
}

export function createEl(options: CreateElemOpts): HTMLElement {
  const { el, tag, attrs, style, eventlistener, children } = options;

  let newEl: HTMLElement | undefined;
  if (typeof tag === "string") {
    newEl = document.createElement(tag) as HTMLElement;
  } else if (el instanceof HTMLElement) {
    newEl = el as HTMLElement;
  }
  if (!newEl) {
    throw new Error("createEl error: tag is not a string or HTMLElement");
  }

  if (tag === "button") {
    (el as HTMLButtonElement).type = "button";
  }
  if (attrs) {
    setElAttributes(newEl, attrs);
  }
  if (style) {
    setElStyle(newEl, style);
  }
  if (eventlistener) {
    setElEventListeners(newEl, eventlistener);
  }
  if (children && Array.isArray(children) && children.length > 0) {
    children.forEach((child) => {
      newEl.appendChild(child instanceof HTMLElement ? child : createEl(child));
    });
  }

  return newEl;
}

export function cloneEl(el: HTMLElement, options: CloneElemOpts): HTMLElement {
  const { deep, attrs, style, eventlistener, children } = options;
  const cloned = el.cloneNode(deep) as HTMLElement;
  return createEl({ el: cloned, attrs, style, eventlistener, children });
}

const setupAutoRemove = ($el: HTMLElement, delay: number): void => {
  $el.onload = () =>
    setTimeout(() => {
      try {
        $el.remove();
      } catch (e) {
        maLogger.error("Failed to auto remove element:", e);
      }
    }, delay);
};

const insertElementIntoDom = (
  $el: HTMLElement,
  refEl: Element | ShadowRoot,
  position?: InsertPosition,
): void => {
  if ("insertAdjacentElement" in refEl) {
    const positions = [
      InsertDomPosition.BB,
      InsertDomPosition.AB,
      InsertDomPosition.BE,
      InsertDomPosition.AE,
    ];
    const pos =
      position && positions.includes(position)
        ? position
        : InsertDomPosition.BE;
    refEl.insertAdjacentElement(pos, $el);
  } else if (["start", "begin", "first"].includes(position || "")) {
    refEl.prepend($el);
  } else {
    refEl.appendChild($el);
  }
};

const createDomElement = (opts: AddElemOpts): HTMLElement => {
  const { el, tag, attrs, style, eventlistener, children } = opts;
  if (typeof el === "object" && "nodeType" in el && el.nodeType === 1) {
    return cloneEl(el as HTMLElement, {
      deep: true,
      attrs,
      style,
      eventlistener,
      children,
    });
  }
  return createEl({ el, tag, attrs, style, eventlistener, children });
};

/**
 * 向 DOM 中添加元素
 * @param opts 元素添加选项
 * @returns 一个函数，用于将元素添加到指定的 DOM 元素中，通常配合waitForElement使用
 */
export function addElementToDom(opts: AddElemOpts) {
  if (typeof document === "undefined") {
    maLogger.warn("Document object is not available in current context");
    return () => {
      throw new Error("Cannot create DOM element: document is not available");
    };
  }

  const { tag, attrs, style, eventlistener, children, autoRemoveDelay } = opts;
  const elemId = attrs?.id as string;

  if (elemId) {
    const existing = $id(elemId) as HTMLElement;
    if (existing) {
      try {
        eventlistener && setElEventListeners(existing, eventlistener);
      } catch (e) {
        maLogger.error(`Failed setting listeners on #${elemId}:`, e);
      }
      return () => existing;
    }
  }

  const $el = createDomElement(opts);
  if (autoRemoveDelay && typeof autoRemoveDelay === "number") {
    setupAutoRemove($el, autoRemoveDelay);
  }

  return (
    referElement?: Element | HTMLElement | ShadowRoot,
    position?: InsertPosition,
  ): HTMLElement => {
    const refEl = referElement || document.body;
    if (!refEl || typeof refEl !== "object" || !("nodeType" in refEl)) {
      throw new Error(`Invalid DOM element: ${String(refEl)}`);
    }
    insertElementIntoDom($el, refEl, position);
    return $el;
  };
}

const createScriptElement = async (
  type: "file" | "code",
  content: string,
): Promise<HTMLScriptElement> => {
  if (!["file", "code"].includes(type) || content.length === 0) {
    throw new Error("injectScript: type must be 'file' or 'code'.");
  }

  const scriptSrc =
    type === "code"
      ? (sessionStorage.setItem("--script-content--", content),
        getSingleFileScript("inject"))
      : content;

  const script = document.createElement("script");
  script.src = scriptSrc;
  script.id = "inject-script";

  script.onload = (evt: Event) => {
    (evt.target as HTMLElement)?.remove();
    // showSuccessMessage("脚本已生效!");
    maLogger.info("脚本已生效!");
  };

  script.onerror = (evt: Event | any) => {
    maLogger.error(`${content}脚本注入失败：`, evt.message);
  };

  return script;
};

interface InjectScriptOptions {
  file?: string;
  scriptStr?: string;
  root?: HTMLElement;
}

export async function injectScriptToActivateTab(
  opts: InjectScriptOptions,
): Promise<void> {
  const { file, scriptStr, root } = opts;
  if (!file && !scriptStr) {
    throw new Error("Either file or scriptStr is required.");
  }

  const type = file ? "file" : "code";
  const content = file || scriptStr;

  try {
    const script = await createScriptElement(type, content!);
    (root ?? document.body).appendChild(script);
  } catch (err: any) {
    maLogger.error(`${content}脚本注入失败：`, err.message);
    throw err;
  }
}

export function addFileInput(
  fileChangeFunc: (file: File) => Promise<void>,
): HTMLInputElement {
  try {
    if (fileChangeFunc === undefined || typeof fileChangeFunc !== "function") {
      throw new Error("The fileChangeFunc is not a function.");
    }

    const addUploadEl = addElementToDom({
      tag: "input",
      attrs: { id: "upload-files", type: "file" },
      style: { display: "none" },
      autoRemoveDelay: 1000,
      eventlistener: {
        change: async () => {
          try {
            const selectedFile = ($id("upload-files") as HTMLInputElement)
              .files![0];
            const { name, size } = selectedFile;
            await fileChangeFunc(selectedFile);
          } catch (error) {
            maLogger.error(error);
            throw error;
          }
        },
      },
    });

    return (
      typeof addUploadEl === "function" ? addUploadEl.call(null) : addUploadEl
    ) as HTMLInputElement;
  } catch (error) {
    maLogger.error(error);
    throw error;
  }
}

export function saveToLocal(blob: Blob, fileName: string): void {
  try {
    const downloadLink = addElementToDom({
      tag: "a",
      attrs: {
        id: "download-link",
        href: window.URL.createObjectURL(blob),
        download: fileName,
      },
      style: { display: "none" },
      eventlistener: {
        click: function (this: HTMLAnchorElement) {
          setTimeout(() => {
            window.URL.revokeObjectURL(this.href);
            this.remove();
          }, 100);
        },
      },
    })();

    (downloadLink as HTMLAnchorElement).click();
    maLogger.log("文件下载成功:", fileName);
  } catch (error) {
    maLogger.error("文件下载出错:", error);
    throw error;
  }
}

export function getCSSSelector(element: HTMLElement): string {
  if (!element || element === document.documentElement) {
    return "html";
  }

  // 优先使用 id
  if (element.id) {
    const id = CSS.escape(element.id);
    return `#${id}`;
  }

  // 获取父元素的选择器
  const parentSelector = getCSSSelector(element.parentElement!);

  // 获取当前元素的标签名
  const tagName = element.tagName.toLowerCase();

  // 获取当前元素的类名
  const className = element.className.trim();

  // 获取同级元素中的索引
  const siblings = Array.from(element.parentElement!.children).filter(
    (el) => el.tagName === element.tagName && el.className.trim() === className,
  );

  if (siblings.length === 1) {
    // 如果是唯一的同标签元素，使用标签名+类名
    return `${parentSelector} > ${tagName}.${className.replace(/\s+/g, ".")}`;
  } else {
    // 否则使用 nth-child
    const index =
      Array.from(element.parentElement!.children).indexOf(element) + 1;
    return `${parentSelector} > ${tagName}:nth-child(${index})`;
  }
}
