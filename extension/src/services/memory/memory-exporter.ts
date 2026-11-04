/**
 * @file services/memory/memory-exporter.ts
 * @description 记忆系统导入导出 —— 支持 JSON 文件的完整备份与恢复
 *
 * 导出格式：MemoryExportPayload (schemaVersion: 1)
 * 导入入口：Options 页面的 MemoryManagerView
 */

import { getMemoryStore } from "./memory-store";
import { getMemoryGateway } from "./memory-gateway";
import {
  getMemoryBackendClient,
  isMemoryBackendFallbackError,
} from "./backend-client";
import type {
  IdentityMemory,
  MemoryEntry,
  MemoryExportPayload,
  ShortTermSnapshot,
} from "./types";

/**
 * 导出所有记忆数据为 JSON 对象
 * —— 后端可用时从后端导出，否则走本地 chrome.storage
 *
 * @param role 可选：仅导出指定角色
 */
export async function exportAllMemories(
  role?: string,
): Promise<MemoryExportPayload> {
  const client = getMemoryBackendClient();
  if (await client.isAvailable()) {
    try {
      return await client.exportAll(role);
    } catch (error) {
      if (!isMemoryBackendFallbackError(error)) throw error;
    }
  }
  return exportAllMemoriesLocally(role);
}

/** 本地导出实现 —— 同步收集各角色的 entries / identity / shortterm */
async function exportAllMemoriesLocally(
  role?: string,
): Promise<MemoryExportPayload> {
  const store = getMemoryStore();
  const roles = role ? [role] : await store.listAllRoles();

  const identities: IdentityMemory[] = [];
  const entries: MemoryEntry[] = [];
  const shortTerm: Record<string, ShortTermSnapshot> = {};

  for (const item of roles) {
    const [identity, roleEntries, snapshot] = await Promise.all([
      store.getIdentity(item),
      store.listEntries(item),
      store.getShortTerm(item),
    ]);

    if (identity) identities.push(identity);
    entries.push(...roleEntries);
    if (snapshot) shortTerm[item] = snapshot;
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
    throw new Error(
      "downloadMemoriesAsFile 只能在有 DOM 的页面调用（如 Options 页）",
    );
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
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
 * —— 后端可用时交给后端导入（与本地合并语义一致），否则走本地
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
  /** 本次导入涉及的所有角色（去重）—— 供 UI 导入后自动选中并同步展示 */
  rolesImported: string[];
}> {
  const client = getMemoryBackendClient();
  if (await client.isAvailable()) {
    try {
      return await client.importMemories(payload, mode);
    } catch (error) {
      if (!isMemoryBackendFallbackError(error)) throw error;
    }
  }
  return importMemoriesLocally(payload, mode);
}

/** 本地导入实现 */
async function importMemoriesLocally(
  payload: MemoryExportPayload,
  mode: "merge" | "replace" = "merge",
): Promise<{
  identitiesImported: number;
  entriesImported: number;
  shortTermImported: number;
  rolesCleared: number;
  rolesImported: string[];
}> {
  const store = getMemoryStore();

  // 1. 校验 schemaVersion
  if (payload.schemaVersion !== 1) {
    throw new Error(`不支持的导出版本: ${payload.schemaVersion}`);
  }

  // 2. 汇总本次导入涉及的所有角色（身份 / 条目 / 短期摘要任一来源都算）
  const involvedRoles = new Set<string>();
  for (const id of payload.identities ?? []) involvedRoles.add(id.role);
  for (const e of payload.entries ?? []) involvedRoles.add(e.role);
  for (const role of Object.keys(payload.shortTerm ?? {}))
    involvedRoles.add(role);

  // 3. replace 模式下，先清除所有涉及到的 role
  let rolesCleared = 0;
  if (mode === "replace") {
    for (const role of involvedRoles) {
      await store.clearRole(role);
      rolesCleared++;
    }
  }

  /*
   * 4. 自动补全角色身份 —— 备份里只有记忆条目、没有身份设定的角色，
   *    自动创建一个默认身份（displayName 用角色名）。
   *    这样导入后无需用户手动「新建角色」：
   *    - 角色会出现在 AI 聊天的角色选择器里（该处只列有 identity 的角色）
   *    - 记忆条目也能正常归属并展示
   */
  const now = Date.now();
  const identityRoles = new Set(
    (payload.identities ?? []).map((id) => id.role),
  );
  const autoIdentities: IdentityMemory[] = [];
  for (const role of involvedRoles) {
    if (identityRoles.has(role)) continue;
    // 已有身份的角色不覆盖
    const existing = await store.getIdentity(role);
    if (existing) continue;
    autoIdentities.push({
      role,
      displayName: role,
      systemPromptTemplate: "",
      version: 1,
      updatedAt: now,
    });
  }

  // 5. 并行写入 identities / entries / shortTerm
  const identityPromises = [
    ...(payload.identities ?? []).map((id) => store.saveIdentity(id)),
    ...autoIdentities.map((id) => store.saveIdentity(id)),
  ];

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

  await Promise.all([
    ...identityPromises,
    ...entryPromises,
    ...shortTermPromises,
  ]);

  // 4. 清除缓存使后续读取拿到新数据
  store.invalidateCache();

  return {
    identitiesImported:
      (payload.identities?.length ?? 0) + autoIdentities.length,
    entriesImported: payload.entries?.length ?? 0,
    shortTermImported: Object.keys(payload.shortTerm ?? {}).length,
    rolesCleared,
    rolesImported: [...involvedRoles],
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

/** 导出单个角色的记忆 —— 走后端时由服务端按角色裁剪 */
export async function exportSingleRole(
  role: string,
): Promise<MemoryExportPayload> {
  return exportAllMemories(role);
}

/**
 * 将浏览器本地（chrome.storage.local）的记忆一键迁移到后端
 * —— 本地导出 payload → 直接 POST 到后端 /api/v1/import
 *
 * 与 importMemories 的分流逻辑不同：这里数据源始终是本地存储，
 * 目标始终是后端，用于「纯前端时代 → 后端时代」的数据搬迁。
 *
 * @param mode 合并模式：merge=与后端现有数据合并 | replace=替换涉及角色
 * @throws 后端探针未通过时抛错（调用方应提示用户先启动后端）
 */
export async function migrateLocalToBackend(
  mode: "merge" | "replace" = "merge",
): Promise<{
  identitiesImported: number;
  entriesImported: number;
  shortTermImported: number;
  rolesCleared: number;
  rolesImported: string[];
}> {
  const client = getMemoryBackendClient();
  if (!(await client.isAvailable())) {
    throw new Error("记忆后端当前不可达，请先启动 memory-server 再迁移");
  }
  const payload = await exportAllMemoriesLocally();
  return client.importMemories(payload, mode);
}

/** 导出 service —— 让上层可以拿到统一门面（后端优先，失败回退本地） */
export const getService = () => getMemoryGateway();
