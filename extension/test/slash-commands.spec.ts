/**
 * @file test/slash-commands.spec.ts
 * @description 斜杠指令拦截层回归测试
 *
 * 覆盖：/new 清 session、未知指令提示、非指令放行、/new 带参数
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 先 mock clearSessionData —— 让 /new 不真的打 deepseek
vi.mock("../src/service-worker/deepseek", () => ({
    clearSessionData: vi.fn(async () => undefined),
}));

import { tryHandleSlashCommand } from "../src/service-worker/background/slash-commands";
import { clearSessionData } from "../src/service-worker/deepseek";

describe("斜杠指令拦截", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.restoreAllMocks());

    it("非指令文本 → handled=false，放行", async () => {
        const result = await tryHandleSlashCommand("你好主人", "vivy");
        expect(result.handled).toBe(false);
        expect(clearSessionData).not.toHaveBeenCalled();
    });

    it("普通 slash 不是指令前缀 → handled=false", async () => {
        // 包含 / 但不是开头，或 / 后面不是字母开头的词
        const result = await tryHandleSlashCommand("路径是 /home/manteia", "vivy");
        expect(result.handled).toBe(false);
    });

    it("/new → 清 session + 返回确认消息", async () => {
        const result = await tryHandleSlashCommand("/new", "vivy");
        expect(result.handled).toBe(true);
        expect(result.reply).toContain("新对话开始");
        expect(clearSessionData).toHaveBeenCalledWith("vivy");
    });

    it("/new 带参数也照常清 session（参数当前被忽略）", async () => {
        const result = await tryHandleSlashCommand("/new 换个新主题", "vivy");
        expect(result.handled).toBe(true);
        expect(result.reply).toContain("新对话开始");
        expect(clearSessionData).toHaveBeenCalledWith("vivy");
    });

    it("末尾空格也能正确识别指令", async () => {
        const result = await tryHandleSlashCommand("  /new  ", "vivy");
        expect(result.handled).toBe(true);
        expect(clearSessionData).toHaveBeenCalledWith("vivy");
    });

    it("未知指令 → 返回未知提示，列出可用指令", async () => {
        const result = await tryHandleSlashCommand("/xyz", "vivy");
        expect(result.handled).toBe(true);
        expect(result.reply).toContain("未知指令");
        expect(result.reply).toContain("/new");
        expect(clearSessionData).not.toHaveBeenCalled();
    });

    it("带短横线/下划线的指令名也能解析（虽然当前没实现）", async () => {
        const result = await tryHandleSlashCommand("/help-me", "vivy");
        expect(result.handled).toBe(true);
        expect(result.reply).toContain("未知指令");
    });

    it("只有 / 或 / 后紧跟空格 → 不识别为指令", async () => {
        expect((await tryHandleSlashCommand("/", "vivy")).handled).toBe(false);
        expect((await tryHandleSlashCommand("/ ", "vivy")).handled).toBe(false);
        expect((await tryHandleSlashCommand("/123", "vivy")).handled).toBe(false);
    });
});
