/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/element-control.ts
 * @date 2026-02-05T02:38:01.698Z
 */

import type {
  StyleObject,
  AttributeObject,
  EventListenerObject,
  CreateElemOpts,
  CloneElemOpts,
  AddElemOpts,
  WaitForSelectorOptions,
} from "@/types";
import { getSingleFileScript } from "@/utils/common";

export const $id = document.getElementById.bind(document);
export const $query = document.querySelectorAll.bind(document);

export function whenDomReady(callback: () => void) {
  if (document.body) {
    callback();
  } else {
    window.addEventListener(
      "load",
      function () {
        callback();
      },
      { once: true },
    );
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
  const { tag, attrs, style, eventlistener, children } = options;

  let el: HTMLElement | undefined;
  if (typeof tag === "string") {
    el = document.createElement(tag) as HTMLElement;
  } else if (tag instanceof HTMLElement) {
    el = tag as HTMLElement;
  }
  if (!el) {
    throw new Error("createEl error: tag is not a string or HTMLElement");
  }

  if (tag === "button") {
    (el as HTMLButtonElement).type = "button";
  }
  if (attrs) {
    setElAttributes(el, attrs);
  }
  if (style) {
    setElStyle(el, style);
  }
  if (eventlistener) {
    setElEventListeners(el, eventlistener);
  }
  if (children && Array.isArray(children) && children.length > 0) {
    children.forEach((child) => {
      el.appendChild(child instanceof HTMLElement ? child : createEl(child));
    });
  }

  return el;
}

export function cloneEl(options: CloneElemOpts): HTMLElement {
  const { deep, el, attrs, style, eventlistener, children } = options;
  const cloned = el.cloneNode(deep) as HTMLElement;
  return createEl({ tag: cloned, attrs, style, eventlistener, children });
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
  position?: string,
): void => {
  if ("insertAdjacentElement" in refEl) {
    const positions: InsertPosition[] = [
      "beforebegin",
      "afterbegin",
      "beforeend",
      "afterend",
    ];
    const pos =
      position && positions.includes(position as InsertPosition)
        ? position
        : "beforeend";
    refEl.insertAdjacentElement(pos as InsertPosition, $el);
  } else if (["start", "begin", "first"].includes(position || "")) {
    refEl.prepend($el);
  } else {
    refEl.appendChild($el);
  }
};

const createDomElement = (opts: AddElemOpts): HTMLElement => {
  const { tag, attrs, style, eventlistener, children } = opts;
  if (
    typeof tag === "object" &&
    "nodeType" in tag &&
    (tag as HTMLElement).nodeType === 1
  ) {
    return cloneEl({
      deep: true,
      el: tag as HTMLElement,
      attrs,
      style,
      eventlistener,
      children,
    });
  }
  return createEl({ tag, attrs, style, eventlistener, children });
};

/**
 * 向 DOM 中添加元素
 * @param opts 元素添加选项
 * @returns 一个函数，用于将元素添加到指定的 DOM 元素中，通常配合waitForElement使用
 */
export function addElementToDom(
  opts: AddElemOpts,
): (referElement?: Element | ShadowRoot, position?: string) => HTMLElement {
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
    referElement?: Element | ShadowRoot,
    position?: string,
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

/* -------------------- 状态机 -------------------- */
class SearchState {
  /** 已经找到的元素 */
  readonly found = new Set<HTMLElement>();
  /** 已触发回调的元素（WeakSet 不阻碍 GC） */
  private readonly called = new WeakSet<HTMLElement>();

  stopReason: "first" | "count" | "times" | "timeout" | "abort" | null = null;
  checkTimes = 0;

  constructor(public opts: WaitForSelectorOptions) {}

  /** 是否该停下来了 */
  shouldStop(): boolean {
    const { once, maxWaitTimes } = this.opts;
    // maLogger.table({ once, maxWaitTimes, foundSize: this.found.size, checkTimes: this.checkTimes });
    if (once && this.found.size >= 1) {
      this.stopReason = "first";
      return true;
    }
    if (maxWaitTimes && this.checkTimes >= maxWaitTimes) {
      this.stopReason = "times";
      return true;
    }
    return false;
  }

  /** 尝试收录一个元素；返回 true 表示是“新”元素 */
  addIfNew(el: HTMLElement): boolean {
    if (this.called.has(el)) {
      return false;
    }
    this.called.add(el);
    this.found.add(el);
    return true;
  }
}

/* -------------------- 真正干活的 searcher -------------------- */
class ElementSearcher {
  private observer: MutationObserver | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private cleanupFunctions: Array<() => void> = [];
  private readonly state: SearchState;
  private root: Document | DocumentFragment;

  constructor(
    private opts: WaitForSelectorOptions,
    state: SearchState,
    private resolve: (
      value:
        | [HTMLElement[], () => void]
        | PromiseLike<[HTMLElement[], () => void]>,
    ) => void,
    private reject: (err: Error) => void,
    private signal: AbortSignal,
  ) {
    this.state = state;
    this.root = this.pickRoot(); // 主文档或 iframe document
    this.bindAbort();
  }

  /** 开始第一次查找 */
  start(): void {
    // 初始化回调
    if (typeof this.opts.initCallback === "function") {
      this.opts.initCallback();
    }

    this.scheduleTimeout();
    this.bindIframeLoadListener();
    if (this.opts.useMutationObserver !== false) {
      this.buildObserver();
    }
    this.searchOnce();
  }

  /** 监听 iframe 加载事件，确保 iframe 重新加载时能及时更新根节点 */
  private bindIframeLoadListener(): void {
    const { iframeSelector } = this.opts;
    if (!iframeSelector) {
      return;
    }

    const iframe = document.querySelector<HTMLIFrameElement>(iframeSelector);
    if (!iframe) {
      return;
    }

    const handleLoad = () => {
      // iframe 加载完成后，主动检查根节点
      maLogger.log("[waitForSelector] iframe loaded, checking root node");
      this.searchOnce();
    };

    iframe.addEventListener("load", handleLoad);

    // 保存清理函数
    this.cleanupFunctions.push(() => {
      iframe.removeEventListener("load", handleLoad);
    });
  }

  /* ========== 内部实现 ========== */
  private pickRoot(): Document | DocumentFragment {
    const { iframeSelector } = this.opts;
    if (!iframeSelector) {
      return document;
    }

    const iframe = document.querySelector<HTMLIFrameElement>(iframeSelector);
    if (!iframe) {
      return document;
    } // 找不到 iframe 就退回主文档
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        throw new Error("cannot access iframe document");
      }
      // maLogger.log("已定位到Iframe的dom文档：", doc);
      return doc;
    } catch (e) {
      maLogger.warn(
        "[waitForSelector] iframe access error, fallback to main document",
      );
      return document;
    }
  }

  private bindAbort(): void {
    if (this.signal.aborted) {
      this.cleanup();
      this.reject(new Error("aborted"));
      return;
    }
    this.signal.addEventListener(
      "abort",
      () => {
        this.cleanup();
        this.reject(new Error("aborted"));
      },
      { once: true },
    );
  }

  private scheduleTimeout(): void {
    const { timeout = 30000 } = this.opts;
    if (timeout <= 0) {
      return;
    }
    this.timeoutId = setTimeout(() => {
      this.state.stopReason = "timeout";
      this.resolve([Array.from<HTMLElement>(this.state.found), this.cleanup]);
    }, timeout);
  }

  /** 单次查找 + 回调 + 终止判断 */
  private searchOnce(): void {
    if (this.signal.aborted) {
      return;
    }
    this.state.checkTimes++;

    // 重新检查根节点，确保捕获到动态加载的内容
    const currentRoot = this.pickRoot();
    if (currentRoot !== this.root) {
      // maLogger.log('[waitForSelector] Root node updated');
      this.root = currentRoot;
      // 如果有observer，重新设置观察
      if (this.observer) {
        this.observer.disconnect();
        const opts = this.opts.observerOptions || {
          childList: true,
          subtree: true,
        };
        this.observer.observe(this.root, opts);
      }
    }

    let list: HTMLElement[] = [];
    const { selector } = this.opts;
    try {
      if (Array.isArray(selector)) {
        // 处理选择器数组
        selector.forEach((selector) => {
          const elements = Array.from(
            this.root.querySelectorAll<HTMLElement>(selector),
          );
          list = [...list, ...elements];
        });
      } else {
        // 处理单个选择器
        list = Array.from(this.root.querySelectorAll<HTMLElement>(selector));
      }
    } catch (e) {
      maLogger.warn("[waitForSelector] invalid selector:", e);
      // 非法选择器直接停掉，避免死循环
      this.cleanup();
      this.reject(new Error(`invalid selector "${selector}"`));
      return;
    }

    let foundNew = false;
    for (const el of list) {
      if (!this.passesFilter(el)) {
        continue;
      }
      if (this.state.addIfNew(el)) {
        foundNew = true;
        this.fireCallback(el);
        if (this.state.shouldStop()) {
          break;
        }
      }
    }

    if (this.state.shouldStop()) {
      this.resolve([Array.from(this.state.found), this.cleanup]);
      return;
    }

    // 没使用 observer 时靠轮询
    if (!this.observer) {
      this.intervalId = setTimeout(
        () => this.searchOnce(),
        this.opts.interval || 100,
      );
    }
  }

  /** 触发外部回调 */
  private fireCallback(el: HTMLElement): void {
    const { callback, callbackArgs = [] } = this.opts;
    if (callback) {
      try {
        callback(el, ...callbackArgs);
      } catch (e) {
        maLogger.error("[waitForSelector] callback error:", e);
      }
    }
  }

  /** 过滤器 */
  private passesFilter(el: Element): boolean {
    const { filter } = this.opts;
    if (!filter) {
      return true;
    }
    try {
      return filter(el);
    } catch (e) {
      maLogger.error("[waitForSelector] filter error:", e);
      return false;
    }
  }

  /** 建立 MutationObserver */
  private buildObserver(): void {
    if (this.signal.aborted) {
      return;
    }
    try {
      const opts = this.opts.observerOptions || {
        childList: true,
        subtree: true,
      };
      let tick = 0;
      this.observer = new MutationObserver(() => {
        tick++;
        const t = tick;
        // 简单节流：最后一次变化后 50 ms 再检查
        const delay = Math.min(this.opts.interval || 100, 50);
        requestIdleCallback?.(() => {
          if (t !== tick) {
            return;
          }
          this.searchOnce();
        }) ?? setTimeout(() => this.searchOnce(), delay);
      });
      this.observer.observe(this.root, opts);
    } catch (e) {
      maLogger.warn(
        "[waitForSelector] MutationObserver failed, fallback to polling:",
        e,
      );
      this.observer = null;
    }
  }

  /** 清理所有资源 */
  private cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    // 执行所有清理函数
    this.cleanupFunctions.forEach((fn) => fn());
    this.cleanupFunctions = [];
  }
}

