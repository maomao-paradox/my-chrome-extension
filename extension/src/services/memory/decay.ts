/**
 * @file services/memory/decay.ts
 * @description 艾宾浩斯遗忘曲线 —— 记忆保留率计算、遗忘状态判定、间隔重复强化
 *
 * 核心模型：
 *   保留率 R(t) = exp( -Δt / S )
 *     Δt = now - lastReactivatedAt（单位：小时）
 *     S  = 记忆稳定性（单位：小时），越大遗忘越慢
 *
 * 间隔重复（Spacing Effect）：
 *   每次记忆"真正被想起"（RAG 命中 / 用户再次提起）时
 *   S ← min(S × 2.2, MAX_STABILITY_HOURS)
 *   这样越是常用的记忆越难忘，符合人脑记忆规律
 *
 * 豁免通道：
 *   critical 重要度与 identity 类目的记忆永不彻底遗忘
 *   （角色设定/核心事实一旦忘掉，整个角色扮演就崩塌了）
 */

import type {
    MemoryCategory,
    MemoryDecayState,
    MemoryEntry,
    MemoryImportance,
} from "./types";

/** 1 小时对应的毫秒数 */
export const HOUR_MS = 3_600_000;

/** 各重要度的初始稳定性（单位：小时） */
export const INITIAL_STABILITY_HOURS: Record<MemoryImportance, number> = {
    critical: 8_760, // 365 天 —— 约等于永久
    high: 720, // 30 天
    medium: 168, // 7 天
    low: 24, // 1 天
};

/** 每次被想起时稳定性增长系数（间隔重复） */
export const REACTIVATION_GROWTH = 2.2;

/** 稳定性上限（小时）—— 约 2 年，避免无限膨胀 */
export const MAX_STABILITY_HOURS = 17_520;

/** active 阈值：R >= 0.55 视为清晰记忆 */
export const ACTIVE_THRESHOLD = 0.55;

/** forgotten 阈值：R < 0.2 视为已遗忘（不注入 prompt） */
export const FORGOTTEN_THRESHOLD = 0.2;

/** 豁免记忆的保留率下限 —— 保证永不落入 forgotten */
const EXEMPT_RETENTION_FLOOR = 0.6;

/** 永不彻底遗忘的记忆类目 */
const EXEMPT_CATEGORIES: ReadonlySet<MemoryCategory> = new Set<MemoryCategory>(["identity"]);

/** 计算保留率的计时起点 —— 优先 lastReactivatedAt，兼容旧数据 */
export function getDecayAnchor(entry: MemoryEntry): number {
    return entry.lastReactivatedAt ?? entry.lastAccessedAt ?? entry.createdAt;
}

/** 取得条目稳定性 S —— 缺省时按 importance 推导（兼容旧数据） */
export function getStability(entry: MemoryEntry): number {
    if (typeof entry.stability === "number" && entry.stability > 0) {
        return entry.stability;
    }
    return INITIAL_STABILITY_HOURS[entry.importance] ?? INITIAL_STABILITY_HOURS.medium;
}

/** 是否为豁免遗忘的记忆（critical 重要度 或 identity 类目） */
export function isExemptFromForgetting(entry: MemoryEntry): boolean {
    return entry.importance === "critical" || EXEMPT_CATEGORIES.has(entry.category);
}

/**
 * 计算记忆保留率 R(t) ∈ (0, 1]
 * —— 艾宾浩斯指数衰减：越久没被想起，保留率越低
 */
export function computeRetention(entry: MemoryEntry, now: number = Date.now()): number {
    const anchor = getDecayAnchor(entry);
    const elapsedHours = Math.max(0, (now - anchor) / HOUR_MS);
    const stability = getStability(entry);
    const retention = Math.exp(-elapsedHours / stability);

    // 豁免记忆保底，永不判为 forgotten
    return isExemptFromForgetting(entry)
        ? Math.max(retention, EXEMPT_RETENTION_FLOOR)
        : retention;
}

/** 由保留率判定遗忘状态 */
export function classifyDecayState(entry: MemoryEntry, now: number = Date.now()): MemoryDecayState {
    const retention = computeRetention(entry, now);
    if (retention >= ACTIVE_THRESHOLD) return "active";
    if (retention >= FORGOTTEN_THRESHOLD) return "fading";
    return "forgotten";
}

/**
 * 复活/强化一条记忆 —— 间隔重复的核心
 * 调用时机：RAG 命中、用户再次提起、或被实际注入 prompt
 *
 * @param growth 稳定性增长系数（默认 2.2；弱命中可传更小的值）
 */
export function reactivateEntry(
    entry: MemoryEntry,
    now: number = Date.now(),
    growth: number = REACTIVATION_GROWTH,
): MemoryEntry {
    const currentStability = getStability(entry);
    const nextStability = Math.min(currentStability * growth, MAX_STABILITY_HOURS);

    return {
        ...entry,
        stability: nextStability,
        lastReactivatedAt: now,
        lastAccessedAt: now,
        accessCount: entry.accessCount + 1,
        decayState: "active",
    };
}

/** 把旧数据补全为带遗忘字段的形状（不做写回，只用于计算） */
export function normalizeEntry(entry: MemoryEntry): MemoryEntry {
    const stability = getStability(entry);
    const anchor = getDecayAnchor(entry);
    return {
        ...entry,
        stability,
        lastReactivatedAt: entry.lastReactivatedAt ?? anchor,
    };
}

/**
 * 人类可读的剩余记忆时间描述 —— 用于 Options 页面展示
 */
export function describeRetention(entry: MemoryEntry, now: number = Date.now()): string {
    const state = classifyDecayState(entry, now);
    const retention = computeRetention(entry, now);
    const percent = Math.round(retention * 100);
    const label: Record<MemoryDecayState, string> = {
        active: "清晰",
        fading: "模糊",
        forgotten: "已遗忘",
    };
    return `${label[state]} ${percent}%`;
}
