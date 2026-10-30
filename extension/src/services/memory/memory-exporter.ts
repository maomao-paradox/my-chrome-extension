/**
 * @file services/memory/memory-exporter.ts
 * @description 记忆系统导入导出 —— 支持 JSON 文件的完整备份与恢复
 *
 * 导出格式：MemoryExportPayload (schemaVersion: 1)
 * 导入入口：Options 页面的 MemoryManagerView
 */

import { getMemoryStore } from "./memory-store";
import { getMemoryService } from "./memory-service";
import type {
    IdentityMemory,
    MemoryEntry,
    MemoryExportPayload,
    ShortTermSnapshot,
} from "./types";

/**
 * 导出所有记忆数据为 JSON 对象
 * —— 同步收集各角色的 entries / identity / shortterm
 */
export async function exportAllMemories(): Promise<MemoryExportPayload> {
    const store = getMemoryStore();
    const roles = await store.listAllRoles();

    const identities: IdentityMemory[] = [];
    const entries: MemoryEntry[] = [];
    const shortTerm: Record<string, ShortTermSnapshot> = {};

    for (const role of roles) {
        const [identity, roleEntries, snapshot] = await Promise.all([
            store.getIdentity(role),
            store.listEntries(role),
            store.getShortTerm(role),
        ]);

        if (identity) identities.push(identity);
        entries.push(...roleEntries);
        if (snapshot) shortTerm[role] = snapshot;
    }

    return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        identities,
        entries,
        shortTerm,
    };
}

/**
 * 导出并触发浏览器下载
 * —— 仅在非 service worker 环境可用（options 页面、popup 等有 DOM 的地方）
 */
export async function downloadMemoriesAsFile(filename?: string): Promise<void> {
    const payload = await exportAllMemories();
    const json = JSON.stringify(payload, null, 2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = globalThis as any;
    if (typeof win.document === "undefined") {
        throw new Error("downloadMemoriesAsFile 只能在有 DOM 的页面调用（如 Options 页）");
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");
    const finalName = filename ?? `ai-memory-backup-${dateStr}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 从 JSON 对象恢复记忆数据
 *
 * @param payload        导入数据包
 * @param mode           合并模式：merge=与现有合并 | replace=完全替换
 */
export async function importMemories(
    payload: MemoryExportPayload,
    mode: "merge" | "replace" = "merge",
): Promise<{
    identitiesImported: number;
    entriesImported: number;
    shortTermImported: number;
    rolesCleared: number;
}> {
    const store = getMemoryStore();

    // 1. 校验 schemaVersion
    if (payload.schemaVersion !== 1) {
        throw new Error(`不支持的导出版本: ${payload.schemaVersion}`);
    }

    // 2. replace 模式下，先清除所有涉及到的 role
    let rolesCleared = 0;
    if (mode === "replace") {
        const involvedRoles = new Set<string>();
        for (const id of payload.identities) involvedRoles.add(id.role);
        for (const e of payload.entries) involvedRoles.add(e.role);
        for (const role of Object.keys(payload.shortTerm)) involvedRoles.add(role);

        for (const role of involvedRoles) {
            await store.clearRole(role);
            rolesCleared++;
        }
    }

    // 3. 并行写入 identities / entries / shortTerm
    const identityPromises = (payload.identities ?? []).map((id) =>
        store.saveIdentity(id),
    );

    // 批量保存 entries —— 按 role 合并
    const entriesByRole = new Map<string, MemoryEntry[]>();
    for (const e of payload.entries ?? []) {
        const list = entriesByRole.get(e.role) ?? [];
        list.push(e);
        entriesByRole.set(e.role, list);
    }
    const entryPromises = [...entriesByRole.values()].map((batch) =>
        store.saveEntries(batch),
    );

    const shortTermPromises = Object.entries(payload.shortTerm ?? {}).map(
        ([role, snapshot]) => store.saveShortTerm(role, snapshot),
    );

    await Promise.all([...identityPromises, ...entryPromises, ...shortTermPromises]);

    // 4. 清除缓存使后续读取拿到新数据
    store.invalidateCache();

    return {
        identitiesImported: payload.identities?.length ?? 0,
        entriesImported: payload.entries?.length ?? 0,
        shortTermImported: Object.keys(payload.shortTerm ?? {}).length,
        rolesCleared,
    };
}

/**
 * 从 File 对象读取并导入（用于 <input type="file"> ）
 */
export async function importFromFile(
    file: File,
    mode: "merge" | "replace" = "merge",
): ReturnType<typeof importMemories> {
    const text = await file.text();
    let payload: MemoryExportPayload;
    try {
        payload = JSON.parse(text) as MemoryExportPayload;
    } catch {
        throw new Error("文件不是合法的 JSON 格式");
    }
    return importMemories(payload, mode);
}

/** 导出单个角色的记忆 */
export async function exportSingleRole(role: string): Promise<MemoryExportPayload> {
    const store = getMemoryStore();
    const [identity, entries, shortTerm] = await Promise.all([
        store.getIdentity(role),
        store.listEntries(role),
        store.getShortTerm(role),
    ]);

    return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        identities: identity ? [identity] : [],
        entries,
        shortTerm: shortTerm ? { [role]: shortTerm } : {},
    };
}

/** 导出 service —— 让上层可以拿到 service 做更多操作 */
export const getService = () => getMemoryService();
