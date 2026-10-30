/**
 * AIConversation「加载更早历史」按钮回归测试
 *
 * 回归背景：
 *   点击「↑ 加载更早的历史」按钮后无任何反应。
 *   根因：loadHistoryForRole 依赖 timeWindow，而「role 变化」effect 的依赖数组里
 *   又包含 loadHistoryForRole —— 点击扩大窗口 → 回调引用变化 → effect 重跑 →
 *   setTimeWindow(defaultHistoryWindow) 把窗口重置回 "1d"，界面瞬间回到点击前。
 *
 * 修复：hasMoreHistory 改为由 allHistory + timeWindow 派生（useMemo），
 *   loadHistoryForRole 不再依赖 timeWindow，effect 只在 role 变化时执行。
 *
 * 测试覆盖：
 *   - 默认 1d 窗口只显示当天消息，更早的消息不可见
 *   - 点击按钮后窗口扩大到 7d，两天前的消息出现（核心回归断言）
 *   - 7d → all 逐级扩大，加载完全部历史后按钮消失
 *
 * @author Vivy
 * @date 2026-10-29
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import {
  render,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import AIConversation from "@/modules/sidebar/components/AIConversation";

/* ------------------------------------------------------------------ *
 * mock @/services/memory：提供可控的 listByCategory 数据
 * ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  listByCategory: vi.fn(),
}));

vi.mock("@/services/memory", () => ({
  getMemoryService: () => ({
    listByCategory: mocks.listByCategory,
    listRoles: async () => [],
    getIdentity: async () => null,
    addEntry: async () => ({}),
  }),
}));

vi.mock("@/service-worker/chrome-api/ai-config", () => ({
  loadAIConfig: vi.fn(async () => null),
}));

/* ------------------------------------------------------------------ *
 * 工具：构造一条 conversation 记忆条目
 * ------------------------------------------------------------------ */
const DAY_MS = 24 * 60 * 60 * 1000;

const makeEntry = (
  id: string,
  createdAt: number,
  userText: string,
  aiText: string,
) => ({
  id,
  role: "tester",
  category: "conversation",
  content: `用户：${userText}\nAI：${aiText}`,
  importance: "medium",
  source: "ai-conversation",
  createdAt,
  lastAccessedAt: createdAt,
  accessCount: 0,
});

const ROLE_OPTIONS = [
  { value: "tester", label: "测试员", avatar: "TE", systemPrompt: "" },
];

const renderConversation = () =>
  render(
    React.createElement(AIConversation, {
      defaultRole: "tester",
      roleOptions: ROLE_OPTIONS,
    }),
  );

afterEach(() => {
  cleanup();
  mocks.listByCategory.mockReset();
});

describe("AIConversation - 加载更早历史按钮", () => {
  it("默认只显示 1 天内的消息，点击按钮后两天前的消息出现", async () => {
    const now = Date.now();
    mocks.listByCategory.mockResolvedValue([
      makeEntry("e-old", now - 2 * DAY_MS, "两天前的问题", "两天前的回答"),
      makeEntry("e-new", now, "今天的问题", "今天的回答"),
    ]);

    const { findByText, queryByText, getByRole, queryByRole } =
      renderConversation();

    // 默认窗口 1d：今天的消息可见，两天前的不可见
    await findByText("今天的问题");
    expect(queryByText("两天前的问题")).toBeNull();

    // 「加载更早的历史」按钮应出现
    const loadMoreBtn = getByRole("button", { name: /加载更早的历史/ });
    expect(loadMoreBtn).toBeTruthy();

    // 点击 → 窗口扩大到 7d（回归断言：修复前会被 effect 重置回 1d，永远点不动）
    fireEvent.click(loadMoreBtn);
    await findByText("两天前的问题");

    // 7d 已覆盖全部历史 → 按钮消失
    await waitFor(() => {
      expect(
        queryByRole("button", { name: /加载更早|加载全部|已到最顶/ }),
      ).toBeNull();
    });
  });

  it("7d → all 逐级扩大，加载完全部历史后按钮消失", async () => {
    const now = Date.now();
    mocks.listByCategory.mockResolvedValue([
      makeEntry("e-30d", now - 30 * DAY_MS, "三十天前的问题", "三十天前的回答"),
      makeEntry("e-2d", now - 2 * DAY_MS, "两天前的问题", "两天前的回答"),
      makeEntry("e-new", now, "今天的问题", "今天的回答"),
    ]);

    const { findByText, findByRole, queryByText, getByRole, queryByRole } =
      renderConversation();

    // 1d：仅今天可见
    await findByText("今天的问题");
    expect(queryByText("两天前的问题")).toBeNull();
    expect(queryByText("三十天前的问题")).toBeNull();

    // 第一次点击 → 7d：两天前可见，三十天前仍不可见
    fireEvent.click(getByRole("button", { name: /加载更早的历史/ }));
    await findByText("两天前的问题");
    expect(queryByText("三十天前的问题")).toBeNull();

    // 第二次点击 → all：三十天前可见，按钮消失
    // 注意用 findByRole 等待「加载中...」态结束（按钮文案依赖 historyLoading，rAF 完成后才切换）
    fireEvent.click(await findByRole("button", { name: /加载全部历史/ }));
    await findByText("三十天前的问题");
    await waitFor(() => {
      expect(
        queryByRole("button", { name: /加载更早|加载全部|已到最顶/ }),
      ).toBeNull();
    });
  });
});
