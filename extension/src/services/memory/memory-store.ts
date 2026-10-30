/**
 * @file services/memory/memory-store.ts
 * @description 记忆系统持久化层 —— 基于 chrome.storage.local 实现 MemoryStorageAdapter
 *
 * 存储 key 约定：
 *   ai_memory::entries::${role}       → MemoryEntry[] (所有长期记忆条目)
 *   ai_memory::identity::${role}      → IdentityMemory (角色身份)
 *   ai_memory::shortterm::${role}     → ShortTermSnapshot (短期摘要)
 *
 * 使用 chrome.storage.local 是因为：
 *   - MV3 service worker 环境原生可用
 *   - 配额 5MB 足够存储数千条记忆
 *   - 天然跨 session 持久化
 */

import type {
    IdentityMemory,
    MemoryCategory,
    MemoryEntry,
    MemoryStorageAdapter,
    ShortTermSnapshot,
} from "./types";
import { buildStorageKey } from "./types";

/**
 * 判断当前运行环境是否有 chrome.storage
 */
const hasChromeStorage = (): boolean =>
    typeof chrome !== "undefined" && !!chrome.storage?.local;

/**
 * 生成唯一记忆 ID —— 使用时间戳 + 随机片段
 */
export function generateMemoryId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return `${ts}-${rand}`;
}

/**
 * MemoryStore —— chrome.storage.local 驱动的持久化实现
 *
 * 所有方法都是异步的，内部带 try-catch，失败时 console.error 并返回安全默认值。
 * 这样上层调用方不会因为 storage 异常而崩溃。
 */
export class MemoryStore implements MemoryStorageAdapter {
    /** 内存缓存 —— 减少 chrome.storage 调用次数 */
    private readonly entryCache = new Map<string, MemoryEntry[]>();
    private readonly identityCache = new Map<string, IdentityMemory>();
    private readonly shortTermCache = new Map<string, ShortTermSnapshot>();

    constructor() {
        this.bindStorageSync();
    }

