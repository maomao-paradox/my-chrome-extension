/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/chrome-api/waitForElement.ts
 * @date 2026-02-05T02:38:01.698Z
 */

/**
 * 优化后的等待元素选项接口
 */
export interface WaitForSelectorOptions {
  selector: string | string[];
  callback?: (element: HTMLElement | any, ...args: any[]) => void;
  callbackArgs?: any[];
  iframeSelector?: string;
  maxWaitTimes?: number;
  timeout?: number;
  interval?: number;
  filter?: (element: HTMLElement) => boolean;
  once?: boolean; // 当设置为true时，找到第一个匹配元素后立即停止搜索
  useMutationObserver?: boolean;
  observerOptions?: MutationObserverInit;
  signal?: AbortSignal;
  initCallback?: (...args: any[]) => void;
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
    if (
      typeof maxWaitTimes === "number" &&
      maxWaitTimes > 0 &&
      this.checkTimes >= maxWaitTimes
    ) {
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

function elementQueryAll(node: Node, selector: string): HTMLElement[] {
  if (!("querySelectorAll" in node)) return [];
  return Array.from(
    (node as Element | DocumentFragment).querySelectorAll<HTMLElement>(
      selector,
    ),
  );
}

/* -------------------- 真正干活的 searcher -------------------- */
class ElementSearcher {
  private observer: MutationObserver | null = null;
  private scheduledSearchId: ReturnType<typeof setTimeout> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private cleanupFunctions: Array<() => void> = [];
  private readonly state: SearchState;
  private root: Document | DocumentFragment;
  private started = false;
  private settled = false;
  private iframeLoadBound = false;
  private abortHandler: (() => void) | null = null;
  private pendingMutations: MutationRecord[] = [];
  private mutationOverflow = false;
  private readonly selectors: string[];

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
    this.selectors = Array.from(
      new Set(Array.isArray(opts.selector) ? opts.selector : [opts.selector]),
    );
    this.root = this.pickRoot(); // 主文档或 iframe document
    this.bindAbort();
  }

  /** 开始第一次查找 */
  start(): void {
    if (this.started || this.settled) return;
    this.started = true;

    // 初始化回调
    if (typeof this.opts.initCallback === "function") {
      try {
        this.opts.initCallback();
      } catch (e) {
        maLogger.error("[waitForSelector] initCallback error:", e);
      }
    }
    if (this.settled) return;

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
    if (!iframeSelector || this.iframeLoadBound) return;

    const handleLoad = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "IFRAME" &&
        typeof target.matches === "function" &&
        target.matches(iframeSelector)
      ) {
        maLogger.log("[waitForSelector] iframe loaded, checking root node");
        this.scheduleSearch(0);
      }
    };

    // 捕获阶段监听，能捕获到 iframe 的 load
    document.addEventListener("load", handleLoad, true);
    this.iframeLoadBound = true;
    this.cleanupFunctions.push(() => {
      document.removeEventListener("load", handleLoad, true);
      this.iframeLoadBound = false;
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
      const frameDocument =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (
        frameDocument &&
        (!frameDocument.readyState || frameDocument.readyState !== "loading")
      ) {
        return frameDocument;
      }
      // 某些页面把 iframe 内容挂在 iframe 元素自己的 ShadowRoot 上；
      // contentDocument 不可用或仍在加载时，保留该路径。
      if (iframe.shadowRoot) {
        return iframe.shadowRoot;
      }
      if (!frameDocument) {
        // iframe 还在加载，返回主文档，等 load 后再切
        return document;
      }
      // iframe 还在加载，返回主文档，等 load 后再切
      return document;
    } catch (e) {
      maLogger.warn(
        "[waitForSelector] iframe access error, fallback to main document",
      );
      return document;
    }
  }

  private bindAbort(): void {
    this.abortHandler = () => {
      this.finishReject(new Error("aborted"));
    };
    if (this.signal.aborted) {
      this.abortHandler();
      return;
    }
    this.signal.addEventListener("abort", this.abortHandler, { once: true });
  }

