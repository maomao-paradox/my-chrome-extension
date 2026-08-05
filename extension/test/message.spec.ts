/**
 * @file test/message.spec.ts
 * @description src/message/index.ts 单元测试
 *   覆盖跨端通信封装：ext（Chrome 扩展通信）和 page（页面通信）
 *   - ext.send / ext.listen：基于 chrome.runtime.sendMessage / onMessage
 *   - page.send / page.listen：基于 window.postMessage / message 事件
 *   - 环境检测 isExtension：chrome 是否可用
 *   注意：使用动态导入避免 vi.resetModules() 影响静态导入的 live binding
 * @author Vivy
 * @date 2026-08-03
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import type { ExtMessage, ResponseMessage } from "@/types";

/* ------------------------------------------------------------------ *
 * Mock 依赖：back-content 模块（避免引入 chrome.tabs 依赖）
 * ------------------------------------------------------------------ */
vi.mock("@/message/back-content", () => ({
  sendMessageToContentScript: vi.fn(async () => "content-script-response"),
}));

/* ------------------------------------------------------------------ *
 * 动态导入模块引用（避免 vi.resetModules() 影响静态绑定）
 *   - 静态 import 在 vi.resetModules() 后会变成 undefined
 *   - 动态 import 返回的命名空间对象不受 resetModules 影响
 * ------------------------------------------------------------------ */
let messageDefault: any;
let ext: any;
let page: any;
let sendMessageToContentScript: any;

beforeAll(async () => {
  const mod = await import("@/message");
  messageDefault = mod.default;
  // ext / page 是 default 导出的属性，不是命名导出
  ext = mod.default.ext;
  page = mod.default.page;
  sendMessageToContentScript = mod.sendMessageToContentScript;
});

/* ------------------------------------------------------------------ *
 * 共享测试数据
 * ------------------------------------------------------------------ */
const MOCK_MESSAGE: ExtMessage = {
  type: "TEST_TYPE",
  payload: { foo: "bar" },
  target: "background",
};
const MOCK_RESPONSE: ResponseMessage = { success: true, result: "ok" };

/* ------------------------------------------------------------------ *
 * 辅助方法：在非扩展环境中动态加载模块
 *   - 备份并删除 chrome 全局
 *   - 重置模块缓存后重新 import，使 isExtension 重新求值为 false
 *   - 恢复 chrome 后再次 reset + import，恢复全局引用
 *   - 返回非扩展环境加载的模块，供测试断言使用
 * ------------------------------------------------------------------ */
async function loadModuleInNonExtensionEnv() {
  const originalChrome = (globalThis as any).chrome;

  // 步骤 1：在非扩展环境中加载模块（isExtension = false）
  delete (globalThis as any).chrome;
  vi.resetModules();
  const nonExtMod = await import("@/message");

  // 步骤 2：恢复 chrome 并重新加载模块（恢复全局引用为 isExtension = true）
  (globalThis as any).chrome = originalChrome;
  vi.resetModules();
  const freshMod = await import("@/message");
  messageDefault = freshMod.default;
  ext = freshMod.default.ext;
  page = freshMod.default.page;
  sendMessageToContentScript = freshMod.sendMessageToContentScript;

  return nonExtMod;
}

/* ------------------------------------------------------------------ *
 * 辅助方法：模拟 iframe 环境
 *   - 替换 window.parent 为指定对象
 *   - 拦截 document.querySelectorAll 返回模拟 iframe 列表
 *   - 返回 restore 函数，恢复原始环境
 * ------------------------------------------------------------------ */
function mockIframeEnvironment(opts: { parent?: any; iframes?: any[] } = {}) {
  const restores: (() => void)[] = [];

  if (opts.parent !== undefined) {
    const originalParent = window.parent;
    Object.defineProperty(window, "parent", {
      value: opts.parent,
      configurable: true,
      writable: true,
    });
    restores.push(() => {
      Object.defineProperty(window, "parent", {
        value: originalParent,
        configurable: true,
        writable: true,
      });
    });
  }

  if (opts.iframes !== undefined) {
    const spy = vi
      .spyOn(document, "querySelectorAll")
      .mockImplementation((selector: string) => {
        if (selector === "iframe") {
          return opts.iframes as any;
        }
        return [] as any;
      });
    restores.push(() => spy.mockRestore());
  }

  return () => restores.forEach((fn) => fn());
}

