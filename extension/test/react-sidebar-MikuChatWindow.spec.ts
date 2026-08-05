/**
 * MikuChatWindow 单元测试
 *
 * 测试覆盖：
 * - 音乐播放器三按钮渲染
 * - 播放/暂停切换状态
 * - 旋转光盘动画 class 切换
 * - 关闭按钮触发 onClose 回调
 * - AIConversationPlaceholder 占位组件渲染
 *
 * @author Vivy
 * @date 2026-08-05
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import MikuChatWindow from "@/apps/sidebar/MikuChatWindow";

afterEach(() => {
  cleanup();
});

describe("MikuChatWindow", () => {
  it("渲染音乐播放器三个按钮（上一首/播放暂停/下一首）", () => {
    const { container, getByLabelText } = render(
      React.createElement(MikuChatWindow, { onClose: vi.fn() }),
    );

    // 三个音乐控制按钮
    const prevBtn = getByLabelText("上一首");
    const toggleBtn = getByLabelText("暂停"); // 默认播放中，显示"暂停"
    const nextBtn = getByLabelText("下一首");
    expect(prevBtn).toBeTruthy();
    expect(toggleBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();

    // toggle 按钮应有 is-primary class
    expect(toggleBtn.classList.contains("is-primary")).toBe(true);
    // 容器存在
    expect(container.querySelector(".miku-chat-window")).not.toBeNull();
  });

  it("默认 isMusicPlaying=true，光盘应有 is-playing class", () => {
    const { container } = render(
      React.createElement(MikuChatWindow, { onClose: vi.fn() }),
    );
    const disc = container.querySelector(".music-disc");
    expect(disc).not.toBeNull();
    expect(disc!.classList.contains("is-playing")).toBe(true);
  });

  it("点击播放/暂停按钮切换为暂停状态", () => {
    const { getByLabelText, container } = render(
      React.createElement(MikuChatWindow, { onClose: vi.fn() }),
    );

    // 初始为播放中
    let toggleBtn = getByLabelText("暂停");
    let disc = container.querySelector(".music-disc")!;
    expect(disc.classList.contains("is-playing")).toBe(true);

    // 点击切换
    fireEvent.click(toggleBtn);

    // 应切换为暂停状态
    toggleBtn = getByLabelText("播放");
    disc = container.querySelector(".music-disc")!;
    expect(disc.classList.contains("is-playing")).toBe(false);
  });

  it("再次点击播放按钮恢复播放状态", () => {
    const { getByLabelText, container } = render(
      React.createElement(MikuChatWindow, { onClose: vi.fn() }),
    );

    // 暂停
    fireEvent.click(getByLabelText("暂停"));
    // 恢复播放
    fireEvent.click(getByLabelText("播放"));

    const disc = container.querySelector(".music-disc")!;
    expect(disc.classList.contains("is-playing")).toBe(true);
    // 按钮 label 应恢复为"暂停"
    expect(getByLabelText("暂停")).toBeTruthy();
  });

  it("点击上一首/下一首按钮不改变播放状态", () => {
    const { getByLabelText, container } = render(
      React.createElement(MikuChatWindow, { onClose: vi.fn() }),
    );

    const discBefore = container.querySelector(".music-disc")!;
    expect(discBefore.classList.contains("is-playing")).toBe(true);

    // 点击上一首
    fireEvent.click(getByLabelText("上一首"));
    let disc = container.querySelector(".music-disc")!;
    expect(disc.classList.contains("is-playing")).toBe(true);

    // 点击下一首
    fireEvent.click(getByLabelText("下一首"));
    disc = container.querySelector(".music-disc")!;
    expect(disc.classList.contains("is-playing")).toBe(true);
  });

  it("点击关闭按钮触发 onClose 回调", () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      React.createElement(MikuChatWindow, { onClose }),
    );
    const closeBtn = getByLabelText("关闭 Miku 对话");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("渲染 AIConversationPlaceholder 占位组件", () => {
    const { getByText } = render(
      React.createElement(MikuChatWindow, { onClose: vi.fn() }),
    );
    // 占位组件应渲染欢迎标题
    expect(getByText("今晚想聊点什么？")).toBeTruthy();
    // 占位组件应渲染迁移提示
    expect(getByText(/当前角色：Hatsune Miku/)).toBeTruthy();
  });

  it("渲染角色状态栏 'MIKU ONLINE'", () => {
    const { getByText } = render(
      React.createElement(MikuChatWindow, { onClose: vi.fn() }),
    );
    expect(getByText("MIKU ONLINE")).toBeTruthy();
  });

  it("渲染标题 'Hatsune Miku'", () => {
    const { getByText } = render(
      React.createElement(MikuChatWindow, { onClose: vi.fn() }),
    );
    // h3 标题
    const title = getByText("Hatsune Miku");
    expect(title.tagName.toLowerCase()).toBe("h3");
  });
});