  private scheduleTimeout(): void {
    if (this.settled) return;
    const { timeout = 30000 } = this.opts;
    if (timeout <= 0) {
      return;
    }
    this.timeoutId = setTimeout(() => {
      this.state.stopReason = "timeout";
      this.finishResolve();
    }, timeout);
  }

  /** 单次查找 + 回调 + 终止判断 */
  private searchOnce(): void {
    if (this.settled || this.signal.aborted) {
      return;
    }
    this.scheduledSearchId = null;
    this.state.checkTimes++;
    const mutations = this.pendingMutations;
    this.pendingMutations = [];
    const mutationOverflow = this.mutationOverflow;
    this.mutationOverflow = false;

    // 重新检查根节点，确保捕获到动态加载的内容
    const currentRoot = this.pickRoot();
    let rootChanged = false;
    if (currentRoot !== this.root) {
      // maLogger.log('[waitForSelector] Root node updated');
      this.root = currentRoot;
      rootChanged = true;
      // 如果有observer，重新设置观察
      if (this.observer) {
        this.observer.disconnect();
        if (!this.observeRoot()) {
          this.observer = null;
        }
      }
    }

    let list: HTMLElement[] = [];
    try {
      list = this.queryElements(mutations, rootChanged || mutationOverflow);
    } catch (e) {
      maLogger.warn("[waitForSelector] invalid selector:", e);
      // 非法选择器直接停掉，避免死循环
      this.finishReject(
        new Error(`invalid selector "${this.selectors.join(", ")}"`),
      );
      return;
    }

    for (const el of list) {
      maLogger.log(el);
      if (!this.passesFilter(el)) {
        continue;
      }
      if (this.state.addIfNew(el)) {
        this.fireCallback(el);
        if (this.settled) break;
        if (this.state.shouldStop()) {
          maLogger.log(
            "[waitForSelector] stop condition met",
            this.state.stopReason,
          );
          this.finishResolve();
          break;
        }
      }
    }

    if (this.state.shouldStop()) {
      maLogger.log(
        "[waitForSelector] stop condition met",
        this.state.stopReason,
      );
      this.finishResolve();
      return;
    }

    // 没使用 observer 时靠轮询；设置 maxWaitTimes 时也保留轮询兜底，
    // 否则页面没有 Mutation 时永远无法达到检查次数上限。
    if (!this.observer || this.hasAttemptLimit() || this.opts.iframeSelector) {
      this.scheduleSearch(this.opts.interval || 100);
    }
  }

  private hasAttemptLimit(): boolean {
    return (
      typeof this.opts.maxWaitTimes === "number" && this.opts.maxWaitTimes > 0
    );
  }

