/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/element-control.ts
 * @date 2026-02-05T02:38:01.698Z
 */

import { createApp, App } from "vue";
import type {
  StyleObject,
  AttributeObject,
  EventListenerObject,
  CreateElemOpts,
  CloneElemOpts,
  AddElemOpts,
  WaitForSelectorOptions,
} from "@/types";
import { getAssetsAbstractPath, getRuntimeScript } from "@/utils/common";

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

export function throttle(func: Function, wait: number): Function {
  if (typeof func !== "function") throw new Error("func is not a function");
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

export function debounce(func: Function, wait: number): Function {
  if (typeof func !== "function") throw new Error("func is not a function");
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
  if (!el)
    throw new Error("createEl error: tag is not a string or HTMLElement");

  if (tag === "button") {
    (el as HTMLButtonElement).type = "button";
  }
  if (attrs) setElAttributes(el, attrs);
  if (style) setElStyle(el, style);
  if (eventlistener) setElEventListeners(el, eventlistener);
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
      ? (sessionStorage.setItem("js-code", content), getRuntimeScript("inject"))
      : content;

  const script = document.createElement("script");
  script.src = scriptSrc;
  script.id = "inject-script";

  script.onload = (evt: Event) => {
    (evt.target as HTMLElement)?.remove();
    showSuccessMessage("脚本已生效!");
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
  readonly found = new Set<Element>();
  /** 已触发回调的元素（WeakSet 不阻碍 GC） */
  private readonly called = new WeakSet<Element>();

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
  addIfNew(el: Element): boolean {
    if (this.called.has(el)) return false;
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
    private resolve: (els: Element[]) => void,
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
    if (this.opts.useMutationObserver !== false) this.buildObserver();
    this.searchOnce();
  }

  /** 监听 iframe 加载事件，确保 iframe 重新加载时能及时更新根节点 */
  private bindIframeLoadListener(): void {
    const { iframeSelector } = this.opts;
    if (!iframeSelector) return;

    const iframe = document.querySelector<HTMLIFrameElement>(iframeSelector);
    if (!iframe) return;

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
    if (!iframeSelector) return document;

    const iframe = document.querySelector<HTMLIFrameElement>(iframeSelector);
    if (!iframe) return document; // 找不到 iframe 就退回主文档
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error("cannot access iframe document");
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
    if (timeout <= 0) return;
    this.timeoutId = setTimeout(() => {
      this.state.stopReason = "timeout";
      this.resolve(Array.from(this.state.found));
    }, timeout);
  }

  /** 单次查找 + 回调 + 终止判断 */
  private searchOnce(): void {
    if (this.signal.aborted) return;
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
      if (!this.passesFilter(el)) continue;
      if (this.state.addIfNew(el)) {
        foundNew = true;
        this.fireCallback(el);
        if (this.state.shouldStop()) break;
      }
    }

    if (this.state.shouldStop()) {
      this.resolve(Array.from(this.state.found));
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
    if (!filter) return true;
    try {
      return filter(el);
    } catch (e) {
      maLogger.error("[waitForSelector] filter error:", e);
      return false;
    }
  }

  /** 建立 MutationObserver */
  private buildObserver(): void {
    if (this.signal.aborted) return;
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
          if (t !== tick) return;
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
): Promise<Element[]> {
  if (!options.selector)
    return Promise.reject(new Error("selector is required"));
  if (Array.isArray(options.selector) && options.selector.length === 0)
    return Promise.reject(new Error("selector array cannot be empty"));

  return new Promise<Element[]>((resolve, reject) => {
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

export function injectVueComponent(
  component: any,
  props?: Record<string, any> | null,
  emitFunc?: Function,
): (byElement?: HTMLElement, position?: string) => void {
  const duration = props?.duration ? props.duration + 1000 : null;

  return function (byElement?: HTMLElement, position?: string) {
    const container = addElementToDom({
      tag: "div",
      attrs: { id: `vue-container-${Date.now()}` },
      style: { zIndex: "9999" },
      autoRemoveDelay: duration,
    })(byElement, position);

    const app: App = createApp(component, props);
    app.mount(container);
    return { app, container };
  };
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

export enum PositionStrategy {
  Top = "top",
  Down = "down",
  Left = "left",
  Right = "right",
  Center = "center",
  TopLeft = "top-left",
  TopRight = "top-right",
  LeftDown = "left-down",
  RightDown = "right-down",
}

/**
 * 元素位置信息类
 * 封装元素的绝对位置信息和相关操作方法
 */
export class ElementPositionInfo {
  public element: HTMLElement | null;
  // 视口相对位置
  public top: number;
  public left: number;
  public right: number;
  public bottom: number;
  public width: number;
  public height: number;
  public "z-index": number;

  // 文档绝对位置
  public absoluteTop: number;
  public absoluteLeft: number;

  // 元素属性
  public id: string;
  public className: string;
  public tagName: string;

  // 视口信息
  public viewport: {
    width: number;
    height: number;
  };

  constructor(options: {
    element?: HTMLElement | null;
    rect: DOMRect;
    zIndex: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
  }) {
    this.element = options.element || null;
    // 视口相对位置
    this.top = options.rect.top;
    this.left = options.rect.left;
    this.right = options.rect.right;
    this.bottom = options.rect.bottom;
    this.width = options.rect.width;
    this.height = options.rect.height;
    this["z-index"] = options.zIndex;

    // 文档绝对位置
    this.absoluteTop = options.rect.top + options.scrollY;
    this.absoluteLeft = options.rect.left + options.scrollX;

    // 元素属性
    this.id = options.element?.id || "";
    this.className = options.element?.className || "";
    this.tagName = options.element?.tagName || "";

    // 视口信息
    this.viewport = {
      width: options.viewportWidth,
      height: options.viewportHeight,
    };
  }

  public insertToShadow(options: {
    shadowRoot?: ShadowRoot;
    shadowHostId?: string;
    content?: string | HTMLElement;
    style?: Record<string, string>;
    attrs?: Record<string, string>;
  }): HTMLElement {
    const { shadowRoot, shadowHostId, content, style, attrs } = options;

    // 确定目标Shadow Root
    let targetShadowRoot: ShadowRoot;

    if (shadowRoot) {
      targetShadowRoot = shadowRoot;
    } else if (shadowHostId) {
      const shadowHost = document.getElementById(shadowHostId);
      if (!shadowHost || !shadowHost.shadowRoot) {
        throw new Error(
          `Shadow host with id "${shadowHostId}" not found or has no shadow root`,
        );
      }
      targetShadowRoot = shadowHost.shadowRoot;
    } else {
      throw new Error("Either shadowRoot or shadowHostId must be provided");
    }

    // 创建容器元素
    const container = document.createElement("div");

    // 设置位置样式
    const positionStyle = {
      position: "fixed",
      top: `${this.top}px`,
      left: `${this.left}px`,
      width: `${this.width}px`,
      height: `${this.height}px`,
      zIndex: "9999",
      ...style,
    };

    // 应用样式
    Object.assign(container.style, positionStyle);

    // 应用属性
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        container.setAttribute(key, value);
      });
    }

    // 添加内容
    if (content) {
      if (typeof content === "string") {
        container.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        container.appendChild(content);
      }
    }

    // 插入到Shadow DOM
    targetShadowRoot.appendChild(container);

    return container;
  }

  public positionElement(options: {
    targetElement: { _observers?: any } & HTMLElement;
    strategy?: PositionStrategy;
    alignment?: "start" | "center" | "end";
    offset?: { x?: number; y?: number };
    observeReference?: boolean;
    pinned?: boolean;
    containment?: "inside" | "outside";
  }): HTMLElement {
    const {
      targetElement,
      strategy = PositionStrategy.Down,
      alignment = "start",
      offset,
      observeReference = false,
      pinned = false,
      containment = "outside",
    } = options;
    const offsetX = offset?.x ?? 0,
      offsetY = offset?.y ?? 0,
      inside = containment === "inside";
    const elemW = targetElement.offsetWidth,
      elemH = targetElement.offsetHeight;

    if (pinned)
      Object.defineProperties(targetElement.style, {
        position: { value: "fixed" },
        zIndex: { value: "9999" },
      });

    const positionMap: Record<string, { x?: number; y?: number }> = {
      top: { y: inside ? this.top + offsetY : this.top - elemH - offsetY },
      down: {
        y: inside ? this.bottom - elemH - offsetY : this.bottom + offsetY,
      },
      left: { x: inside ? this.left + offsetX : this.left - elemW - offsetX },
      right: {
        x: inside ? this.right - elemW - offsetX : this.right + offsetX,
      },
      "top-left": inside
        ? { x: this.left + offsetX, y: this.top + offsetY }
        : { x: this.left - elemW - offsetX, y: this.top - elemH - offsetY },
      "top-right": inside
        ? { x: this.right - elemW - offsetX, y: this.top + offsetY }
        : { x: this.right + offsetX, y: this.top - elemH - offsetY },
      "left-down": inside
        ? { x: this.left + offsetX, y: this.bottom - elemH - offsetY }
        : { x: this.left - elemW - offsetX, y: this.bottom + offsetY },
      "right-down": inside
        ? { x: this.right - elemW - offsetX, y: this.bottom - elemH - offsetY }
        : { x: this.right + offsetX, y: this.bottom + offsetY },
    };

    let { x, y } = positionMap[strategy as keyof typeof positionMap] ?? {};
    x ??= this.left + (this.width - elemW) / 2 + offsetX;
    y ??= this.top + (this.height - elemH) / 2 + offsetY;

    if (alignment === "center") {
      strategy === "top" || strategy === "down"
        ? (x = this.left + (this.width - elemW) / 2 + offsetX)
        : (y = this.top + (this.height - elemH) / 2 + offsetY);
    } else if (alignment === "end") {
      strategy === "top" || strategy === "down"
        ? (x = this.right - elemW + offsetX)
        : (y = this.bottom - elemH + offsetY);
    }

    const finalX = Math.max(0, Math.min(x, this.viewport.width - elemW));
    const finalY = Math.max(0, Math.min(y, this.viewport.height - elemH));

    Object.defineProperties(targetElement.style, {
      left: { value: `${finalX}px` },
      top: { value: `${finalY}px` },
    });

    if (observeReference) setupReferenceObserver(this.element, targetElement);

    return targetElement;
  }
}

const setupReferenceObserver = (
  referenceElement: Node | null,
  targetElement: HTMLElement,
): void => {
  const observer = new MutationObserver(() => {
    let exists = false;
    try {
      exists = document.contains(referenceElement);
    } catch {
      exists = false;
    }
    if (exists) {
      const style = window.getComputedStyle(referenceElement as Element);
      exists =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0";
    }
    if (!exists) {
      try {
        targetElement.remove();
      } catch {}
      observer.disconnect();
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "display", "visibility"],
  });
  (targetElement as any).__referenceObserver = observer;
};

export function getElementAbsolutePosition(
  element: HTMLElement | Node,
): ElementPositionInfo {
  // 检查元素是否有效
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error("Invalid HTML element provided");
  }

  // 获取元素的绝对位置
  const rect = element.getBoundingClientRect();

  maLogger.log("元素的绝对位置：", rect);

  // 计算视口滚动偏移
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  // 获取视口尺寸
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  // 获取元素的zIndex
  const zIndex = getActualZIndex(element);

  // 返回ElementPositionInfo类的实例
  return new ElementPositionInfo({
    element,
    rect,
    zIndex,
    scrollX,
    scrollY,
    viewportWidth,
    viewportHeight,
  });
}

// 获取实际的 z-index 值
export function getActualZIndex(element: HTMLElement | null) {
  let current = element;
  while (current && current !== document.documentElement) {
    const zIndex = window.getComputedStyle(current).zIndex;
    if (zIndex !== "auto" && !isNaN(parseInt(zIndex, 10))) {
      return parseInt(zIndex, 10);
    }
    current = current.parentElement;
  }
  return 0;
}

export const showSuccessMessage = (message: string) => {
  const successContainer = document.createElement("div");
  successContainer.style.cssText = `
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(13, 148, 136, 0.22);
        border-radius: 12px;
        padding: 14px 18px;
        font-size: 14px;
        line-height: 1.5;
        max-width: 280px;
        position: fixed;
        z-index: 9999999;
        right: 20px;
        top: 20px;
        box-shadow: 
            0 18px 42px rgba(15, 23, 42, 0.18),
            0 4px 12px rgba(13, 148, 136, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.84);
        animation: slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `;

  successContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span style="color: #134e4a; font-weight: 700;">${message}</span>
        </div>
    `;

  const style = document.createElement("style");
  style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%) scale(0.95);
                opacity: 0;
            }
            to {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
            to {
                transform: translateX(100%) scale(0.95);
                opacity: 0;
            }
        }
    `;
  document.head.appendChild(style);

  document.body.appendChild(successContainer);

  setTimeout(() => {
    successContainer.style.animation =
      "slideOut 0.3s cubic-bezier(0.55, 0, 1, 1) forwards";
    setTimeout(() => {
      try {
        document.body.removeChild(successContainer);
        document.head.removeChild(style);
      } catch (error) {
        // 元素可能已经被移除
      }
    }, 500);
  }, 1500);
};