/* ------------------------------------------------------------------ *
 * 辅助方法：临时将 self.document 设置为 undefined
 *   - 用于测试 page.send / page.listen 在无 document 环境下的行为
 *   - page.send / page.listen 内部通过 self.document !== undefined 判断
 * ------------------------------------------------------------------ */
function withUndefinedDocument<T>(fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(self, "document");
  Object.defineProperty(self, "document", {
    value: undefined,
    configurable: true,
  });
  try {
    return fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(self, "document", descriptor);
    }
  }
}

/* ================================================================== *
 * 1. 模块导出结构
 * ================================================================== */
describe("模块导出结构", () => {
  it("默认导出包含 ext 和 page 两个属性", () => {
    // 断言两个核心对象都存在且方法可用
    expect(messageDefault).toHaveProperty("ext");
    expect(messageDefault).toHaveProperty("page");
    expect(typeof messageDefault.ext.send).toBe("function");
    expect(typeof messageDefault.ext.listen).toBe("function");
    expect(typeof messageDefault.page.send).toBe("function");
    expect(typeof messageDefault.page.listen).toBe("function");
  });

  it("透传 back-content 模块的 sendMessageToContentScript", () => {
    // 验证 re-export 语句正确导出
    expect(sendMessageToContentScript).toBeDefined();
    expect(typeof sendMessageToContentScript).toBe("function");
  });
});

/* ================================================================== *
 * 2. 环境检测（isExtension）
 * ================================================================== */
describe("环境检测 isExtension", () => {
  it("chrome 存在且 chrome.runtime 存在时识别为扩展环境", async () => {
    // 默认 setup.ts 注入 chrome，isExtension 应为 true
    // 通过 ext.send 不 reject 'Not in extension' 来间接验证
    const mockSendMessage = vi.fn((msg: any, cb: any) => cb(MOCK_RESPONSE));
    (globalThis as any).chrome.runtime.sendMessage = mockSendMessage;
    (globalThis as any).chrome.runtime.lastError = undefined;

    await expect(ext.send(MOCK_MESSAGE)).resolves.toEqual(MOCK_RESPONSE);
  });

  it("chrome 不存在时识别为非扩展环境", async () => {
    // 删除 chrome 全局后重新加载模块，isExtension 应为 false
    const mod = await loadModuleInNonExtensionEnv();
    await expect(mod.default.ext.send(MOCK_MESSAGE)).rejects.toBe(
      "Not in extension",
    );
  });

  it("chrome.runtime 不存在时识别为非扩展环境", async () => {
    // chrome 存在但 chrome.runtime 为 undefined
    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = { runtime: undefined };
    vi.resetModules();
    const mod = await import("@/message");
    // 恢复 chrome 并重新加载模块，恢复全局引用
    (globalThis as any).chrome = originalChrome;
    vi.resetModules();
    const freshMod = await import("@/message");
    messageDefault = freshMod.default;
    ext = freshMod.default.ext;
    page = freshMod.default.page;
    sendMessageToContentScript = freshMod.sendMessageToContentScript;

    await expect(mod.default.ext.send(MOCK_MESSAGE)).rejects.toBe(
      "Not in extension",
    );
  });
});

/* ================================================================== *
 * 3. ext.send 方法
 * ================================================================== */
