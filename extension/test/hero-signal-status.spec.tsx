/**
 * @file test/hero-signal-status.spec.tsx
 * @description options 首页信号牌彩蛋 —— 后端探针状态联动的单元测试
 *
 * 覆盖：
 *   1. 文案映射纯函数（在线 / 离线）
 *   2. 后端探针通过时渲染 SIGNAL ACQUIRED
 *   3. 后端探针失败时渲染 SIGNAL LOST
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/* 探针 mock 必须在模块导入前声明（vi.mock 会被提升） */
const { probeMock } = vi.hoisted(() => ({ probeMock: vi.fn() }));

vi.mock("@/services/memory/backend-client", () => ({
    getMemoryBackendClient: () => ({ isAvailable: probeMock }),
}));

import HeroSection, { resolveSignalText } from "@/pages/options/views/HeroSection";

/** happy-dom 未实现 ResizeObserver，这里补一个最小空实现 */
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

afterEach(() => {
    cleanup();
    probeMock.mockReset();
});

describe("resolveSignalText —— 信号牌文案映射", () => {
    it("后端在线返回 SIGNAL ACQUIRED", () => {
        expect(resolveSignalText(true)).toBe("SIGNAL ACQUIRED");
    });

    it("后端离线返回 SIGNAL LOST", () => {
        expect(resolveSignalText(false)).toBe("SIGNAL LOST");
    });
});

describe("HeroSection —— 后端信号牌", () => {
    it("探针通过时展示 SIGNAL ACQUIRED", async () => {
        probeMock.mockResolvedValue(true);

        render(<HeroSection />);

        await waitFor(() => {
            expect(screen.getByText("SIGNAL ACQUIRED")).toBeTruthy();
        });
    });

    it("探针失败时展示 SIGNAL LOST", async () => {
        probeMock.mockResolvedValue(false);

        render(<HeroSection />);

        await waitFor(() => {
            expect(screen.getByText("SIGNAL LOST")).toBeTruthy();
        });
    });
});
