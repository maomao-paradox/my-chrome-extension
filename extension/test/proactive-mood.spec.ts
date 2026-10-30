/**
 * @file test/proactive-mood.spec.ts
 * @description 主动对话心情系统的纯逻辑单测（不依赖 chrome API）
 */
import { describe, expect, it } from "vitest";
import {
    FRENZY_THRESHOLD,
    IGNORE_THRESHOLD,
    createDefaultMoodState,
    deriveMood,
    describeMood,
    detectHurt,
    extractUserText,
    getDateKey,
    normalizeMoodState,
} from "@/service-worker/background/proactive-mood";

describe("getDateKey", () => {
    it("补零到 YYYY-MM-DD", () => {
        expect(getDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
        expect(getDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
    });
});

describe("心情状态归一化", () => {
    it("新建状态默认为活跃开心", () => {
        expect(createDefaultMoodState("2026-10-30")).toEqual({
            date: "2026-10-30",
            ignoredStreak: 0,
            hurt: false,
            lastPushAt: 0,
        });
    });

    it("跨天整体重置（昨天的负面情绪不带入今天）", () => {
        const raw = {
            date: "2026-10-29",
            ignoredStreak: 5,
            hurt: true,
            lastPushAt: 123,
        };
        expect(normalizeMoodState(raw, "2026-10-30")).toEqual(
            createDefaultMoodState("2026-10-30"),
        );
    });

    it("非法字段收敛为安全值", () => {
        const raw = {
            date: "2026-10-30",
            ignoredStreak: -3,
            hurt: "x",
            lastPushAt: Number.NaN,
        };
        const state = normalizeMoodState(raw, "2026-10-30");
        expect(state.ignoredStreak).toBe(0);
        expect(state.hurt).toBe(false);
        expect(state.lastPushAt).toBe(0);
    });
});

describe("extractUserText", () => {
    it("从对话 chunk 中取出用户部分", () => {
        expect(extractUserText("用户：早上好\nAI：早上好喵")).toBe("早上好");
    });

    it("只有 AI 内容时返回空字符串", () => {
        expect(extractUserText("AI：早上好喵")).toBe("");
    });
});

describe("detectHurt", () => {
    it("命中批评/驱赶类表达", () => {
        expect(detectHurt(["闭嘴"])).toBe(true);
        expect(detectHurt(["你怎么这么笨"])).toBe(true);
        expect(detectHurt(["别烦我"])).toBe(true);
        expect(detectHurt(["滚远点"])).toBe(true);
    });

    it("不把「大笨蛋」这类爱称判为批评", () => {
        expect(detectHurt(["大笨蛋，过来让我摸摸"])).toBe(false);
        expect(detectHurt(["早上好喵"])).toBe(false);
    });
});

describe("deriveMood", () => {
    it(`连续 ${IGNORE_THRESHOLD} 次未获回复 → 生气`, () => {
        const state = {
            date: "d",
            ignoredStreak: IGNORE_THRESHOLD,
            hurt: false,
            lastPushAt: 0,
        };
        expect(deriveMood(state)).toBe("angry");
    });

    it("未达阈值 → 开心", () => {
        const state = {
            date: "d",
            ignoredStreak: IGNORE_THRESHOLD - 1,
            hurt: false,
            lastPushAt: 0,
        };
        expect(deriveMood(state)).toBe("happy");
    });

    it("被批评优先级高于被忽略 → 伤心", () => {
        const state = {
            date: "d",
            ignoredStreak: IGNORE_THRESHOLD,
            hurt: true,
            lastPushAt: 0,
        };
        expect(deriveMood(state)).toBe("sad");
    });

    it(`连续 ${FRENZY_THRESHOLD} 次未回复 → 发疯（优先级最高）`, () => {
        const state = {
            date: "d",
            ignoredStreak: FRENZY_THRESHOLD,
            hurt: true,
            lastPushAt: 0,
        };
        expect(deriveMood(state)).toBe("frenzy");
    });
});

describe("describeMood", () => {
    it("四种心情给出不同的语气指引", () => {
        expect(describeMood("happy", 0)).toContain("活泼");
        expect(describeMood("sad", 1)).toContain("低落");
        expect(describeMood("angry", IGNORE_THRESHOLD)).toContain("闹小脾气");
        expect(describeMood("frenzy", FRENZY_THRESHOLD)).toContain(
            "原样连续重复",
        );
    });
});
