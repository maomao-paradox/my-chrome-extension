/**
 * @file modules/sidebar/proactive-chat.ts
 * @description AI 主动对话的「提醒播放器」（content script 侧）
 *
 * 调度与消息生成已迁移到后台：
 *   service-worker/background/proactive-chat.ts（chrome.alarms）
 *
 * 本模块只做一件事：
 *   收到 background 的 PROACTIVE_AI_MESSAGE 后，用事件总线让 dock 滑出，
 *   2 秒后自动收回。复用的是鼠标悬浮那套纯 CSS transition
 *   （.dock.active 触发 .miku-trigger / .dock-cell 的 transform 动画）。
 *
 * @author Vivy
 * @date 2026-10-29
 */
import { bus } from "@/event/bus";

/** dock 弹出后保持显示的时长（毫秒） */
const REMINDER_DURATION_MS = 2_000;

/** 是否允许播放提醒 —— 由 sidebar 的 enable()/disable() 控制 */
let enabled = false;

/** 收起提醒的定时器 */
let reminderTimerId: ReturnType<typeof setTimeout> | null = null;

/**
 * 播放一次主动对话提醒：dock 滑出 → 2 秒后收回。
 * 未启用时静默忽略。
 */
export function playProactiveReminder(): void {
    if (!enabled) return;

    // 上一次提醒还没收起时，重置计时避免提前隐藏
    if (reminderTimerId !== null) {
        clearTimeout(reminderTimerId);
    }

    bus.emit("show");
    reminderTimerId = setTimeout(() => {
        reminderTimerId = null;
        bus.emit("hide");
    }, REMINDER_DURATION_MS);
}

/** 允许播放提醒（sidebar 启用时调用） */
export function enableProactiveReminder(): void {
    enabled = true;
}

/** 停止播放提醒并立即收回 dock（sidebar 禁用时调用） */
export function disableProactiveReminder(): void {
    enabled = false;

    if (reminderTimerId !== null) {
        clearTimeout(reminderTimerId);
        reminderTimerId = null;
        bus.emit("hide");
    }
}