describe("ext.send 方法", () => {
  let mockSendMessage: any;

  beforeEach(() => {
    // 每个用例前重置 chrome.runtime.sendMessage 和 lastError
    mockSendMessage = vi.fn();
    (globalThis as any).chrome.runtime.sendMessage = mockSendMessage;
    (globalThis as any).chrome.runtime.lastError = undefined;
  });

  it("调用 chrome.runtime.sendMessage 发送消息", async () => {
    mockSendMessage.mockImplementation((msg: any, cb: any) => cb(MOCK_RESPONSE));
    await ext.send(MOCK_MESSAGE);
    // 验证 sendMessage 被调用且参数正确
    expect(mockSendMessage).toHaveBeenCalledWith(
      MOCK_MESSAGE,
      expect.any(Function),
    );
  });

  it("消息成功时 Promise resolve 响应数据", async () => {
    mockSendMessage.mockImplementation((msg: any, cb: any) => cb(MOCK_RESPONSE));
    const result = await ext.send(MOCK_MESSAGE);
    expect(result).toEqual(MOCK_RESPONSE);
  });

  it("消息成功且提供 callback 时调用 callback 传入响应", async () => {
    mockSendMessage.mockImplementation((msg: any, cb: any) => cb(MOCK_RESPONSE));
    const callback = vi.fn();
    await ext.send(MOCK_MESSAGE, callback);
    expect(callback).toHaveBeenCalledWith(MOCK_RESPONSE);
  });

  it("callback 在 Promise resolve 之前被调用", async () => {
    // 通过调用顺序数组验证 callback 先于 then 执行
    const callOrder: string[] = [];
    mockSendMessage.mockImplementation((msg: any, cb: any) => cb(MOCK_RESPONSE));
    const callback = vi.fn(() => callOrder.push("callback"));
    await ext.send(MOCK_MESSAGE, callback).then(() => callOrder.push("resolve"));
    expect(callOrder).toEqual(["callback", "resolve"]);
  });

  it("chrome.runtime.lastError 存在时 Promise reject", async () => {
    // 模拟 runtime 错误：在回调中设置 lastError
    const error = { message: "runtime error" };
    mockSendMessage.mockImplementation((msg: any, cb: any) => {
      (globalThis as any).chrome.runtime.lastError = error;
      cb(undefined);
    });
    await expect(ext.send(MOCK_MESSAGE)).rejects.toEqual(error);
    // 清理 lastError 避免影响后续用例
    (globalThis as any).chrome.runtime.lastError = undefined;
  });
});

/* ================================================================== *
 * 4. ext.listen 方法
 * ================================================================== */
