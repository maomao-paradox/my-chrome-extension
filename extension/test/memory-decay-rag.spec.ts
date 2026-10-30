/**
 * @file test/memory-decay-rag.spec.ts
 * @description 遗忘曲线（艾宾浩斯）+ RAG（BM25）单元测试
 *
 * 覆盖：
 *   1. decay.ts —— 保留率计算、遗忘状态判定、间隔重复强化、豁免通道
 *   2. rag-retriever.ts —— 中英混合分词、BM25 排名、归一化
 *   3. MemoryService.retrieve —— 三态分流、遗忘排除、提起即复活
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMemoryStore, generateMemoryId } from "@/services/memory/memory-store";
import { MemoryService, getMemoryService } from "@/services/memory/memory-service";
import {
    ACTIVE_THRESHOLD,
    FORGOTTEN_THRESHOLD,
    HOUR_MS,
    INITIAL_STABILITY_HOURS,
    classifyDecayState,
    computeRetention,
    getStability,
    isExemptFromForgetting,
    normalizeEntry,
    reactivateEntry,
} from "@/services/memory/decay";
import { Bm25Index, tokenize } from "@/services/memory/rag-retriever";
import type { MemoryEntry, MemoryImportance } from "@/services/memory/types";

const TEST_ROLE = "decay_rag_role";

/** 构造一条测试记忆 */
function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
    const now = Date.now();
    return {
        id: generateMemoryId(),
        role: TEST_ROLE,
        category: "fact",
        content: "默认内容",
        importance: "medium" as MemoryImportance,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 1,
        ...overrides,
    };
}

let store: ReturnType<typeof getMemoryStore>;
let service: MemoryService;

beforeEach(() => {
    store = getMemoryStore();
    store.invalidateCache();
    service = getMemoryService();
});

afterEach(async () => {
    await store.clearRole(TEST_ROLE);
    store.invalidateCache();
});

// ======================================================================
// 1. 艾宾浩斯遗忘曲线
// ======================================================================
describe("decay —— 艾宾浩斯遗忘曲线", () => {
    it("刚创建的记忆保留率接近 1，处于 active 状态", () => {
        const entry = normalizeEntry(makeEntry());
        const now = Date.now();

        expect(computeRetention(entry, now)).toBeGreaterThan(0.99);
        expect(classifyDecayState(entry, now)).toBe("active");
    });

    it("保留率随时间指数衰减 —— 超过 4 个稳定性周期后判为 forgotten", () => {
        const now = Date.now();
        // low 档初始稳定性 24h，100 小时 = 4.17 个周期
        const entry = normalizeEntry(
            makeEntry({
                importance: "low",
                createdAt: now - 100 * HOUR_MS,
                lastAccessedAt: now - 100 * HOUR_MS,
                lastReactivatedAt: now - 100 * HOUR_MS,
            }),
        );

        const retention = computeRetention(entry, now);
        expect(retention).toBeLessThan(FORGOTTEN_THRESHOLD);
        expect(classifyDecayState(entry, now)).toBe("forgotten");
    });

    it("中间时段落在 fading 区间", () => {
        const now = Date.now();
        // medium S=168h，经过 168h 时 R = exp(-1) ≈ 0.368 ∈ [0.2, 0.55)
        const entry = normalizeEntry(
            makeEntry({
                importance: "medium",
                createdAt: now - 168 * HOUR_MS,
                lastAccessedAt: now - 168 * HOUR_MS,
                lastReactivatedAt: now - 168 * HOUR_MS,
            }),
        );

        expect(classifyDecayState(entry, now)).toBe("fading");
    });

    it("豁免通道：critical / identity 类目永不判为 forgotten", () => {
        const now = Date.now();
        const ancient = now - 100_000 * HOUR_MS;

        const criticalEntry = normalizeEntry(
            makeEntry({
                importance: "critical",
                createdAt: ancient,
                lastAccessedAt: ancient,
                lastReactivatedAt: ancient,
            }),
        );
        const identityEntry = normalizeEntry(
            makeEntry({
                category: "identity",
                importance: "low",
                createdAt: ancient,
                lastAccessedAt: ancient,
                lastReactivatedAt: ancient,
            }),
        );

        expect(isExemptFromForgetting(criticalEntry)).toBe(true);
        expect(isExemptFromForgetting(identityEntry)).toBe(true);
        expect(classifyDecayState(criticalEntry, now)).not.toBe("forgotten");
        expect(classifyDecayState(identityEntry, now)).not.toBe("forgotten");
        expect(computeRetention(criticalEntry, now)).toBeGreaterThanOrEqual(
            FORGOTTEN_THRESHOLD,
        );
    });

    it("reactivateEntry 按间隔重复增长稳定性，且不超过上限", () => {
        const now = Date.now();
        const entry = normalizeEntry(makeEntry({ importance: "medium" }));
        const before = getStability(entry);

        const once = reactivateEntry(entry, now);
        expect(getStability(once)).toBeCloseTo(before * 2.2, 5);
        expect(once.accessCount).toBe(entry.accessCount + 1);
        expect(once.lastReactivatedAt).toBe(now);

        // 反复强化应被上限截断（17520 小时）
        let current = once;
        for (let i = 0; i < 20; i += 1) {
            current = reactivateEntry(current, now);
        }
        expect(getStability(current)).toBeLessThanOrEqual(17_520);
    });

    it("旧数据（无 stability 字段）能按 importance 推导默认值", () => {
        const legacy = makeEntry({ importance: "high" });
        delete legacy.stability;

        expect(getStability(legacy)).toBe(INITIAL_STABILITY_HOURS.high);
        expect(normalizeEntry(legacy).lastReactivatedAt).toBe(legacy.lastAccessedAt);
    });
});

