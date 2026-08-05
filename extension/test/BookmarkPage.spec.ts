/**
 * @file test/BookmarkPage.spec.ts
 * @description src/pages/popup/views/BookmarkPage.vue 组件单元测试
 * @author Vivy
 * @date 2026-08-03
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import BookmarkPage from "@/pages/popup/views/BookmarkPage.vue";
import type { Bookmark } from "@/types/components";

/* ------------------------------------------------------------------ *
 * Mock 外部依赖 —— 使用 vi.hoisted 避免 hoisting 问题
 * ------------------------------------------------------------------ */

// 这些变量会被 vi.hoisted 提升到文件顶部，可在 vi.mock 工厂中使用
const mocks = vi.hoisted(() => ({
  mockGetBookmarks: vi.fn(),
  mockDeleteBookmark: vi.fn(),
  mockSaveBookmark: vi.fn(),
  mockSendMessage: vi.fn(),
  mockCreateObjectURL: vi.fn(() => "blob:mock-url"),
  mockRevokeObjectURL: vi.fn(),
}));

// Mock BookmarkStorage 服务
vi.mock("@/services/bookmarkStorage", () => ({
  BookmarkStorage: {
    getBookmarks: mocks.mockGetBookmarks,
    deleteBookmark: mocks.mockDeleteBookmark,
    saveBookmark: mocks.mockSaveBookmark,
  },
}));

// Mock chrome.runtime
(globalThis as any).chrome.runtime = {
  sendMessage: mocks.mockSendMessage,
  getURL: (path: string) => `chrome-extension://test-id/${path}`,
};

// Mock URL API
URL.createObjectURL = mocks.mockCreateObjectURL;
URL.revokeObjectURL = mocks.mockRevokeObjectURL;

/* ------------------------------------------------------------------ *
 * 测试数据
 * ------------------------------------------------------------------ */
const MOCK_BOOKMARKS: Bookmark[] = [
  {
    id: "1",
    text: "这是一段重要的代码片段",
    url: "https://github.com/example/repo/blob/main/src/index.ts",
    title: "GitHub - example/repo",
    timestamp: 1700000000000,
    scrollPosition: { x: 0, y: 100 },
    comments: [],
  },
  {
    id: "2",
    text: "关于 Vue 3 响应式原理的深度解析文章内容很长足够触发截断",
    url: "https://blog.vuejs.org/posts/reactivity-deep-dive",
    title: "Vue Reactivity Deep Dive",
    timestamp: 1600000000000,
    scrollPosition: { x: 0, y: 200 },
    comments: [{ id: "c1", comment: "很有价值", timestamp: 1600000000001 }],
  },
  {
    id: "3",
    text: "短小的锚点",
    url: "https://news.example.com/tech",
    title: "", // 测试空标题
    timestamp: 1500000000000,
    scrollPosition: { x: 50, y: 0 },
    comments: [],
  },
];

/* ------------------------------------------------------------------ *
 * 辅助方法
 * ------------------------------------------------------------------ */
function createWrapper(bookmarks: Bookmark[] = MOCK_BOOKMARKS): VueWrapper {
  mocks.mockGetBookmarks.mockResolvedValue(bookmarks);
  return mount(BookmarkPage, {
    global: {
      // Stub 子组件，避免渲染依赖问题
      stubs: {
        TableContainer: {
          template: `<div class="table-container-stub"><slot name="head__left" /><slot name="head__right" /><slot /></div>`,
        },
        // Stub 所有图标组件
        IconSearch: true,
        IconClose: true,
        IconDownload: true,
        IconUpload: true,
        IconOpen: true,
        IconDelete: true,
        IconBookmark: true,
      },
    },
  });
}

