/**
 * @file test/proactive-chat-background.spec.ts
 * @description AI 主动对话后台调度层的单元测试
 *
 * 覆盖点：
 *   1. 初始化时的 alarm 自愈创建（含 0.5~10 分钟区间断言）
 *   2. alarm 已存在时不重复创建
 *   3. 触发后生成消息并写入记忆（字段与内容前缀）
 *   4. 无论成功失败都续排
 *   5. AI 失败降级为本地模板
 *   6. 无活跃标签页 / 发送失败时不崩溃
 *   7. 超长文本按 120 字裁剪
 *   8. AI 配置不可用时直接降级
 *   9. 重复初始化只注册一次监听
 *
 * 说明：被测模块运行在 Service Worker 环境，setTimeout 不可靠，
 *      因此用 chrome.alarms 做排期；测试通过覆写 chrome.alarms 模拟触发。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 所有外部依赖的 mock 句柄（hoisted 保证 vi.mock 工厂可访问） */
const mocks = vi.hoisted(() => ({
    listRoles: vi.fn(),
    getIdentity: vi.fn(),
    addEntry: vi.fn(),
    listByCategory: vi.fn(),
    buildContext: vi.fn(),
    loadAIConfig: vi.fn(),
    completeChatFlow: vi.fn(),
    alarmsCreate: vi.fn(),
    alarmsGet: vi.fn(),
    alarmListeners: [] as Array<(alarm: { name: string }) => void>,
    tabsQuery: vi.fn(),
    tabsSendMessage: vi.fn(),
}));

/* ---------- 依赖替身 ---------- */

vi.mock("@/services/memory", () => ({
    getMemoryService: () => ({
        listRoles: mocks.listRoles,
        getIdentity: mocks.getIdentity,
        addEntry: mocks.addEntry,
        listByCategory: mocks.listByCategory,
        buildContext: mocks.buildContext,
    }),
}));

vi.mock("@/service-worker/chrome-api/ai-config", () => ({
    loadAIConfig: mocks.loadAIConfig,
}));

vi.mock("@/service-worker/deepseek", () => ({
    completeChatFlow: mocks.completeChatFlow,
}));

/** 每次重新加载被测模块，重置模块级状态（监听注册标记等） */
async function loadModule() {
    vi.resetModules();
    return import("@/service-worker/background/proactive-chat");
}

/** 默认 AI 配置：具备可用 apiKey，走真实生成分支 */
function defaultAIConfig() {
    return {
        provider: "deepseek",
        modelId: "deepseek-chat",
        apiKey: "sk-test",
        apiBaseUrl: "",
        systemPrompt: "",
        deepseekAuthToken: "",
        deepseekCookies: "",
    };
}

/** 固定「现在」为工作时段内的一个时刻，避免用例受真实时钟影响 */
const FIXED_NOW = new Date("2026-10-30T10:00:00");

/** 本地 storage 状态 —— 供下班标记等读写 */
let storageState: Record<string, unknown> = {};

/** 推进一轮定时器并冲干净微任务（配合 fake timers 使用） */
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
    // 调度层按 9:00-19:00 判断是否请求，必须固定时间
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);
    storageState = {};

    mocks.alarmListeners.length = 0;

    mocks.alarmsCreate.mockReset();
    mocks.alarmsGet.mockReset().mockResolvedValue(undefined);
    mocks.tabsQuery.mockReset().mockResolvedValue([{ id: 1 }]);
    mocks.tabsSendMessage.mockReset().mockResolvedValue(undefined);

    mocks.listRoles.mockReset().mockResolvedValue(["miku"]);
    mocks.listByCategory.mockReset().mockResolvedValue([]);
    mocks.getIdentity.mockReset().mockResolvedValue(null);
    mocks.buildContext.mockReset().mockResolvedValue({
        entries: [],
        assembledContext: "",
    });
    mocks.addEntry.mockReset().mockResolvedValue(undefined);
    mocks.loadAIConfig.mockReset().mockResolvedValue(defaultAIConfig());

    // 默认 AI 正常返回：流式推一段文本后完成
    mocks.completeChatFlow.mockReset().mockImplementation(
        async (
            _prompt: string,
            _role: string,
            callbacks?: {
                onData?: (data: string) => void;
                onComplete?: () => void;
            },
        ) => {
            callbacks?.onData?.("早安呀");
            callbacks?.onComplete?.();
            return null;
        },
    );

    // 覆写 chrome.alarms / chrome.tabs 为可观测的 mock
    (globalThis as any).chrome.alarms = {
        create: mocks.alarmsCreate,
        get: mocks.alarmsGet,
        onAlarm: {
            addListener: (fn: (alarm: { name: string }) => void) =>
                mocks.alarmListeners.push(fn),
            removeListener: () => {},
        },
    };
    (globalThis as any).chrome.tabs = {
        query: mocks.tabsQuery,
        sendMessage: mocks.tabsSendMessage,
    };
    // 下班标记等依赖 storage.local，用内存 Map 模拟
    (globalThis as any).chrome.storage = {
        local: {
            get: vi.fn(async (key: string) =>
                key in storageState ? { [key]: storageState[key] } : {},
            ),
            set: vi.fn(async (items: Record<string, unknown>) => {
                Object.assign(storageState, items);
            }),
            remove: vi.fn(async () => {}),
        },
        onChanged: { addListener: () => {}, removeListener: () => {} },
    };
});

