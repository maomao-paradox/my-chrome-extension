/**
 * @file test/setup.ts
 * @description Vitest 全局 setup 文件
 *   - 注入 chrome.* 扩展运行时 API 的最小 mock（getURL / storage 等）
 *   - 注入 maLogger 全局对象，避免被测代码引用未定义的 logger
 *   - 注入 requestIdleCallback / requestAnimationFrame 等 DOM 调度 API
 *   注入策略采用「幂等覆盖」：若宿主已存在同名 API 则保留原实现
 * @author Vivy
 * @date 2026-08-03
 */

import { afterAll, afterEach, vi } from "vitest";

/* ------------------------------------------------------------------ *
 * 1. maLogger：链式 Logger，所有方法均返回自身
 *    被测文件直接引用全局 maLogger，必须在加载被测模块前安装
 * ------------------------------------------------------------------ */
const createChainedLogger = () => {
  // 静默收集器：方便断言日志是否被触发
  const records: Record<string, unknown[]> = {};
  const logger: any = {
    title: "TEST",
    enabled: true,
    setTitle(t: string) {
      logger.title = t;
      return logger;
    },
    setEnabled(e: boolean) {
      logger.enabled = e;
      return logger;
    },
    // 收集日志而非打印，避免污染测试输出
    ...["debug", "error", "info", "log", "trace", "warn", "table", "group", "groupCollapsed", "groupEnd", "time", "timeEnd"].reduce(
      (acc, method) => {
        acc[method] = (...args: unknown[]) => {
          (records[method] ||= []).push(args);
          return logger;
        };
        return acc;
      },
      {} as Record<string, (...args: unknown[]) => any>,
    ),
    assert(condition?: boolean, ...args: unknown[]) {
      if (!condition) (records.assert ||= []).push(args);
      return logger;
    },
    // 测试辅助：读取捕获的日志
    __records: records,
  };
  return logger;
};

(globalThis as any).maLogger = createChainedLogger();

/* ------------------------------------------------------------------ *
 * 2. chrome.* API mock：覆盖 getURL / storage / runtime
 * ------------------------------------------------------------------ */
const storageMap: Record<string, Record<string, unknown>> = { local: {} };

(globalThis as any).chrome = {
  ...(globalThis as any).chrome,
  runtime: {
    // chrome.runtime.getURL：扩展资源路径转换，测试中等价于拼前缀
    getURL(path: string) {
      return `chrome-extension://test-id/${path}`;
    },
    // onMessage / onConnect 等留空，被测模块未直接使用
    onMessage: { addListener: () => {}, removeListener: () => {} },
    onConnect: { addListener: () => {}, removeListener: () => {} },
  },
  storage: {
    local: {
      get: vi.fn(async () => ({ ...storageMap.local })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(storageMap.local, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        [].concat(keys).forEach((k) => delete storageMap.local[k]);
      }),
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
  },
};

/* ------------------------------------------------------------------ *
 * 3. requestIdleCallback：element-control.ts 中 MutationObserver 节流使用
 *    happy-dom 默认未实现，使用 setTimeout 同步回退
 * ------------------------------------------------------------------ */
if (typeof (globalThis as any).requestIdleCallback !== "function") {
  (globalThis as any).requestIdleCallback = (
    cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
  ) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
}

/* ------------------------------------------------------------------ *
 * 4. 每个测试用例前后清理 DOM 与定时器，避免 happy-dom 状态泄漏
 * ------------------------------------------------------------------ */
afterEach(() => {
  // 清空 document.body 残留节点
  if (document && document.body) {
    document.body.innerHTML = "";
  }
  // 清空 head 中动态注入的 style
  if (document && document.head) {
    document.head.querySelectorAll("style").forEach((s) => s.remove());
  }
  // 重置所有 fake timer
  vi.clearAllTimers();
});

afterAll(() => {
  vi.useRealTimers();
});