    /**
     * 跨上下文缓存同步。
     *
     * background 写入记忆后，content script 里的 MemoryStore 实例必须失效本地
     * 缓存；否则打开聊天窗时 listEntries 命中旧 entryCache，看不到新消息
     * （典型场景：AI 主动对话在后台落库，用户切回页面打开对话窗却看不到）。
     */
    private bindStorageSync(): void {
        if (!hasChromeStorage() || !chrome.storage?.onChanged) return;

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;

            const entriesPrefix = buildStorageKey("entries", "");
            const identityPrefix = buildStorageKey("identity", "");
            const shortTermPrefix = buildStorageKey("shortterm", "");

            for (const key of Object.keys(changes)) {
                // key 形如 ai_memory::<type>::<role>，parts[2] 即角色
                const role = key.split("::")[2];
                if (!role) continue;

                if (key.startsWith(entriesPrefix)) {
                    this.entryCache.delete(role);
                } else if (key.startsWith(identityPrefix)) {
                    this.identityCache.delete(role);
                } else if (key.startsWith(shortTermPrefix)) {
                    this.shortTermCache.delete(role);
                }
            }
        });
    }

    /**
     * 存储单条或批量记忆条目
     * —— 合并写入（先读当前 role 的所有条目，再合并去重后写回）
     */
    async saveEntries(entries: MemoryEntry[]): Promise<void> {
        if (!hasChromeStorage() || entries.length === 0) {
            return;
        }

        // 按 role 分组
        const grouped = new Map<string, MemoryEntry[]>();
        for (const entry of entries) {
            const list = grouped.get(entry.role) ?? [];
            list.push(entry);
            grouped.set(entry.role, list);
        }

        for (const [role, newEntries] of grouped) {
            try {
                const existing = await this.readAllEntries(role);

                // 以 id 为 key 合并，新条目覆盖旧条目（用于 update accessCount）
                const merged = new Map<string, MemoryEntry>();
                for (const e of existing) {
                    merged.set(e.id, e);
                }
                for (const e of newEntries) {
                    merged.set(e.id, e);
                }

                const all = [...merged.values()];
                await chrome.storage.local.set({
                    [buildStorageKey("entries", role)]: all,
                });
                this.entryCache.set(role, all);
            } catch (error) {
                console.error(`[MemoryStore] saveEntries(${role}) failed:`, error);
            }
        }
    }

    /**
     * 按角色获取所有记忆条目
     */
    async listEntries(role: string): Promise<MemoryEntry[]> {
        if (this.entryCache.has(role)) {
            return this.entryCache.get(role)!.map((e) => ({ ...e }));
        }

        return this.readAllEntries(role);
    }

    /**
     * 按 ID 删除记忆条目
     */
    async deleteEntry(id: string): Promise<void> {
        // 策略：直接从 cache + storage 里定位并删除，不走 saveEntries 的合并逻辑
        // （因为 saveEntries 的合并会把已删除条目从 existing 里"复活"）

        // 1. 先查缓存
        for (const [role, entries] of this.entryCache) {
            const filtered = entries.filter((e) => e.id !== id);
            if (filtered.length < entries.length) {
                const key = buildStorageKey("entries", role);
                await chrome.storage.local.set({ [key]: filtered });
                this.entryCache.set(role, filtered);
                return;
            }
        }

        // 2. 缓存没命中，遍历所有 storage key
        if (!hasChromeStorage()) return;
        try {
            const all = await chrome.storage.local.get(null);
            for (const [key, value] of Object.entries(all)) {
                if (
                    key.startsWith(buildStorageKey("entries", "")) &&
                    Array.isArray(value)
                ) {
                    const list = value as MemoryEntry[];
                    if (list.some((e) => e.id === id)) {
                        const filtered = list.filter((e) => e.id !== id);
                        await chrome.storage.local.set({ [key]: filtered });
                        // 解析 role 并更新缓存
                        const role = key.split("::")[2];
                        this.entryCache.set(role, filtered);
                        return;
                    }
                }
            }
        } catch (error) {
            console.error(`[MemoryStore] deleteEntry(${id}) failed:`, error);
        }
    }

    /**
     * 按分类过滤列出
     */
    async listByCategory(role: string, category: MemoryCategory): Promise<MemoryEntry[]> {
        const all = await this.listEntries(role);
        return all.filter((e) => e.category === category);
    }

    /**
     * 获取角色身份记忆
     */
    async getIdentity(role: string): Promise<IdentityMemory | null> {
        if (this.identityCache.has(role)) {
            return { ...this.identityCache.get(role)! };
        }
        if (!hasChromeStorage()) return null;

        try {
            const key = buildStorageKey("identity", role);
            const result = await chrome.storage.local.get(key);
            const identity = result[key] as IdentityMemory | undefined;
            if (identity) {
                this.identityCache.set(role, identity);
                return { ...identity };
            }
            return null;
        } catch (error) {
            console.error(`[MemoryStore] getIdentity(${role}) failed:`, error);
            return null;
        }
    }

    /**
     * 保存/更新角色身份记忆
     */
    async saveIdentity(identity: IdentityMemory): Promise<void> {
        if (!hasChromeStorage()) return;

        try {
            const key = buildStorageKey("identity", identity.role);
            await chrome.storage.local.set({ [key]: identity });
            this.identityCache.set(identity.role, identity);
        } catch (error) {
            console.error(`[MemoryStore] saveIdentity(${identity.role}) failed:`, error);
        }
    }

    /**
     * 获取短期记忆快照
     */
    async getShortTerm(role: string): Promise<ShortTermSnapshot | null> {
        if (this.shortTermCache.has(role)) {
            return { ...this.shortTermCache.get(role)! };
        }
        if (!hasChromeStorage()) return null;

        try {
            const key = buildStorageKey("shortterm", role);
            const result = await chrome.storage.local.get(key);
            const snapshot = result[key] as ShortTermSnapshot | undefined;
            if (snapshot) {
                this.shortTermCache.set(role, snapshot);
                return { ...snapshot };
            }
            return null;
        } catch (error) {
            console.error(`[MemoryStore] getShortTerm(${role}) failed:`, error);
            return null;
        }
    }

    /**
     * 保存短期记忆快照
     */
    async saveShortTerm(role: string, snapshot: ShortTermSnapshot): Promise<void> {
        if (!hasChromeStorage()) return;

        try {
            const key = buildStorageKey("shortterm", role);
            await chrome.storage.local.set({ [key]: snapshot });
            this.shortTermCache.set(role, snapshot);
        } catch (error) {
            console.error(`[MemoryStore] saveShortTerm(${role}) failed:`, error);
        }
    }

    /**
     * 清除某角色所有记忆
     */
    async clearRole(role: string): Promise<void> {
        if (!hasChromeStorage()) return;

        try {
            const keys = [
                buildStorageKey("entries", role),
                buildStorageKey("identity", role),
                buildStorageKey("shortterm", role),
            ];
            await chrome.storage.local.remove(keys);
            this.entryCache.delete(role);
            this.identityCache.delete(role);
            this.shortTermCache.delete(role);
        } catch (error) {
            console.error(`[MemoryStore] clearRole(${role}) failed:`, error);
        }
    }

    /**
     * 统计某角色记忆数量
     */
    async count(role: string): Promise<number> {
        const entries = await this.listEntries(role);
        return entries.length;
    }

    /**
     * 清除所有缓存（用于 storage.onChanged 同步）
     */
    invalidateCache(): void {
        this.entryCache.clear();
        this.identityCache.clear();
        this.shortTermCache.clear();
    }

    /**
     * 获取所有存储的角色列表（从 storage key 反推）
     * —— 同时扫 entries / identity / shortterm 三类前缀
     */
    async listAllRoles(): Promise<string[]> {
        if (!hasChromeStorage()) return [];

        try {
            const all = await chrome.storage.local.get(null);
            const roles = new Set<string>();
            // 三类 key 都可能包含角色 —— identity 只有设定，没有 entry 也算有角色
            const prefixes = [
                buildStorageKey("entries", ""),
                buildStorageKey("identity", ""),
                buildStorageKey("shortterm", ""),
            ];
            for (const key of Object.keys(all)) {
                for (const prefix of prefixes) {
                    if (key.startsWith(prefix)) {
                        const parts = key.split("::");
                        // ai_memory::<type>::<role>  → parts[2] 是 role
                        if (parts.length >= 3) {
                            roles.add(parts[2]);
                        }
                        break;
                    }
                }
            }
            return [...roles];
        } catch (error) {
            console.error(`[MemoryStore] listAllRoles() failed:`, error);
            return [];
        }
    }

    // —— 私有辅助 —— //

    /**
     * 从 chrome.storage 读取某角色的所有条目
     */
    private async readAllEntries(role: string): Promise<MemoryEntry[]> {
        if (!hasChromeStorage()) return [];

        try {
            const key = buildStorageKey("entries", role);
            const result = await chrome.storage.local.get(key);
            const entries = Array.isArray(result[key])
                ? (result[key] as MemoryEntry[])
                : [];
            this.entryCache.set(role, entries);
            return entries;
        } catch (error) {
            console.error(`[MemoryStore] readAllEntries(${role}) failed:`, error);
            return [];
        }
    }
}

/** 单例实例 —— 整个扩展共享同一个 MemoryStore */
let _instance: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
    if (!_instance) {
        _instance = new MemoryStore();
    }
    return _instance;
}