/* -------------------- 对外唯一入口 -------------------- */
export function waitForSelector(
  options: WaitForSelectorOptions,
): Promise<[targetElements: HTMLElement[], cleanup: () => void] | Error> {
  if (!options.selector) {
    return Promise.reject(new Error("selector is required"));
  }
  if (Array.isArray(options.selector) && options.selector.length === 0) {
    return Promise.reject(new Error("selector array cannot be empty"));
  }

  return new Promise<[HTMLElement[], () => void]>((resolve, reject) => {
    const state = new SearchState(options);
    const searcher = new ElementSearcher(
      options,
      state,
      resolve,
      reject,
      options.signal || new AbortController().signal,
    );
    searcher.start();
  });
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

// export const showSuccessMessage = (message: string) => {
//   const successContainer = document.createElement("div");
//   successContainer.style.cssText = `
//         background: rgba(255, 255, 255, 0.96);
//         backdrop-filter: blur(12px);
//         border: 1px solid rgba(13, 148, 136, 0.22);
//         border-radius: 12px;
//         padding: 14px 18px;
//         font-size: 14px;
//         line-height: 1.5;
//         max-width: 280px;
//         position: fixed;
//         z-index: 9999999;
//         right: 20px;
//         top: 20px;
//         box-shadow:
//             0 18px 42px rgba(15, 23, 42, 0.18),
//             0 4px 12px rgba(13, 148, 136, 0.12),
//             inset 0 1px 0 rgba(255, 255, 255, 0.84);
//         animation: slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
//     `;

//   successContainer.innerHTML = `
//         <div style="display: flex; align-items: center; gap: 10px;">
//             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//                 <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
//             </svg>
//             <span style="color: #134e4a; font-weight: 700;">${message}</span>
//         </div>
//     `;

//   const style = document.createElement("style");
//   style.textContent = `
//         @keyframes slideIn {
//             from {
//                 transform: translateX(100%) scale(0.95);
//                 opacity: 0;
//             }
//             to {
//                 transform: translateX(0) scale(1);
//                 opacity: 1;
//             }
//         }

//         @keyframes slideOut {
//             from {
//                 transform: translateX(0) scale(1);
//                 opacity: 1;
//             }
//             to {
//                 transform: translateX(100%) scale(0.95);
//                 opacity: 0;
//             }
//         }
//     `;
//   document.head.appendChild(style);

//   document.body.appendChild(successContainer);

//   setTimeout(() => {
//     successContainer.style.animation =
//       "slideOut 0.3s cubic-bezier(0.55, 0, 1, 1) forwards";
//     setTimeout(() => {
//       try {
//         document.body.removeChild(successContainer);
//         document.head.removeChild(style);
//       } catch (error) {
//         // 元素可能已经被移除
//       }
//     }, 500);
//   }, 1500);
// };
