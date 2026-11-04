/**
 * @file test/stream-manager-chain.spec.ts
 * @description StreamManager.tryContinuousReplyChain 回归测试
 *
 * 背景 Bug：AI 回复先带工具调用（首轮文本 + <webmcp_tool_calls>），
 * 再触发连续回复时，记忆观察只入库了「最后一轮 + 续轮」，
 * 工具轮之前的首条回复被丢弃。修复后链式函数接受 memorySeedContent
 * （全部轮次的干净文本拼接）作为观察基底。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 只替换 AI 生成，概率/提示词保持真实实现
vi.mock("../src/service-worker/background/chat-chain", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../src/service-worker/background/chat-chain")>();
    return {
        ...actual,
        generateFollowupReply: vi.fn(async () => "续轮补充"),
    };
});

import { StreamManager } from "../src/service-worker/background/stream-manager";
import { generateFollowupReply } from "../src/service-worker/background/chat-chain";

type ChainFn = (
    port: { postMessage: (msg: unknown) => void },
    messageId: string,
    role: string,
    provider: string | undefined,
    modelId: string | undefined,
    apiKey: string | undefined,
    apiBaseUrl: string | undefined,
    systemPrompt: string | undefined,
    userPrompt: string,
    mood: "happy" | "sad" | "angry" | "frenzy",
    firstReplyContent: string,
    memorySeedContent?: string,
) => Promise<string>;

const callChain = (manager: StreamManager): ChainFn =>
    (manager as unknown as { tryContinuousReplyChain: ChainFn })
        .tryContinuousReplyChain.bind(manager);

describe("tryContinuousReplyChain —— 记忆观察基底", () => {
    const port = { postMessage: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("提供 memorySeed 时，无续轮也返回完整多轮文本（首轮不丢失）", async () => {
        // frenzy 基础概率 0.05 → computeNextProbability 返回 0，必定不续轮
        const chain = callChain(new StreamManager());
        const seed = "哼，主人明明看见薇薇都把脑袋凑过去了\n(脑袋又往主人手心里蹭了蹭)";
        const result = await chain(
            port,
            "msg-1",
            "vivy",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            "还在生气吗喵",
            "frenzy",
            "(脑袋又往主人手心里蹭了蹭)",
            seed,
        );
        expect(result).toBe(seed);
        expect(generateFollowupReply).not.toHaveBeenCalled();
    });

    it("提供 memorySeed 时，续轮内容拼在完整文本之后", async () => {
        // happy 概率 0.4，Math.random=0 → 必定触发全部续轮
        vi.spyOn(Math, "random").mockReturnValue(0);
        const chain = callChain(new StreamManager());
        const seed = "首轮回复（含工具调用）\n工具轮后的回复";
        const result = await chain(
            port,
            "msg-2",
            "vivy",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            "还在生气吗喵",
            "happy",
            "工具轮后的回复",
            seed,
        );
        expect(result.startsWith(seed)).toBe(true);
        expect(result).toContain("续轮补充");
        expect(generateFollowupReply).toHaveBeenCalled();
    });

    it("缺省 memorySeed 时保持旧行为（以首条回复为基底）", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const chain = callChain(new StreamManager());
        const result = await chain(
            port,
            "msg-3",
            "vivy",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            "在吗",
            "happy",
            "唯一回复",
        );
        expect(result.startsWith("唯一回复")).toBe(true);
    });
});