  /**
   * 首次检查或复杂 MutationObserver 配置执行全量查询；默认 childList
   * 监听只查询新增子树，避免页面频繁更新时反复扫描整个 document。
   */
  private queryElements(
    mutations: MutationRecord[],
    forceFullScan = false,
  ): HTMLElement[] {
    const observerOptions = this.opts.observerOptions;
    const canUseAddedSubtrees =
      !forceFullScan &&
      mutations.length > 0 &&
      (!observerOptions ||
        (observerOptions.childList === true &&
          !observerOptions.attributes &&
          !observerOptions.characterData)) &&
      !this.opts.filter &&
      this.selectors.every((selector) => !/:has\s*\(/i.test(selector)) &&
      mutations.every(
        (mutation) =>
          mutation.removedNodes.length === 0 &&
          Array.from(mutation.addedNodes).every(
            (node) =>
              node.nodeType === Node.ELEMENT_NODE ||
              node.nodeType === Node.DOCUMENT_FRAGMENT_NODE,
          ),
      );

    if (!canUseAddedSubtrees) {
      return this.queryRoot();
    }

    const candidates = new Set<HTMLElement>();
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (
          node.nodeType !== Node.ELEMENT_NODE &&
          node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
        ) {
          continue;
        }
        for (const selector of this.selectors) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.matches(selector)) candidates.add(element);
          }
          elementQueryAll(node, selector).forEach((element) =>
            candidates.add(element),
          );
        }
      }
    }
    return Array.from(candidates);
  }

  private queryRoot(): HTMLElement[] {
    const elements = new Set<HTMLElement>();
    for (const selector of this.selectors) {
      this.root
        .querySelectorAll<HTMLElement>(selector)
        .forEach((element) => elements.add(element));
    }
    return Array.from(elements);
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
  private passesFilter(el: HTMLElement): boolean {
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
    if (this.signal.aborted || typeof MutationObserver === "undefined") {
      return;
    }
    try {
      this.observer = new MutationObserver((records) => {
        // MutationObserver 一轮内可能收到大量记录，统一合并为一次检查。
        this.scheduleSearch(Math.min(this.opts.interval || 100, 50), records);
      });
      if (!this.observeRoot()) {
        this.observer = null;
      }
    } catch (e) {
      maLogger.warn(
        "[waitForSelector] MutationObserver failed, fallback to polling:",
        e,
      );
      this.observer = null;
    }
  }

  /** 观察当前 root；root 变化时复用同一个 observer。 */
  private observeRoot(): boolean {
    if (!this.observer || this.settled) return false;
    try {
      this.observer.observe(
        this.root,
        this.opts.observerOptions || { childList: true, subtree: true },
      );
      return true;
    } catch (e) {
      maLogger.warn("[waitForSelector] failed to observe root:", e);
      return false;
    }
  }

  /** 合并轮询和 MutationObserver 的检查调度，避免重复定时器。 */
  private scheduleSearch(
    delay: number,
    mutations: MutationRecord[] = [],
  ): void {
    if (this.settled) return;
    if (mutations.length > 0) {
      // 持续高频更新时限制缓存记录数量；超出后下一轮做一次全量查询。
      if (this.pendingMutations.length + mutations.length > 500) {
        this.pendingMutations = [];
        this.mutationOverflow = true;
      } else if (!this.mutationOverflow) {
        this.pendingMutations.push(...mutations);
      }
    }
    if (this.scheduledSearchId !== null) {
      clearTimeout(this.scheduledSearchId);
    }
    this.scheduledSearchId = setTimeout(
      () => this.searchOnce(),
      Math.max(0, delay),
    );
  }

  private finishResolve(): void {
    if (this.settled) return;
    this.settled = true;
    const cleanup = this.cleanup;
    cleanup();
    this.resolve([Array.from(this.state.found), cleanup]);
  }

  private finishReject(error: Error): void {
    if (this.settled) return;
    this.settled = true;
    this.cleanup();
    this.reject(error);
  }

  /** 清理所有资源 */
  private cleanup = (): void => {
    this.observer?.disconnect();
    this.observer = null;
    this.pendingMutations = [];
    this.mutationOverflow = false;
    if (this.scheduledSearchId !== null) {
      clearTimeout(this.scheduledSearchId);
      this.scheduledSearchId = null;
    }
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.abortHandler) {
      this.signal.removeEventListener("abort", this.abortHandler);
      this.abortHandler = null;
    }
    // 执行所有清理函数
    this.cleanupFunctions.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        maLogger.warn("[waitForSelector] cleanup error:", e);
      }
    });
    this.cleanupFunctions = [];
  };
}

/* -------------------- 对外唯一入口 -------------------- */
export function waitForSelector(
  options: WaitForSelectorOptions,
): Promise<[targetElements: HTMLElement[], cleanup: () => void]> {
  if (!options || typeof options !== "object") {
    return Promise.reject(new Error("options are required"));
  }
  if (Array.isArray(options.selector)) {
    if (options.selector.length === 0) {
      return Promise.reject(new Error("selector array cannot be empty"));
    }
    if (
      options.selector.some(
        (selector) => typeof selector !== "string" || !selector.trim(),
      )
    ) {
      return Promise.reject(new Error("selector must be a non-empty string"));
    }
  } else if (typeof options.selector !== "string" || !options.selector.trim()) {
    return Promise.reject(new Error("selector is required"));
  }
  if (typeof document === "undefined") {
    return Promise.reject(new Error("document is not available"));
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