afterEach(() => {
    vi.useRealTimers();
});

describe("proactive-chat（background 调度层）", () => {
    it("初始化时若 alarm 不存在，会创建一个 0.5~10 分钟的随机排期", async () => {
        const mod = await loadModule();
        mod.initProactiveChat();

        await vi.waitFor(() =>
            expect(mocks.alarmsCreate).toHaveBeenCalledTimes(1),
        );

        const [name, info] = mocks.alarmsCreate.mock.calls[0];
        expect(name).toBe(mod.PROACTIVE_ALARM_NAME);
        // chrome.alarms 硬下限为 30 秒，因此下界是 0.5 分钟
        expect(info.delayInMinutes).toBeGreaterThanOrEqual(0.5);
        expect(info.delayInMinutes).toBeLessThanOrEqual(10);
    });

    it("alarm 已存在时不会重复创建", async () => {
        mocks.alarmsGet.mockResolvedValue({ name: "ai-proactive-chat" });

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        expect(mocks.alarmsGet).toHaveBeenCalledTimes(1);
        expect(mocks.alarmsCreate).not.toHaveBeenCalled();
    });

    it("accepted: alarm 触发后生成消息并写入记忆", async () => {
        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        const listener = mocks.alarmListeners[0];
        expect(listener).toBeTypeOf("function");
        listener({ name: mod.PROACTIVE_ALARM_NAME });

        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        const entry = mocks.addEntry.mock.calls[0][0];
        expect(entry).toMatchObject({
            role: "miku",
            content: "AI：早安呀",
            category: "conversation",
            importance: "low",
            source: "ai-proactive",
        });
    });

    it("角色列表只有功能角色时，也绝不会写入 textarea_ai_autofill", async () => {
        mocks.listRoles.mockResolvedValue(["textarea_ai_autofill"]);

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        const entry = mocks.addEntry.mock.calls[0][0];
        expect(entry.role).toBe("vivy_catgirl");
        // 绝不能复用功能角色的身份提示词（会带上 [SYSTEM PROTOCOL]）
        expect(mocks.getIdentity).not.toHaveBeenCalledWith(
            "textarea_ai_autofill",
        );
        expect(mocks.getIdentity).toHaveBeenCalledWith("vivy_catgirl");
        // 记忆检索也必须指向干净角色
        expect(mocks.buildContext).toHaveBeenCalledWith(
            "vivy_catgirl",
            expect.any(String),
        );
    });

    it("角色列表混合时优先聊天窗默认角色，并跳过所有功能角色", async () => {
        mocks.listRoles.mockResolvedValue([
            "textarea_ai_autofill",
            "table_data_generator",
            "miku",
            "vivy_catgirl",
        ]);

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        expect(mocks.addEntry.mock.calls[0][0].role).toBe(
            "vivy_catgirl",
        );
    });

    it("每次触发后都会重新排期（即使 AI 失败）", async () => {
        mocks.completeChatFlow.mockImplementation(
            async (
                _prompt: string,
                _role: string,
                callbacks?: { onError?: (error: unknown) => void },
            ) => {
                callbacks?.onError?.(new Error("boom"));
                return null;
            },
        );

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        const before = mocks.alarmsCreate.mock.calls.length;
        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });

        await vi.waitFor(() =>
            expect(mocks.alarmsCreate.mock.calls.length).toBe(before + 1),
        );
    });

    it("AI 生成失败时降级为本地模板问候，流程不中断", async () => {
        mocks.completeChatFlow.mockImplementation(
            async (
                _prompt: string,
                _role: string,
                callbacks?: { onError?: (error: unknown) => void },
            ) => {
                callbacks?.onError?.(new Error("network down"));
                return null;
            },
        );

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        const entry = mocks.addEntry.mock.calls[0][0];
        expect(entry.content.startsWith("AI：")).toBe(true);
        expect(entry.content).not.toContain("network down");
        // 「AI：」占 3 个字符，模板文本至少还有内容
        expect(entry.content.length).toBeGreaterThan(3);
    });

    it("没有活跃标签页时不报错，且继续排期", async () => {
        mocks.tabsQuery.mockResolvedValue([]);

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        const before = mocks.alarmsCreate.mock.calls.length;
        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });

        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));
        await vi.waitFor(() =>
            expect(mocks.alarmsCreate.mock.calls.length).toBe(before + 1),
        );
        expect(mocks.tabsSendMessage).not.toHaveBeenCalled();
    });

    it("向活跃标签页发送提醒失败时不崩溃", async () => {
        mocks.tabsSendMessage.mockRejectedValue(
            new Error("Could not establish connection"),
        );

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        const before = mocks.alarmsCreate.mock.calls.length;
        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });

        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));
        await vi.waitFor(() =>
            expect(mocks.alarmsCreate.mock.calls.length).toBe(before + 1),
        );
    });

    it("超过 120 字的文本会被裁剪", async () => {
        const longText = "喵".repeat(200);
        mocks.completeChatFlow.mockImplementation(
            async (
                _prompt: string,
                _role: string,
                callbacks?: {
                    onData?: (data: string) => void;
                    onComplete?: () => void;
                },
            ) => {
                callbacks?.onData?.(longText);
                callbacks?.onComplete?.();
                return null;
            },
        );

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        const entry = mocks.addEntry.mock.calls[0][0];
        expect(entry.content).toBe(`AI：${"喵".repeat(120)}`);
    });

    it("AI 配置不可用时直接降级，不会发起请求", async () => {
        mocks.loadAIConfig.mockResolvedValue(null);

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        expect(mocks.completeChatFlow).not.toHaveBeenCalled();
        expect(mocks.addEntry.mock.calls[0][0].content.startsWith("AI：")).toBe(
            true,
        );
    });

    it("重复初始化只注册一次 alarm 监听", async () => {
        const mod = await loadModule();
        mod.initProactiveChat();
        mod.initProactiveChat();
        await flush();

        expect(mocks.alarmListeners).toHaveLength(1);
    });
});

