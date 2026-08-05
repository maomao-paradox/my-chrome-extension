/**
 * SimpleCarousel 单元测试
 *
 * 测试策略：
 * - 使用 React.createElement 避免 JSX 编译依赖（vitest.config.ts 未启用 plugin-react）
 * - 使用 @testing-library/react 的 render + fireEvent 进行组件渲染与交互测试
 * - mock chrome.runtime.getURL 等运行时 API（由 test/setup.ts 全局注入）
 *
 * @author Vivy
 * @date 2026-08-05
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { act } from "react";
import type { Tool } from "@/types";
import SimpleCarousel from "@/apps/sidebar/components/SimpleCarousel";

// 每个测试后清理 DOM，避免污染
afterEach(() => {
  cleanup();
});

// 构造测试数据
const makeTools = (): Tool[] => [
  {
    id: "tool-a",
    label: "工具 A",
    details: "工具 A 的描述",
    image: "https://example.com/a.png",
  },
  {
    id: "tool-b",
    label: "工具 B",
    details: "工具 B 的描述",
  },
  {
    id: "hello",
    label: "你好",
    details: "你好提示",
  },
];

describe("SimpleCarousel", () => {
  it("visible=false 时不渲染任何内容", () => {
    const { container } = render(
      React.createElement(SimpleCarousel, {
        visible: false,
        tools: makeTools(),
      }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("visible=true 时渲染遮罩层和工具项", () => {
    const tools = makeTools();
    const { container, getByText } = render(
      React.createElement(SimpleCarousel, {
        visible: true,
        tools,
      }),
    );

    // 遮罩层应存在
    expect(container.querySelector(".ma-carousel-mask")).not.toBeNull();
    // 工具项应渲染（首项为 active）
    expect(getByText("工具 A")).toBeTruthy();
    expect(getByText("工具 A 的描述")).toBeTruthy();
  });

  it("hello 工具项渲染特殊文案", () => {
    const tools: Tool[] = [
      { id: "hello", label: "你好", details: "提示" },
    ];
    const { getByText } = render(
      React.createElement(SimpleCarousel, {
        visible: true,
        tools,
      }),
    );
    // hello 项渲染 BUG 文案
    expect(getByText("这里有一个BUG，痛い！")).toBeTruthy();
  });

  it("点击遮罩层触发 onVisibleChange(false)", () => {
    const onVisibleChange = vi.fn();
    const { container } = render(
      React.createElement(SimpleCarousel, {
        visible: true,
        tools: makeTools(),
        onVisibleChange,
      }),
    );
    const mask = container.querySelector(".ma-carousel-mask")!;
    fireEvent.click(mask);
    expect(onVisibleChange).toHaveBeenCalledWith(false);
  });

  it("点击激活项触发 onClickTool 并关闭", () => {
    const tools = makeTools();
    const onClickTool = vi.fn();
    const onVisibleChange = vi.fn();
    const { container } = render(
      React.createElement(SimpleCarousel, {
        visible: true,
        tools,
        onClickTool,
        onVisibleChange,
      }),
    );
    // 首项为 active，点击它应触发 onClickTool
    const activeItem = container.querySelector(
      ".ma-carousel-item.is-active",
    ) as HTMLElement;
    expect(activeItem).not.toBeNull();
    fireEvent.click(activeItem);
    expect(onClickTool).toHaveBeenCalledWith(tools[0]);
    expect(onVisibleChange).toHaveBeenCalledWith(false);
  });

  it("tool.onClick 优先于 onClickTool 回调", () => {
    const onClick = vi.fn();
    const tools: Tool[] = [
      { id: "x", label: "X", details: "d", onClick },
    ];
    const onClickTool = vi.fn();
    const { container } = render(
      React.createElement(SimpleCarousel, {
        visible: true,
        tools,
        onClickTool,
      }),
    );
    const activeItem = container.querySelector(
      ".ma-carousel-item.is-active",
    ) as HTMLElement;
    fireEvent.click(activeItem);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClickTool).not.toHaveBeenCalled();
  });

  it("点击非激活项切换为 active 而不触发回调", () => {
    const tools = makeTools();
    const onClickTool = vi.fn();
    const { container } = render(
      React.createElement(SimpleCarousel, {
        visible: true,
        tools,
        onClickTool,
      }),
    );
    // 找到第二个 item（非 active）
    const items = container.querySelectorAll(".ma-carousel-item");
    expect(items.length).toBeGreaterThanOrEqual(2);
    const secondItem = items[1] as HTMLElement;
    fireEvent.click(secondItem);
    // 不应触发回调
    expect(onClickTool).not.toHaveBeenCalled();
    // 第二项应变为 active
    expect(secondItem.classList.contains("is-active")).toBe(true);
  });

  it("右箭头按钮点击切换到下一项", () => {
    const tools = makeTools();
    const { container } = render(
      React.createElement(SimpleCarousel, {
        visible: true,
        tools,
      }),
    );
    const nextBtn = container.querySelector(
      ".ma-carousel-arrow.next",
    ) as HTMLButtonElement;
    const items = container.querySelectorAll(".ma-carousel-item");
    // 初始第一项 active
    expect(items[0].classList.contains("is-active")).toBe(true);
    fireEvent.click(nextBtn);
    // 切换后第二项 active
    const itemsAfter = container.querySelectorAll(".ma-carousel-item");
    expect(itemsAfter[1].classList.contains("is-active")).toBe(true);
  });

  it("ESC 键关闭轮播", () => {
    const onVisibleChange = vi.fn();
    render(
      React.createElement(SimpleCarousel, {
        visible: true,
        tools: makeTools(),
        onVisibleChange,
      }),
    );
    // 模拟 ESC 键
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onVisibleChange).toHaveBeenCalledWith(false);
  });
});
