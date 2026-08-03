/**
 * @file test/useDomainState.spec.ts
 * @description src/pages/popup/composables/useDomainState.ts 单元测试
 * @author Vivy
 * @date 2026-08-03
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";
import { useDomainState } from "@/pages/popup/composables/useDomainState";

/* ------------------------------------------------------------------ *
 * 1. extractDomain 测试
 * ------------------------------------------------------------------ */
describe("useDomainState - extractDomain", () => {
  const { extractDomain } = useDomainState();

  it("正确解析 http 链接（默认端口 80）", () => {
    expect(extractDomain("http://example.com")).toBe("example.com:80");
  });

  it("正确解析 https 链接（默认端口 443）", () => {
    expect(extractDomain("https://example.com")).toBe("example.com:443");
  });

  it("正确解析带指定端口的链接", () => {
    expect(extractDomain("http://localhost:3000")).toBe("localhost:3000");
    expect(extractDomain("https://localhost:8443")).toBe("localhost:8443");
  });

  it("正确解析含路径和查询的链接", () => {
    expect(extractDomain("https://api.example.com/v1/users?token=abc")).toBe(
      "api.example.com:443",
    );
  });

  it("非法 URL 字符串返回空字符串", () => {
    expect(extractDomain("not-a-valid-url")).toBe("");
    expect(extractDomain("")).toBe("");
  });

  it("URL 解析异常时触发 maLogger.error", () => {
    extractDomain("invalid-url");
    expect((globalThis as any).maLogger.__records.error?.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ *
 * 2. checkDomainStatus 测试
 * ------------------------------------------------------------------ */
describe("useDomainState - checkDomainStatus", () => {
  let queryTabsMock: any;
  let storageGetMock: any;

  beforeEach(() => {
    // Mock chrome.tabs.query
    queryTabsMock = vi.fn().mockResolvedValue([{ url: "https://test.com/page" }]);
    (globalThis as any).chrome.tabs = {
      query: queryTabsMock,
    };

    // Mock chrome.storage.local.get
    storageGetMock = vi.fn().mockResolvedValue({
      disabledDomains: ["blocked.com:443", "disabled.org:80"],
    });
    (globalThis as any).chrome.storage = {
      local: { get: storageGetMock },
    };
  });

  it("正常流程：域名未禁用", async () => {
    const { isDomainDisabled, currentDomain, checkDomainStatus } = useDomainState();
    await checkDomainStatus();
    expect(currentDomain.value).toBe("test.com:443");
    expect(isDomainDisabled.value).toBe(false);
  });

  it("正常流程：域名在禁用列表中", async () => {
    queryTabsMock.mockResolvedValue([{ url: "https://blocked.com/home" }]);
    const { isDomainDisabled, currentDomain, checkDomainStatus } = useDomainState();
    await checkDomainStatus();
    expect(currentDomain.value).toBe("blocked.com:443");
    expect(isDomainDisabled.value).toBe(true);
  });

  it("无法获取当前活动标签页", async () => {
    queryTabsMock.mockResolvedValue([]);
    const { isDomainDisabled, currentDomain, checkDomainStatus } = useDomainState();
    await checkDomainStatus();
    expect(currentDomain.value).toBe("");
    expect(isDomainDisabled.value).toBe(false);
  });

  it("标签页无 URL 属性", async () => {
    queryTabsMock.mockResolvedValue([{}]); // 无 url 属性
    const { currentDomain, checkDomainStatus } = useDomainState();
    await checkDomainStatus();
    expect(currentDomain.value).toBe("");
  });

  it("URL 无法解析（extractDomain 返回空）", async () => {
    queryTabsMock.mockResolvedValue([{ url: "not-a-valid-url" }]);
    const { currentDomain, checkDomainStatus } = useDomainState();
    await checkDomainStatus();
    expect(currentDomain.value).toBe("");
  });

  it("存储中无 disabledDomains 字段", async () => {
    storageGetMock.mockResolvedValue({});
    const { isDomainDisabled, checkDomainStatus } = useDomainState();
    await checkDomainStatus();
    expect(isDomainDisabled.value).toBe(false);
  });

  it("chrome.tabs.query 抛出异常", async () => {
    queryTabsMock.mockRejectedValue(new Error("Chrome API error"));
    const { checkDomainStatus } = useDomainState();
    await expect(checkDomainStatus()).resolves.not.toThrow();
    expect((globalThis as any).maLogger.__records.error?.length).toBeGreaterThan(0);
  });

  it("chrome.storage.local.get 抛出异常", async () => {
    storageGetMock.mockRejectedValue(new Error("Storage error"));
    const { isDomainDisabled, currentDomain, checkDomainStatus } = useDomainState();
    await checkDomainStatus();
    // 异常被捕获，状态不应为之前 mock 的存储结果
    expect(currentDomain.value).toBe("test.com:443");
    expect(isDomainDisabled.value).toBe(false);
    expect((globalThis as any).maLogger.__records.error?.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ *
 * 3. 状态隔离性测试
 * ------------------------------------------------------------------ */
describe("useDomainState - 状态隔离", () => {
  it("两次调用 useDomainState 创建独立的状态实例", async () => {
    const instance1 = useDomainState();
    const instance2 = useDomainState();

    // 设置不同的 mock 数据
    (globalThis as any).chrome.tabs.query.mockResolvedValueOnce([
      { url: "https://first.com" },
    ]);
    (globalThis as any).chrome.storage.local.get.mockResolvedValueOnce({
      disabledDomains: [],
    });

    await instance1.checkDomainStatus();
    expect(instance1.currentDomain.value).toBe("first.com:443");

    // instance2 应该还保持初始状态
    expect(instance2.currentDomain.value).toBe("");
    expect(instance2.isDomainDisabled.value).toBe(false);
  });
});