describe("作息调度（9:00-19:00）", () => {
    const at = (iso: string) => new Date(iso);

    /** 取最后一次 alarm 排期参数 */
    const lastAlarmArgs = () => {
        const calls = mocks.alarmsCreate.mock.calls;
        return calls[calls.length - 1][1] as {
            delayInMinutes?: number;
            when?: number;
        };
    };

    it("上班前不请求，并排到当天上班时间", async () => {
        vi.setSystemTime(at("2026-10-30T08:30:00"));

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await flush();

        expect(mocks.addEntry).not.toHaveBeenCalled();
        expect(mocks.completeChatFlow).not.toHaveBeenCalled();
        expect(lastAlarmArgs().when).toBe(at("2026-10-30T09:00:00").getTime());
    });

    it("下班后不请求，并排到次日上班时间", async () => {
        vi.setSystemTime(at("2026-10-30T20:00:00"));

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await flush();

        expect(mocks.addEntry).not.toHaveBeenCalled();
        expect(lastAlarmArgs().when).toBe(at("2026-10-31T09:00:00").getTime());
    });

    it("下班收尾窗口内发送当天最后一条晚安，打标记并排到次日", async () => {
        vi.setSystemTime(at("2026-10-30T18:50:00"));

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        // 提示词切换为收尾模式
        expect(mocks.completeChatFlow.mock.calls[0][7]).toContain(
            "今天最后一次",
        );
        // 当天标记已落库
        expect(storageState["proactive_chat_off_duty_date"]).toBe("2026-10-30");
        // 排期对齐到次日上班时间
        await vi.waitFor(() =>
            expect(lastAlarmArgs().when).toBe(
                at("2026-10-31T09:00:00").getTime(),
            ),
        );
    });

    it("当天收尾后再次触发不会请求", async () => {
        vi.setSystemTime(at("2026-10-30T18:50:00"));

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        // 同一天再次触发（仍在工作时段内）
        vi.setSystemTime(at("2026-10-30T18:56:00"));
        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await flush();

        expect(mocks.addEntry).toHaveBeenCalledTimes(1);
        expect(mocks.completeChatFlow).toHaveBeenCalledTimes(1);
    });
});