describe("BookmarkPage.vue", () => {
  beforeEach(() => {
    // 清除所有 mock 调用记录，但不清除 mock 行为
    vi.clearAllMocks();
    // 重置 mock 行为为默认
    mocks.mockDeleteBookmark.mockResolvedValue(true);
    mocks.mockSaveBookmark.mockResolvedValue(undefined);
    mocks.mockCreateObjectURL.mockImplementation(() => "blob:mock-url");
  });

  /* ================================================================ *
   * 1. 初始渲染与数据加载
   * ================================================================ */
  describe("初始渲染", () => {
    it("挂载时自动加载书签数据", async () => {
      createWrapper(MOCK_BOOKMARKS);
      expect(mocks.mockGetBookmarks).toHaveBeenCalledTimes(1);
    });

    it("显示书签数量徽章", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      //徽章显示 "3 个"
      expect(wrapper.text()).toContain("3 个");
    });

    it("空数据时显示空状态提示", async () => {
      const wrapper = createWrapper([]);
      await new Promise((r) => setTimeout(r, 0));
      expect(wrapper.text()).toContain("还没有保存锚点");
    });

    it("显示书签列表项", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const items = wrapper.findAll(".bookmark-item");
      expect(items.length).toBe(3);
    });

    it("按时间倒序排列书签", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const items = wrapper.findAll(".bookmark-item");
      // 最新的书签（timestamp: 1700000000000）应该排在最前
      expect(items[0].text()).toContain("这是一段重要的代码片段");
    });
  });

  /* ================================================================ *
   * 2. 筛选功能
   * ================================================================ */
  describe("筛选功能", () => {
    it("无关键词时显示所有书签", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const items = wrapper.findAll(".bookmark-item");
      expect(items.length).toBe(3);
    });

    it("按文本内容筛选", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const input = wrapper.find(".filter-panel-input");
      await input.setValue("重要的代码");
      await input.trigger("input");
      const items = wrapper.findAll(".bookmark-item");
      expect(items.length).toBe(1);
      expect(items[0].text()).toContain("重要的代码片段");
    });

    it("按标题筛选", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const input = wrapper.find(".filter-panel-input");
      await input.setValue("vue reactivity");
      await input.trigger("input");
      const items = wrapper.findAll(".bookmark-item");
      expect(items.length).toBe(1);
    });

    it("按域名筛选", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const input = wrapper.find(".filter-panel-input");
      await input.setValue("github");
      await input.trigger("input");
      const items = wrapper.findAll(".bookmark-item");
      expect(items.length).toBe(1);
    });

    it("大小写不敏感筛选", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const input = wrapper.find(".filter-panel-input");
      await input.setValue("VUE"); // 大写
      await input.trigger("input");
      const items = wrapper.findAll(".bookmark-item");
      expect(items.length).toBe(1);
    });

    it("筛选无结果时显示空筛选状态", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const input = wrapper.find(".filter-panel-input");
      await input.setValue("完全不存在的关键词");
      await input.trigger("input");
      expect(wrapper.text()).toContain("没有找到匹配的锚点");
    });

    it("清空筛选关键词", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const input = wrapper.find(".filter-panel-input");
      await input.setValue("测试");
      await input.trigger("input");
      // 显示清除按钮
      expect(wrapper.find(".filter-panel-clear").exists()).toBe(true);
      // 点击清除
      await wrapper.find(".filter-panel-clear").trigger("click");
      const items = wrapper.findAll(".bookmark-item");
      expect(items.length).toBe(3);
    });

    it("显示筛选结果摘要", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      // 无关键词时显示"共 N 个锚点"
      expect(wrapper.text()).toContain("共 3 个锚点");
      // 输入关键词后
      const input = wrapper.find(".filter-panel-input");
      await input.setValue("重要");
      await input.trigger("input");
      expect(wrapper.text()).toContain("筛选结果 1 / 3");
    });
  });

  /* ================================================================ *
   * 3. 删除功能
   * ================================================================ */
  describe("删除功能", () => {
    it("点击删除按钮显示确认对话框", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const deleteBtn = wrapper.find(".icon-btn--delete");
      await deleteBtn.trigger("click");
      expect(wrapper.find(".confirm-dialog").exists()).toBe(true);
      expect(wrapper.text()).toContain("确认删除这个锚点");
    });

    it("取消删除关闭对话框", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      // 点击第一个删除按钮
      const deleteBtn = wrapper.find(".icon-btn--delete");
      await deleteBtn.trigger("click");
      expect(wrapper.find(".confirm-dialog").exists()).toBe(true);
      // 点击取消
      await wrapper.find(".dialog-btn--ghost").trigger("click");
      expect(wrapper.find(".confirm-dialog").exists()).toBe(false);
    });

    it("确认删除后调用 deleteBookmark", async () => {
      mocks.mockDeleteBookmark.mockResolvedValue(true);
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      // 点击第一个删除按钮
      const deleteBtn = wrapper.find(".icon-btn--delete");
      await deleteBtn.trigger("click");
      // 点击确认删除
      await wrapper.find(".dialog-btn--danger").trigger("click");
      expect(mocks.mockDeleteBookmark).toHaveBeenCalledWith("1");
      expect(mocks.mockDeleteBookmark).toHaveBeenCalledTimes(1);
    });

    it("删除成功后关闭对话框并刷新列表", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      // 点击第一个删除
      await wrapper.find(".icon-btn--delete").trigger("click");
      // 确认删除
      await wrapper.find(".dialog-btn--danger").trigger("click");
      // 等待异步删除 + 重新加载完成
      await new Promise((r) => setTimeout(r, 0));
      // 对话框应已关闭
      expect(wrapper.find(".confirm-dialog").exists()).toBe(false);
      // 应该重新加载列表
      expect(mocks.mockGetBookmarks).toHaveBeenCalledTimes(2); // 初始 + 删除后
    });

    it("删除操作失败时记录错误日志", async () => {
      // 设置删除后重新加载失败
      mocks.mockGetBookmarks
        .mockResolvedValueOnce(MOCK_BOOKMARKS) // 初始加载
        .mockRejectedValueOnce(new Error("加载失败")); // 删除后重载
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      // 点击删除
      await wrapper.find(".icon-btn--delete").trigger("click");
      // 确认删除
      await wrapper.find(".dialog-btn--danger").trigger("click");
      await new Promise((r) => setTimeout(r, 0));
      expect((globalThis as any).maLogger.__records.error?.length).toBeGreaterThan(0);
    });
  });

  /* ================================================================ *
   * 4. 打开书签
   * ================================================================ */
  describe("打开书签", () => {
    it("调用 chrome.runtime.sendMessage 打开书签", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const openBtn = wrapper.find(".icon-btn--open");
      await openBtn.trigger("click");
      expect(mocks.mockSendMessage).toHaveBeenCalledWith({
        type: "OPEN_BOOKMARK",
        payload: MOCK_BOOKMARKS[0],
        target: "background",
      });
    });

    it("无 URL 时不发送消息", async () => {
      const bookmarksWithoutUrl = [{ ...MOCK_BOOKMARKS[0], url: "" }];
      const wrapper = createWrapper(bookmarksWithoutUrl);
      await new Promise((r) => setTimeout(r, 0));
      await wrapper.find(".icon-btn--open").trigger("click");
      expect(mocks.mockSendMessage).not.toHaveBeenCalled();
    });

    it("chrome.runtime 不可用时降级处理", async () => {
      const originalRuntime = (globalThis as any).chrome.runtime;
      (globalThis as any).chrome.runtime = undefined;
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      // 不应抛出异常
      expect(() => wrapper.find(".icon-btn--open").trigger("click")).not.toThrow();
      (globalThis as any).chrome.runtime = originalRuntime;
    });
  });

  /* ================================================================ *
   * 5. 导出功能
   * ================================================================ */
  describe("导出功能", () => {
    it("点击导出按钮触发下载", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      await wrapper.find(".toolbar-btn--export").trigger("click");
      expect(mocks.mockCreateObjectURL).toHaveBeenCalled();
      // 应创建临时链接并点击
    });

    it("导出失败时记录错误", async () => {
      mocks.mockCreateObjectURL.mockImplementation(() => {
        throw new Error("创建 URL 失败");
      });
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      await wrapper.find(".toolbar-btn--export").trigger("click");
      expect((globalThis as any).maLogger.__records.error?.length).toBeGreaterThan(0);
    });
  });

  /* ================================================================ *
   * 6. 导入功能
   * ================================================================ */
  describe("导入功能", () => {
    it("点击导入按钮触发文件选择", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const importBtn = wrapper.find(".toolbar-btn--import");
      await importBtn.trigger("click");
      // 应触发隐藏的 file input 的 click
      const fileInput = wrapper.find(".visually-hidden");
      expect(fileInput.exists()).toBe(true);
    });

    it("无文件时忽略导入", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      // 模拟 change 事件但无文件 —— 通过手动设置 DOM 属性
      const fileInputEl = wrapper.find(".visually-hidden").element as HTMLInputElement;
      // 派发一个 change 事件但不包含文件
      fileInputEl.dispatchEvent(new Event("change"));
      // saveBookmark 不应被调用
      expect(mocks.mockSaveBookmark).not.toHaveBeenCalled();
    });

    it("有效文件导入成功", async () => {
      mocks.mockSaveBookmark.mockResolvedValue(undefined);
      const wrapper = createWrapper([]);
      await new Promise((r) => setTimeout(r, 0));

      // 创建模拟文件
      const fileContent = JSON.stringify([
        { text: "导入的书签", url: "https://imported.com", timestamp: Date.now() },
      ]);
      const file = new File([fileContent], "bookmarks.json", {
        type: "application/json",
      });

      // 直接设置 DOM 属性并派发 change 事件
      const fileInputEl = wrapper.find(".visually-hidden").element as HTMLInputElement;
      // happy-dom 不允许直接设置 files，使用 Object.defineProperty
      Object.defineProperty(fileInputEl, "files", {
        value: [file],
        writable: false,
      });
      fileInputEl.dispatchEvent(new Event("change"));

      // 等待异步导入完成
      await new Promise((r) => setTimeout(r, 100));
      expect(mocks.mockSaveBookmark).toHaveBeenCalled();
    });

    it("无效 JSON 文件导入失败", async () => {
      const wrapper = createWrapper([]);
      await new Promise((r) => setTimeout(r, 0));

      const file = new File(["not valid json"], "bad.json", {
        type: "application/json",
      });
      const fileInputEl = wrapper.find(".visually-hidden").element as HTMLInputElement;
      Object.defineProperty(fileInputEl, "files", {
        value: [file],
        writable: false,
      });
      fileInputEl.dispatchEvent(new Event("change"));
      await new Promise((r) => setTimeout(r, 100));
      expect((globalThis as any).maLogger.__records.error?.length).toBeGreaterThan(0);
    });
  });

  /* ================================================================ *
   * 7. 工具函数
   * ================================================================ */
  describe("工具函数", () => {
    let wrapper: VueWrapper;

    beforeEach(async () => {
      wrapper = createWrapper([]);
      await new Promise((r) => setTimeout(r, 0));
    });

    it("truncateUrl: 短 URL 不截断", async () => {
      // 直接通过组件实例方法测试
      const vm = wrapper.vm as any;
      expect(vm.truncateUrl("https://short.url")).toBe("https://short.url");
    });

    it("truncateUrl: 长 URL 截断显示", async () => {
      const vm = wrapper.vm as any;
      const longUrl = "https://very-very-very-very-very-very-very-very-very-very-long-url.com/path";
      const truncated = vm.truncateUrl(longUrl);
      expect(truncated.length).toBeLessThanOrEqual(43); // 40 + 3 dots
      expect(truncated.endsWith("...")).toBe(true);
    });

    it("getDomainLabel: 提取域名", async () => {
      const vm = wrapper.vm as any;
      expect(vm.getDomainLabel("https://github.com/user/repo")).toBe("github.com");
    });

    it("getDomainLabel: 无效 URL 返回未知站点", async () => {
      const vm = wrapper.vm as any;
      expect(vm.getDomainLabel("not-a-url")).toBe("未知站点");
    });

    it("formatDate: 格式化时间戳", async () => {
      const vm = wrapper.vm as any;
      const timestamp = 1700000000000;
      const result = vm.formatDate(timestamp);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  /* ================================================================ *
   * 8. 渲染细节
   * ================================================================ */
  describe("渲染细节", () => {
    it("显示标题：空标题显示'未命名页面'", async () => {
      const wrapper = createWrapper([MOCK_BOOKMARKS[2]]); // 空标题的书签
      await new Promise((r) => setTimeout(r, 0));
      expect(wrapper.text()).toContain("未命名页面");
    });

    it("显示域名标签", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      expect(wrapper.text()).toContain("github.com");
      expect(wrapper.text()).toContain("blog.vuejs.org");
    });

    it("时间倒序排列正确", async () => {
      const wrapper = createWrapper(MOCK_BOOKMARKS);
      await new Promise((r) => setTimeout(r, 0));
      const items = wrapper.findAll(".bookmark-item");
      // 第一个是 timestamp 最大的（最新的）
      expect(items[0].text()).toContain("代码片段");
      // 最后一个是 timestamp 最小的（最旧的）
      expect(items[items.length - 1].text()).toContain("短小的锚点");
    });

    it("BookmarkStorage.getBookmarks 异常时降级为空列表", async () => {
      mocks.mockGetBookmarks.mockRejectedValue(new Error("存储不可用"));
      const wrapper = mount(BookmarkPage, {
        global: {
          stubs: {
            TableContainer: { template: "<div><slot /></div>" },
            IconSearch: true,
            IconClose: true,
            IconDownload: true,
            IconUpload: true,
            IconOpen: true,
            IconDelete: true,
            IconBookmark: true,
          },
        },
      });
      await new Promise((r) => setTimeout(r, 0));
      expect(wrapper.text()).toContain("还没有保存锚点");
      expect((globalThis as any).maLogger.__records.error?.length).toBeGreaterThan(0);
    });
  });
});
