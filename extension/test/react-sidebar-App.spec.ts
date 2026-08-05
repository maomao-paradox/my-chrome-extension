/**
 * SidebarApp 主组件单元测试
 *
 * 测试覆盖：
 * - 默认渲染 HoverMenu + SimpleCarousel
 * - props.tools 变化时同步到 localTools
 * - bus.emit('update:sidebar:tools') 更新 localTools
 * - handleClick 优先调用 tool.onClick
 * - handleClick 无 onClick 时展开 carousel
 * - handleContextMenuClick 发送 chrome.runtime.sendMessage
 *
 * 注：HoverMenu 中 dock-cell 的 label 仅在 hover 时显示为 tip，
 *     所以验证 dock-cell 数量而非文本内容。
 *
 * @author Vivy
 * @date 2026-08-05
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import type { Tool } from "@/types";
import { bus } from "@/event/bus";
import SidebarApp from "@/apps/sidebar/App";

// 确保 chrome.runtime.sendMessage 存在（setup.ts 未注入）
beforeEach(() => {
  if (!chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  // 清理 bus 监听器，避免测试间污染
  bus.all.clear();
  // 重置 sendMessage spy
  if (vi.isMockFunction(chrome.runtime.sendMessage)) {
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockClear();
  }
});

const makeTools = (): Tool[] => [
  {
    id: "t1",
    label: "工具1",
    color: "#409eff",
    children: [
      { id: "t1-1", label: "子工具1", details: "子1详情" },
      { id: "t1-2", label: "子工具2", details: "子2详情" },
    ],
  },
  {
    id: "t2",
    label: "工具2",
    color: "#67c23a",
    children: [{ id: "t2-1", label: "子工具3", details: "子3详情" }],
  },
];

describe("SidebarApp", () => {
  it("默认渲染 HoverMenu 与 SimpleCarousel（隐藏）", () => {
    const tools = makeTools();
    const { container } = render(
      React.createElement(SidebarApp, { tools, visible: true }),
    );
    // HoverMenu 的 dock 容器
    expect(container.querySelector(".dock")).not.toBeNull();
    // 默认工具渲染为 dock-cell
    expect(container.querySelectorAll(".dock-cell").length).toBe(2);
    // SimpleCarousel 默认不可见（无 wrapper）
    expect(container.querySelector(".ma-carousel-wrapper")).toBeNull();
  });

  it("props.tools 变化时同步 dock-cell 数量", () => {
    const { rerender, container } = render(
      React.createElement(SidebarApp, { tools: makeTools(), visible: true }),
    );
    // 初始 2 个 dock-cell
    expect(container.querySelectorAll(".dock-cell").length).toBe(2);

    // 更新 tools 为 1 个
    const newTools: Tool[] = [
      { id: "new", label: "新工具", color: "#f00" },
    ];
    rerender(
      React.createElement(SidebarApp, { tools: newTools, visible: true }),
    );
    expect(container.querySelectorAll(".dock-cell").length).toBe(1);
  });

  it("bus.emit('update:sidebar:tools') 更新 dock-cell 数量", () => {
    const tools = makeTools();
    const { container } = render(
      React.createElement(SidebarApp, { tools, visible: true }),
    );
    expect(container.querySelectorAll(".dock-cell").length).toBe(2);

    // 通过事件总线更新 tools 为 3 个
    const newTools: Tool[] = [
      { id: "bus-tool-1", label: "总线工具1", color: "#0f0" },
      { id: "bus-tool-2", label: "总线工具2", color: "#0f0" },
      { id: "bus-tool-3", label: "总线工具3", color: "#0f0" },
    ];
    act(() => {
      bus.emit("update:sidebar:tools", newTools);
    });

    // dock-cell 应变为 3 个
    expect(container.querySelectorAll(".dock-cell").length).toBe(3);
  });

  it("点击有 onClick 的菜单项时调用 onClick 而不展开 carousel", () => {
    const onClick = vi.fn();
    const tools: Tool[] = [
      { id: "clickable", label: "可点击", color: "#000", onClick },
    ];
    const { container } = render(
      React.createElement(SidebarApp, { tools, visible: true }),
    );
    const menuItem = container.querySelector(".dock-cell") as HTMLElement;
    expect(menuItem).not.toBeNull();
    fireEvent.click(menuItem);
    expect(onClick).toHaveBeenCalledOnce();
    // 不应展开 carousel
    expect(container.querySelector(".ma-carousel-wrapper")).toBeNull();
  });

  it("点击无 onClick 的菜单项时展开 carousel 显示 children", () => {
    const tools = makeTools();
    const { container } = render(
      React.createElement(SidebarApp, { tools, visible: true }),
    );

    // 初始 carousel 不可见
    expect(container.querySelector(".ma-carousel-wrapper")).toBeNull();

    // 点击第一个菜单项（无 onClick，有 children）
    const menuItem = container.querySelector(".dock-cell") as HTMLElement;
    fireEvent.click(menuItem);

    // carousel 应展开
    const wrapper = container.querySelector(".ma-carousel-wrapper");
    expect(wrapper).not.toBeNull();
    // 应渲染子工具的 carousel item
    expect(container.querySelectorAll(".ma-carousel-item").length).toBe(2);
  });

  it("点击 carousel 中的子工具发送 chrome.runtime.sendMessage 并关闭", () => {
    const tools = makeTools();
    const { container } = render(
      React.createElement(SidebarApp, { tools, visible: true }),
    );

    // 展开 carousel
    const menuItem = container.querySelector(".dock-cell") as HTMLElement;
    fireEvent.click(menuItem);

    // 点击激活的 carousel 项
    const activeItem = container.querySelector(
      ".ma-carousel-item.is-active",
    ) as HTMLElement;
    fireEvent.click(activeItem);

    // 应发送消息到 background
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CONTEXT_MENU_CLICK",
        target: "background",
      }),
    );
    // carousel 应关闭
    expect(container.querySelector(".ma-carousel-wrapper")).toBeNull();
  });

  it("tools 为空时使用默认工具（渲染 1 个 dock-cell）", () => {
    const { container } = render(
      React.createElement(SidebarApp, { tools: [], visible: true }),
    );
    // 默认工具 DEFAULT_TOOLS 只有 1 个
    expect(container.querySelectorAll(".dock-cell").length).toBe(1);
  });

  it("tools 为 undefined 时使用默认工具（渲染 1 个 dock-cell）", () => {
    const { container } = render(
      React.createElement(SidebarApp, { visible: true }),
    );
    expect(container.querySelectorAll(".dock-cell").length).toBe(1);
  });
});
