/**
 * @file test/react-sidebar-proactive-chat.spec.ts
 * @description 侧边栏主动对话「提醒播放器」单元测试
 *
 * 调度与消息生成已经迁移到 service-worker/background/proactive-chat.ts，
 * 侧边栏这边只负责收到消息后让 dock 滑出、2 秒后收回，
 * 因此这里只覆盖提醒播放器的启用 / 播放 / 收起行为。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bus } from "@/event/bus";
import {
    disableProactiveReminder,
    enableProactiveReminder,
    playProactiveReminder,
} from "@/modules/sidebar/proactive-chat";

/** 记录 dock 的 show / hide 事件次数 */
function trackDockEvents() {
    const events: string[] = [];
    bus.on("show", () => events.push("show"));
    bus.on("hide", () => events.push("hide"));
    return events;
}

beforeEach(() => {
    vi.useFakeTimers();
    disableProactiveReminder();
    bus.all.clear();
});

afterEach(() => {
    disableProactiveReminder();
    bus.all.clear();
    vi.useRealTimers();
});

describe("sidebar proactive reminder", () => {
    it("未启用时不播放提醒", () => {
        const events = trackDockEvents();

        playProactiveReminder();

        expect(events).toEqual([]);
    });

    it("启用后滑出 dock，并在 2 秒后自动收回", () => {
        const events = trackDockEvents();
        enableProactiveReminder();

        playProactiveReminder();
        expect(events).toEqual(["show"]);

        vi.advanceTimersByTime(1999);
        expect(events).toEqual(["show"]);

        vi.advanceTimersByTime(1);
        expect(events).toEqual(["show", "hide"]);
    });

    it("连续播放会重置计时，只收起一次", () => {
        const events = trackDockEvents();
        enableProactiveReminder();

        playProactiveReminder();
        vi.advanceTimersByTime(1500);

        // 第二次播放：计时重置，不会在半路提前隐藏
        playProactiveReminder();
        vi.advanceTimersByTime(1500);
        expect(events).toEqual(["show", "show"]);

        vi.advanceTimersByTime(500);
        expect(events).toEqual(["show", "show", "hide"]);
    });

    it("禁用时立即收回 dock 并取消计时", () => {
        const events = trackDockEvents();
        enableProactiveReminder();

        playProactiveReminder();
        disableProactiveReminder();
        expect(events).toEqual(["show", "hide"]);

        // 原计时器不会再次触发多余的 hide
        vi.advanceTimersByTime(5000);
        expect(events).toEqual(["show", "hide"]);
    });

    it("禁用后不再播放提醒", () => {
        const events = trackDockEvents();
        enableProactiveReminder();
        disableProactiveReminder();

        playProactiveReminder();

        expect(events).toEqual([]);
    });
});
