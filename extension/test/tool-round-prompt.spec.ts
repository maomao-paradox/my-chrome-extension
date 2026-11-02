/**
 * @file test/tool-round-prompt.spec.ts
 * @description 工具调用轮衔接逻辑的单元测试
 *
 * 覆盖点：
 *   1. buildToolResultPrompt 把工具名 / 参数 / 结果都带上
 *   2. 工具结果里的异常信封不会被吞掉
 *   3. buildToolRoundMessages 在没有历史时用原始 prompt 起头
 *   4. 有历史时复制而不是原地修改
 *   5. 本轮有文本 → 插入 assistant 消息；无文本 → 只保留 user 消息
 */
import { describe, expect, it } from "vitest";
import type { ChatHistoryMessage } from "@/types/web-mcp";
import {
    MAX_TOOL_ROUNDS,
    buildToolResultPrompt,
    buildToolRoundMessages,
    type ToolExecutionResult,
} from "@/service-worker/background/tool-round-prompt";

/** 一个典型的 JSON-RPC 成功结果 */
function okResult(): ToolExecutionResult {
    return {
        name: "set_next_proactive_interval",
        args: { minutes: 5 },
        response: {
            jsonrpc: "2.0",
            id: "mcp-1",
            result: { ok: true, minutes: 5 },
        },
    };
}

describe("buildToolResultPrompt", () => {
    it("把工具名、参数和执行结果都写进提示词", () => {
        const prompt = buildToolResultPrompt([okResult()]);

        expect(prompt).toContain("[TOOL RESULTS]");
        expect(prompt).toContain("set_next_proactive_interval");
        expect(prompt).toContain('{"minutes":5}');
        expect(prompt).toContain("true");
    });

    it("保留 JSON-RPC 错误信封，模型能看到工具失败原因", () => {
        const prompt = buildToolResultPrompt([
            {
                name: "set_next_proactive_interval",
                args: { minutes: -1 },
                response: {
                    jsonrpc: "2.0",
                    id: "mcp-2",
                    error: { code: -32602, message: "参数不能为负数" },
                },
            },
        ]);

        expect(prompt).toContain("-32602");
        expect(prompt).toContain("参数不能为负数");
    });

    it("明确要求模型自己决定下一步", () => {
        const prompt = buildToolResultPrompt([okResult()]);

        expect(prompt).toContain("还需要调用工具");
        expect(prompt).toContain("直接用自然语言回复主人");
    });

    it("多轮工具结果按顺序逐行列出", () => {
        const prompt = buildToolResultPrompt([
            okResult(),
            {
                name: "another_tool",
                args: {},
                response: { ok: true },
            },
        ]);

        const lines = prompt.split("\n").filter((line) => line.startsWith("- "));
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain("set_next_proactive_interval");
        expect(lines[1]).toContain("another_tool");
    });
});

describe("buildToolRoundMessages", () => {
    it("没有历史消息时用原始 prompt 起头", () => {
        const messages = buildToolRoundMessages(
            undefined,
            "帮我设置下次间隔",
            "",
            "[TOOL RESULTS] ok",
        );

        expect(messages).toEqual([
            { role: "user", content: "帮我设置下次间隔" },
            { role: "user", content: "[TOOL RESULTS] ok" },
        ]);
    });

    it("本轮有文本时插入 assistant 消息", () => {
        const messages = buildToolRoundMessages(
            undefined,
            "帮我设置下次间隔",
            "好呀，我这就调一下喵",
            "[TOOL RESULTS] ok",
        );

        expect(messages.map((message) => message.role)).toEqual([
            "user",
            "assistant",
            "user",
        ]);
        expect(messages[1].content).toBe("好呀，我这就调一下喵");
    });

    it("空白文本不会插入空的 assistant 消息", () => {
        const messages = buildToolRoundMessages(
            undefined,
            "帮我设置下次间隔",
            "   ",
            "[TOOL RESULTS] ok",
        );

        expect(messages).toHaveLength(2);
    });

    it("基于已有历史追加，且不修改原数组", () => {
        const base: ChatHistoryMessage[] = [
            { role: "user", content: "第一轮" },
            { role: "assistant", content: "第一轮回复" },
        ];
        const messages = buildToolRoundMessages(
            base,
            "第一轮",
            "第二轮回复",
            "[TOOL RESULTS] ok",
        );

        expect(base).toHaveLength(2);
        expect(messages).toHaveLength(4);
        expect(messages[2]).toEqual({
            role: "assistant",
            content: "第二轮回复",
        });
    });
});

describe("MAX_TOOL_ROUNDS", () => {
    it("是一个正数上限，避免无限自调用", () => {
        expect(MAX_TOOL_ROUNDS).toBeGreaterThan(0);
    });
});