describe("ext.listen 方法", () => {
  let mockAddListener: any;

  beforeEach(() => {
    // 覆盖 setup.ts 中的空 addListener，使其可追踪
    mockAddListener = vi.fn();
    (globalThis as any).chrome.runtime.onMessage.addListener = mockAddListener;
  });

  it("扩展环境下注册 chrome.runtime.onMessage 监听器", () => {
    ext.listen(vi.fn());
    // 验证 addListener 被调用且参数为函数
    expect(mockAddListener).toHaveBeenCalledTimes(1);
    expect(mockAddListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it("收到消息时调用 callback，传入 (msg, sender, sendResponse)", () => {
    const callback = vi.fn();
    ext.listen(callback);
    // 取出注册的监听器函数并模拟 chrome 派发消息
    const listener = mockAddListener.mock.calls[0][0];
    const msg: ExtMessage = { type: "HELLO" };
    const sender = { tab: { id: 1 } };
    const sendResponse = vi.fn();
    listener(msg, sender, sendResponse);
    // 验证 callback 接收到完整的三个参数
    expect(callback).toHaveBeenCalledWith(msg, sender, sendResponse);
  });

  it("监听器回调返回 true 表示异步响应", () => {
    ext.listen(vi.fn());
    const listener = mockAddListener.mock.calls[0][0];
    const result = listener({}, {}, vi.fn());
    // chrome 扩展规范：返回 true 表示将异步调用 sendResponse
    expect(result).toBe(true);
  });

  it("非扩展环境下调用 listen 不抛错且不注册监听器", async () => {
    // 在非扩展环境中加载模块（isExtension 仍为 false）
    const mod = await loadModuleInNonExtensionEnv();
    // 恢复 chrome 后，模块内 isExtension 仍为 false，listen 应静默跳过
    mockAddListener = vi.fn();
    (globalThis as any).chrome.runtime.onMessage.addListener = mockAddListener;
    expect(() => mod.default.ext.listen(vi.fn())).not.toThrow();
    expect(mockAddListener).not.toHaveBeenCalled();
  });
});

/* ================================================================== *
 * 5. page.send 方法
 * ================================================================== */
describe("page.send 方法", () => {
  let postMessageSpy: any;

  afterEach(() => {
    if (postMessageSpy) postMessageSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("调用 window.postMessage 发送消息到当前窗口", () => {
    // mockImplementation 阻止真实事件派发，避免干扰其他监听器
    postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});
    page.send(MOCK_MESSAGE);
    expect(postMessageSpy).toHaveBeenCalledWith(MOCK_MESSAGE, "*");
  });

  it("默认 targetOrigin 为 '*'", () => {
    postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});
    page.send(MOCK_MESSAGE);
    expect(postMessageSpy).toHaveBeenCalledWith(MOCK_MESSAGE, "*");
  });

  it("自定义 targetOrigin 被正确传递", () => {
    postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});
    page.send(MOCK_MESSAGE, "https://example.com");
    expect(postMessageSpy).toHaveBeenCalledWith(
      MOCK_MESSAGE,
      "https://example.com",
    );
  });

  it("在 iframe 中也向父窗口发送消息", () => {
    const mockParent = { postMessage: vi.fn() };
    const restore = mockIframeEnvironment({ parent: mockParent });

    postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});
    page.send(MOCK_MESSAGE);

    // 当前窗口 + 父窗口都应收到消息
    expect(postMessageSpy).toHaveBeenCalledWith(MOCK_MESSAGE, "*");
    expect(mockParent.postMessage).toHaveBeenCalledWith(MOCK_MESSAGE, "*");
    restore();
  });

  it("不在 iframe 中时不向父窗口发送消息", () => {
    // happy-dom 默认 window.parent === window，模拟非 iframe 环境
    const restore = mockIframeEnvironment({ parent: window });

    postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});
    page.send(MOCK_MESSAGE);

    // window.parent === window，所以 postMessage 只调用一次（当前窗口）
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    restore();
  });

  it("向所有子 iframe 的 contentWindow 发送消息", () => {
    const iframe1 = { contentWindow: { postMessage: vi.fn() } };
    const iframe2 = { contentWindow: { postMessage: vi.fn() } };
    const restore = mockIframeEnvironment({
      parent: window,
      iframes: [iframe1, iframe2],
    });

    postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});
    page.send(MOCK_MESSAGE);

    // 两个 iframe 的 contentWindow 都应收到消息
    expect(iframe1.contentWindow.postMessage).toHaveBeenCalledWith(
      MOCK_MESSAGE,
      "*",
    );
    expect(iframe2.contentWindow.postMessage).toHaveBeenCalledWith(
      MOCK_MESSAGE,
      "*",
    );
    restore();
  });

  it("self.document 为 undefined 时跳过 iframe 遍历", () => {
    // 模拟非浏览器环境（如 Service Worker），self.document 不存在
    const querySelectorAllSpy = vi.spyOn(document, "querySelectorAll");

    withUndefinedDocument(() => {
      postMessageSpy = vi
        .spyOn(window, "postMessage")
        .mockImplementation(() => {});
      page.send(MOCK_MESSAGE);
    });

    // document 不存在时不应尝试查询 iframe
    expect(querySelectorAllSpy).not.toHaveBeenCalled();
  });

  it("跨域 iframe 访问 contentWindow.postMessage 抛错时被捕获并忽略", () => {
    // 模拟跨域 iframe：访问 contentWindow 时抛错
    const crossOriginIframe = {
      get contentWindow() {
        throw new Error("cross-origin access");
      },
    };
    const restore = mockIframeEnvironment({
      parent: window,
      iframes: [crossOriginIframe],
    });

    postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});

    // 不应抛出异常
    expect(() => page.send(MOCK_MESSAGE)).not.toThrow();
    restore();
  });
});

/* ================================================================== *
 * 6. page.listen 方法
 * ================================================================== */