describe("心情与时间上下文", () => {
    /** 构造一条今天的用户对话记忆 */
    const todayTurn = (content: string) => ({
        id: "turn-1",
        role: "miku",
        category: "conversation",
        content,
        importance: "medium",
        source: "ai-conversation",
        createdAt: FIXED_NOW.getTime(),
        lastAccessedAt: FIXED_NOW.getTime(),
        accessCount: 1,
    });

    it("时间上下文只出现一次，且包含日期与星期", async () => {
        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        const call = mocks.completeChatFlow.mock.calls[0];
        // 第 1 个参数是 prompt，不应再携带时间
        expect(call[0]).not.toContain("现在是");

        // 第 8 个参数是 systemPrompt，时间只在这里出现一次
        const systemPrompt = call[7] as string;
        expect(systemPrompt).toContain("2026年10月30日");
        expect(systemPrompt).toContain("星期");
        expect(systemPrompt.match(/现在是/g)).toHaveLength(1);
    });

    it("当天被严厉批评时注入伤心心情", async () => {
        mocks.listByCategory.mockResolvedValue([
            todayTurn("用户：闭嘴，别烦我\nAI：……"),
        ]);

        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
        await vi.waitFor(() => expect(mocks.addEntry).toHaveBeenCalledTimes(1));

        expect(mocks.completeChatFlow.mock.calls[0][7]).toContain("低落");
    });

    it("连续未回复：3 条闹脾气，6 条发疯", async () => {
        const mod = await loadModule();
        mod.initProactiveChat();
        await flush();

        for (let i = 0; i < 6; i += 1) {
            mocks.alarmListeners[0]({ name: mod.PROACTIVE_ALARM_NAME });
            await vi.waitFor(() =>
                expect(mocks.addEntry).toHaveBeenCalledTimes(i + 1),
            );
        }

        expect(mocks.completeChatFlow.mock.calls[2][7]).toContain("闹小脾气");
        expect(mocks.completeChatFlow.mock.calls[5][7]).toContain(
            "原样连续重复",
        );
    });
});

describe("作息判断纯函数", () => {
    const at = (iso: string) => new Date(iso);

    it("isWorkTime 正确划分 9:00-19:00", async () => {
        const mod = await loadModule();
        expect(mod.isWorkTime(at("2026-10-30T08:59:00"))).toBe(false);
        expect(mod.isWorkTime(at("2026-10-30T09:00:00"))).toBe(true);
        expect(mod.isWorkTime(at("2026-10-30T18:59:00"))).toBe(true);
        expect(mod.isWorkTime(at("2026-10-30T19:00:00"))).toBe(false);
    });

    it("isOffDutyWindow 只在最后 15 分钟内为真", async () => {
        const mod = await loadModule();
        expect(mod.isOffDutyWindow(at("2026-10-30T18:44:00"))).toBe(false);
        expect(mod.isOffDutyWindow(at("2026-10-30T18:45:00"))).toBe(true);
        expect(mod.isOffDutyWindow(at("2026-10-30T19:00:00"))).toBe(false);
    });

    it("getNextWorkStart 正确顺延到下一次上班", async () => {
        const mod = await loadModule();
        expect(mod.getNextWorkStart(at("2026-10-30T08:00:00")).getTime()).toBe(
            at("2026-10-30T09:00:00").getTime(),
        );
        expect(mod.getNextWorkStart(at("2026-10-30T20:00:00")).getTime()).toBe(
            at("2026-10-31T09:00:00").getTime(),
        );
    });
});