// ======================================================================
// 2. RAG 检索 —— BM25 + 中文 bigram
// ======================================================================
describe("rag-retriever —— BM25 + 中文 bigram", () => {
    it("中文按字符 bigram 切分，英文按整词切分", () => {
        const tokens = tokenize("我喜欢 TypeScript");

        expect(tokens).toContain("我喜");
        expect(tokens).toContain("喜欢");
        expect(tokens).toContain("typescript");
        // 单字符英文不产生 token
        expect(tokens).not.toContain("我");
    });

    it("标点与数字边界能正确断开", () => {
        const tokens = tokenize("记住：我喜欢猫！");
        expect(tokens).toContain("我喜");
        expect(tokens).toContain("喜欢");
        expect(tokens).toContain("欢猫");
        expect(tokens).not.toContain("：");
    });

    it("BM25 能把与查询最相关的文档排在第一位", () => {
        const docs: MemoryEntry[] = [
            makeEntry({ content: "用户喜欢用 TypeScript 写浏览器扩展" }),
            makeEntry({ content: "用户家里养了两只猫" }),
            makeEntry({ content: "用户常去的城市是杭州" }),
        ];
        const index = new Bm25Index();
        index.build(docs);

        const results = index.search("TypeScript 怎么写");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].id).toBe(docs[0].id);
        expect(results[0].normalized).toBeCloseTo(1, 5);
    });

    it("完全不相干的查询不返回任何结果", () => {
        const index = new Bm25Index();
        index.build([makeEntry({ content: "用户喜欢 TypeScript" })]);

        expect(index.search("量子力学")).toHaveLength(0);
    });

    it("空查询安全返回空数组", () => {
        const index = new Bm25Index();
        index.build([makeEntry({ content: "任意内容" })]);

        expect(index.search("   ")).toHaveLength(0);
    });
});

