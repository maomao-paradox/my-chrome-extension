/**
 * @file services/memory/index.ts
 * @description AI 记忆系统 —— 统一导出入口
 *
 * 使用示例：
 *   import { getMemoryService } from "@/services/memory";
 *
 *   const service = getMemoryService();
 *
 *   // 每次对话前：构建记忆上下文
 *   const { assembledContext } = await service.buildContext(role, userInput);
 *   const finalSystemPrompt = baseSystemPrompt + "\n\n" + assembledContext;
 *
 *   // 每次对话后：让记忆系统观察这轮对话
 *   await service.observe(role, userInput, aiResponse);
 *
 *   // 管理页：导出备份
 *   await downloadMemoriesAsFile();
 */

export { getMemoryService, MemoryService } from "./memory-service";
export { getMemoryStore, MemoryStore, generateMemoryId } from "./memory-store";
export {
    exportAllMemories,
    exportSingleRole,
    downloadMemoriesAsFile,
    importMemories,
    importFromFile,
} from "./memory-exporter";

// ─── 遗忘曲线（艾宾浩斯） ─── //
export {
    ACTIVE_THRESHOLD,
    FORGOTTEN_THRESHOLD,
    HOUR_MS,
    INITIAL_STABILITY_HOURS,
    REACTIVATION_GROWTH,
    classifyDecayState,
    computeRetention,
    describeRetention,
    getStability,
    isExemptFromForgetting,
    normalizeEntry,
    reactivateEntry,
} from "./decay";

// ─── RAG 检索（BM25 + 中文 bigram） ─── //
export { Bm25Index, tokenize } from "./rag-retriever";
export type { RankedMemory } from "./rag-retriever";

export type {
    IdentityMemory,
    MemoryCategory,
    MemoryDecayState,
    MemoryEntry,
    MemoryExportPayload,
    MemoryImportance,
    MemoryQueryResult,
    MemoryStorageAdapter,
    ShortTermSnapshot,
} from "./types";

export { MEMORY_STORAGE_PREFIX, buildStorageKey } from "./types";
