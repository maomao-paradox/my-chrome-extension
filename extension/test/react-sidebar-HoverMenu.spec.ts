/**
 * HoverMenu 单元测试
 *
 * 测试覆盖：
 * - dock 容器渲染
 * - dock-cell 数量与 items 一致
 * - miku-trigger 默认不可见（onMounted 后变为可见）
 * - 点击 miku-trigger 切换 MikuChatWindow 显示
 * - 点击 dock-cell 触发 onClick 回调
 * - bus.emit('show') / 'hide' 控制 dock active 状态
 * - 鼠标 hover 切换 dock-icon.hover class
 *
 * @author Vivy
 * @date 2026-08-05
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import type { Tool } from "@/types";
import { bus } from "@/event/bus";
import HoverMenu from "@/apps/sidebar/HoverMenu";

afterEach(() => {
  cleanup();
  bus.all.clear();
});

const makeItems = (): Tool[] => [
  { id: "i1", label: "项目1", color: "#f00" },
  { id: "i2", label: "项目2", color: "#0f0" },
  { id: "i3", label: "项目3", color: "#00f" },
];

describe("HoverMenu", () => {
  it("渲染 dock 容器与对应数量的 dock-cell", () => {
    const items = makeItems();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true }),
    );
    expect(container.querySelector(".dock")).not.toBeNull();
    expect(container.querySelectorAll(".dock-cell").length).toBe(3);
  });

  it("每个 dock-icon 应用对应 color 作为 --c CSS 变量", () => {
    const items = makeItems();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true }),
    );
    const icons = container.querySelectorAll(".dock-icon");
    expect(icons.length).toBe(3);
    // 第一个 icon 的 --c 应为 #f00
    expect((icons[0] as HTMLElement).style.getPropertyValue("--c")).toBe(
      "#f00",
    );
    expect((icons[1] as HTMLElement).style.getPropertyValue("--c")).toBe(
      "#0f0",
    );
  });

  it("dock-cell 应用 --delay CSS 变量（基于索引）", () => {
    const items = makeItems();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true }),
    );
    const cells = container.querySelectorAll(".dock-cell");
    expect((cells[0] as HTMLElement).style.getPropertyValue("--delay")).toBe(
      "0s",
    );
    expect((cells[1] as HTMLElement).style.getPropertyValue("--delay")).toBe(
      "0.12s",
    );
    expect((cells[2] as HTMLElement).style.getPropertyValue("--delay")).toBe(
      "0.24s",
    );
  });

  it("onMounted 后 miku-trigger 可见", () => {
    // 注：React useEffect 在 render 后执行，setup 后 mikuTriggerVisible 即为 true
    const items = makeItems();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true }),
    );
    // useEffect 执行后 miku-trigger 应可见
    expect(container.querySelector(".miku-trigger")).not.toBeNull();
  });

  it("点击 dock-cell 触发 onClick 回调", () => {
    const items = makeItems();
    const onClick = vi.fn();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true, onClick }),
    );
    const cells = container.querySelectorAll(".dock-cell");
    fireEvent.click(cells[1] as HTMLElement);
    expect(onClick).toHaveBeenCalledWith(items[1]);
  });

  it("鼠标进入 dock-cell 显示 tip，离开后隐藏", () => {
    const items = makeItems();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true }),
    );
    // 初始无 tip
    expect(container.querySelector(".tip")).toBeNull();

    // 鼠标进入第一项
    const firstCell = container.querySelector(".dock-cell") as HTMLElement;
    fireEvent.mouseEnter(firstCell);
    // 应显示 tip
    const tip = container.querySelector(".tip");
    expect(tip).not.toBeNull();
    expect(tip!.textContent).toBe("项目1");
    // dock-icon 应有 hover class
    const icon = container.querySelector(".dock-icon") as HTMLElement;
    expect(icon.classList.contains("hover")).toBe(true);

    // 鼠标离开
    fireEvent.mouseLeave(firstCell);
    expect(container.querySelector(".tip")).toBeNull();
    expect(icon.classList.contains("hover")).toBe(false);
  });

  it("bus.emit('show') 添加 dock.active class", () => {
    const items = makeItems();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true }),
    );
    const dock = container.querySelector(".dock") as HTMLElement;
    expect(dock.classList.contains("active")).toBe(false);

    act(() => {
      bus.emit("show");
    });
    expect(dock.classList.contains("active")).toBe(true);
  });

  it("bus.emit('hide') 移除 dock.active class", () => {
    const items = makeItems();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true }),
    );
    const dock = container.querySelector(".dock") as HTMLElement;

    // 先 show 再 hide
    act(() => {
      bus.emit("show");
    });
    expect(dock.classList.contains("active")).toBe(true);

    act(() => {
      bus.emit("hide");
    });
    expect(dock.classList.contains("active")).toBe(false);
  });

  it("点击 miku-trigger 显示 MikuChatWindow，再点关闭按钮关闭", () => {
    const items = makeItems();
    const { container } = render(
      React.createElement(HoverMenu, { items, visible: true }),
    );

    const trigger = container.querySelector(".miku-trigger") as HTMLElement;
    expect(trigger).not.toBeNull();

    // 初始无 MikuChatWindow
    expect(container.querySelector(".miku-chat-window")).toBeNull();

    // 点击 trigger 显示 MikuChatWindow
    fireEvent.click(trigger);
    expect(container.querySelector(".miku-chat-window")).not.toBeNull();

    // 通过 MikuChatWindow 的关闭按钮关闭（trigger 在显示窗口时被隐藏）
    const closeBtn = container.querySelector(
      ".close-button",
    ) as HTMLElement;
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);
    // MikuChatWindow 应消失
    expect(container.querySelector(".miku-chat-window")).toBeNull();
  });
});