// ======================================================================
// 3. MemoryService.retrieve —— 三态分流与复活
// ======================================================================
describe("MemoryService.retrieve —— 遗忘分流", () => {
    it("已遗忘的低价值记忆不会出现在检索结果里", async () => {
        const now = Date.now();
        await store.saveEntries([
            makeEntry({
                content: "用户喜欢喝茶",
                importance: "low",
                createdAt: now - 100 * HOUR_MS,
                lastAccessedAt: now - 100 * HOUR_MS,
                lastReactivatedAt: now - 100 * HOUR_MS,
            }),
            makeEntry({
                content: "用户正在开发浏览器扩展",
                importance: "high",
            }),
        ]);

        const results = await service.retrieve(TEST_ROLE, "今天天气怎么样");
        const contents = results.map((e) => e.content);

        expect(contents).toContain("用户正在开发浏览器扩展");
        expect(contents).not.toContain("用户喜欢喝茶");
    });

    it("用户再次提起被遗忘的内容时，该记忆复活并重新进入上下文", async () => {
        const now = Date.now();
        const forgotten = makeEntry({
            content: "用户的生日是三月十七号",
            importance: "low",
            createdAt: now - 200 * HOUR_MS,
            lastAccessedAt: now - 200 * HOUR_MS,
            lastReactivatedAt: now - 200 * HOUR_MS,
        });
        await store.saveEntries([forgotten]);

        // 提起前：检索不到
        const before = await service.retrieve(TEST_ROLE, "随便聊聊");
        expect(before.map((e) => e.id)).not.toContain(forgotten.id);

        // 用户主动提起 → RAG 命中 → 复活
        const after = await service.retrieve(TEST_ROLE, "我生日是哪天来着");

        const revived = after.find((e) => e.id === forgotten.id);
        expect(revived).toBeTruthy();
        expect(revived!.decayState).toBe("active");
        // 稳定性被强化过
        expect(getStability(revived!)).toBeGreaterThan(
            INITIAL_STABILITY_HOURS.low,
        );
        expect(revived!.lastReactivatedAt).toBeGreaterThan(now - 1000);
    });

    it("critical 记忆即使很久没被提及也仍然注入", async () => {
        const now = Date.now();
        await store.saveEntries([
            makeEntry({
                content: "用户的身份是系统管理员",
                importance: "critical",
                createdAt: now - 50_000 * HOUR_MS,
                lastAccessedAt: now - 50_000 * HOUR_MS,
                lastReactivatedAt: now - 50_000 * HOUR_MS,
            }),
        ]);

        const results = await service.retrieve(TEST_ROLE, "今天吃什么");
        expect(results.map((e) => e.content)).toContain("用户的身份是系统管理员");
    });

    it("只有真正入选的记忆才会刷新时间戳（遗忘曲线不被检索污染）", async () => {
        const now = Date.now();
        // 168h 前的 medium 记忆 → R ≈ 0.368 处于 fading，且非高价值 → 会被跳过
        const oldAnchor = now - 168 * HOUR_MS;
        const stale = makeEntry({
            content: "用户提过一家拉面店",
            importance: "medium",
            createdAt: oldAnchor,
            lastAccessedAt: oldAnchor,
            lastReactivatedAt: oldAnchor,
        });
        await store.saveEntries([stale]);

        // 一次完全不相关的检索
        const results = await service.retrieve(TEST_ROLE, "今天天气怎么样");
        expect(results).toHaveLength(0);

        const [after] = await store.listEntries(TEST_ROLE);
        // 未入选 → 时间戳与访问次数保持不变
        expect(after.lastReactivatedAt).toBe(oldAnchor);
        expect(after.accessCount).toBe(1);
    });

    it("检索排序保持 RAG 相关性优先", async () => {
        await store.saveEntries([
            makeEntry({ content: "用户喜欢用 TypeScript 写代码", importance: "medium" }),
            makeEntry({ content: "用户喜欢在周末爬山", importance: "medium" }),
        ]);

        const results = await service.retrieve(TEST_ROLE, "TypeScript 泛型怎么用");
        expect(results[0].content).toContain("TypeScript");
    });

    it("结果条目带有可展示的遗忘状态", async () => {
        await service.addEntry({
            role: TEST_ROLE,
            content: "用户喜欢猫",
            importance: "high",
        });

        const results = await service.retrieve(TEST_ROLE, "猫");
        expect(results[0].decayState).toBeDefined();
        expect(["active", "fading", "forgotten"]).toContain(results[0].decayState);
    });
});