describe("page.listen 方法", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("在当前窗口注册 message 事件监听器", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    page.listen(vi.fn());
    // 验证注册了 message 事件监听器
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });

  it("收到消息时调用 callback，传入 event.data", () => {
    const callback = vi.fn();
    page.listen(callback);
    // 手动派发 message 事件，模拟 window.postMessage 触发
    const event = new MessageEvent("message", { data: MOCK_MESSAGE });
    window.dispatchEvent(event);
    // callback 应接收 event.data 作为参数
    expect(callback).toHaveBeenCalledWith(MOCK_MESSAGE);
  });

  it("在 iframe 中也监听父窗口的 message 事件", () => {
    const mockParent = { addEventListener: vi.fn() };
    const restore = mockIframeEnvironment({ parent: mockParent });

    page.listen(vi.fn());

    // 父窗口也应注册 message 监听器
    expect(mockParent.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    restore();
  });

  it("不在 iframe 中时不监听父窗口", () => {
    // window.parent === window，不触发父窗口监听
    const restore = mockIframeEnvironment({ parent: window });
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    page.listen(vi.fn());

    // 只注册当前窗口的监听器（不重复注册父窗口）
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    restore();
  });

  it("监听所有子 iframe 的 message 事件", () => {
    const iframe1 = { contentWindow: { addEventListener: vi.fn() } };
    const iframe2 = { contentWindow: { addEventListener: vi.fn() } };
    const restore = mockIframeEnvironment({
      parent: window,
      iframes: [iframe1, iframe2],
    });

    page.listen(vi.fn());

    // 两个 iframe 的 contentWindow 都应注册 message 监听器
    expect(iframe1.contentWindow.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    expect(iframe2.contentWindow.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    restore();
  });

  it("self.document 为 undefined 时跳过 iframe 监听", () => {
    const querySelectorAllSpy = vi.spyOn(document, "querySelectorAll");

    withUndefinedDocument(() => {
      page.listen(vi.fn());
    });

    // document 不存在时不应尝试查询 iframe
    expect(querySelectorAllSpy).not.toHaveBeenCalled();
  });

  it("跨域 iframe 监听 addEventListener 抛错时被捕获并忽略", () => {
    // 模拟跨域 iframe：访问 contentWindow 时抛错
    const crossOriginIframe = {
      get contentWindow() {
        throw new Error("cross-origin access");
      },
    };
    const restore = mockIframeEnvironment({
      parent: window,
      iframes: [crossOriginIframe],
    });

    // 不应抛出异常
    expect(() => page.listen(vi.fn())).not.toThrow();
    restore();
  });

  it("父窗口 addEventListener 抛错时被捕获并忽略", () => {
    // 模拟跨域父窗口：调用 addEventListener 时抛错
    const crossOriginParent = {
      addEventListener: () => {
        throw new Error("cross-origin parent");
      },
    };
    const restore = mockIframeEnvironment({ parent: crossOriginParent });

    // 不应抛出异常
    expect(() => page.listen(vi.fn())).not.toThrow();
    restore();
  });
});

/* ================================================================== *
 * 7. 集成测试：消息流转
 * ================================================================== */
describe("集成测试：消息流转", () => {
  it("page.send 发送的消息能被 page.listen 接收", async () => {
    const callback = vi.fn();
    page.listen(callback);

    // 不 mock window.postMessage，让事件真实派发
    page.send(MOCK_MESSAGE);

    // window.postMessage 异步触发 message 事件，需等待微任务
    await new Promise((r) => setTimeout(r, 0));

    expect(callback).toHaveBeenCalledWith(MOCK_MESSAGE);
  });

  it("多个 page.listen 监听器都能接收到同一消息", async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    page.listen(callback1);
    page.listen(callback2);

    page.send(MOCK_MESSAGE);

    await new Promise((r) => setTimeout(r, 0));

    // 两个监听器都应收到消息
    expect(callback1).toHaveBeenCalledWith(MOCK_MESSAGE);
    expect(callback2).toHaveBeenCalledWith(MOCK_MESSAGE);
  });
});