// ======================================================================
// 4. 上下文注入 —— 模糊记忆标注
// ======================================================================
describe("buildContext —— 遗忘状态影响注入内容", () => {
    it("fading 状态的高重要度记忆被注入并标注印象模糊", async () => {
        const now = Date.now();
        await store.saveEntries([
            makeEntry({
                content: "用户曾经提过想学 Rust",
                importance: "high",
                category: "preference",
                createdAt: now - 720 * HOUR_MS,
                lastAccessedAt: now - 720 * HOUR_MS,
                lastReactivatedAt: now - 720 * HOUR_MS,
            }),
        ]);

        const ctx = await service.buildContext(TEST_ROLE, "今天聊点什么");

        expect(ctx.assembledContext).toContain("想学 Rust");
        expect(ctx.assembledContext).toContain("印象模糊");
    });

    it("已遗忘的低价值记忆不出现在最终 prompt 上下文里", async () => {
        const now = Date.now();
        await store.saveEntries([
            makeEntry({
                content: "用户某天吃过一碗很咸的面",
                importance: "low",
                createdAt: now - 100 * HOUR_MS,
                lastAccessedAt: now - 100 * HOUR_MS,
                lastReactivatedAt: now - 100 * HOUR_MS,
            }),
        ]);

        const ctx = await service.buildContext(TEST_ROLE, "今天聊点什么");
        expect(ctx.assembledContext).not.toContain("很咸的面");
    });
});

// 常量自检 —— 保证阈值语义稳定
describe("decay 常量", () => {
    it("阈值关系符合 active > fading > forgotten 的语义", () => {
        expect(ACTIVE_THRESHOLD).toBeGreaterThan(FORGOTTEN_THRESHOLD);
        expect(ACTIVE_THRESHOLD).toBe(0.55);
        expect(FORGOTTEN_THRESHOLD).toBe(0.2);
    });
});

// ======================================================================
// 5. P3：手动唤醒（Memory Manager 的「想起来」按钮）
// ======================================================================
describe("MemoryService.recallEntry —— 手动唤醒记忆", () => {
    it("被唤醒的记忆回到 active 状态且稳定性增强", async () => {
        const now = Date.now();
        const ancient = now - 300 * HOUR_MS;
        const entry = makeEntry({
            content: "用户曾提过想学画水彩",
            importance: "low",
            createdAt: ancient,
            lastAccessedAt: ancient,
            lastReactivatedAt: ancient,
        });
        await store.saveEntries([entry]);

        // 唤醒前：已遗忘
        expect(classifyDecayState(normalizeEntry(entry), now)).toBe("forgotten");

        const revived = await service.recallEntry(entry.id);

        expect(revived).toBeTruthy();
        expect(revived!.id).toBe(entry.id);
        expect(revived!.decayState).toBe("active");
        expect(revived!.lastReactivatedAt).toBeGreaterThan(ancient);
        expect(getStability(revived!)).toBeGreaterThan(INITIAL_STABILITY_HOURS.low);
        expect(revived!.accessCount).toBe(entry.accessCount + 1);
    });

    it("唤醒后的记忆能立刻出现在检索结果中", async () => {
        const now = Date.now();
        const ancient = now - 300 * HOUR_MS;
        const entry = makeEntry({
            content: "用户提过想学画水彩",
            importance: "low",
            createdAt: ancient,
            lastAccessedAt: ancient,
            lastReactivatedAt: ancient,
        });
        await store.saveEntries([entry]);

        // 唤醒前检索不到（无 RAG 命中 + 已遗忘）
        expect(await service.retrieve(TEST_ROLE, "今天天气怎么样")).toHaveLength(0);

        await service.recallEntry(entry.id);

        const results = await service.retrieve(TEST_ROLE, "今天天气怎么样");
        expect(results.map((e) => e.id)).toContain(entry.id);
    });

    it("记忆会被持久化写回（重新读取仍是唤醒后的状态）", async () => {
        const ancient = Date.now() - 300 * HOUR_MS;
        const entry = makeEntry({
            importance: "low",
            createdAt: ancient,
            lastAccessedAt: ancient,
            lastReactivatedAt: ancient,
        });
        await store.saveEntries([entry]);

        await service.recallEntry(entry.id);

        // 绕过内存缓存，强制从 storage 重新读取
        store.invalidateCache();
        const [persisted] = await store.listEntries(TEST_ROLE);

        expect(persisted.lastReactivatedAt).toBeGreaterThan(ancient);
        expect(getStability(persisted)).toBeGreaterThan(INITIAL_STABILITY_HOURS.low);
    });

    it("不存在的 ID 返回 null", async () => {
        expect(await service.recallEntry("no-such-entry-id")).toBeNull();
    });
});
