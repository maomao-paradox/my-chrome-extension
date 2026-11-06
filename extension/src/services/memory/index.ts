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

// 统一门面：探针通过走后端，失败回退本地；签名与 MemoryService 一致
export {
    getMemoryService,
    getMemoryGateway,
    MemoryGateway,
    isFunctionalRole,
} from "./memory-gateway";
export type { AddMemoryEntryParams, MemoryMode } from "./memory-gateway";

// 本地实现（需要绕过探针直接操作 chrome.storage 时使用）
export {
    MemoryService,
    formatRecentConversationContext,
    selectRecentConversationEntries,
} from "./memory-service";

// 后端客户端与配置
export {
    MemoryBackendClient,
    MemoryBackendError,
    getMemoryBackendClient,
    setMemoryBackendClient,
    resolveMemoryBackendConfig,
    setMemoryBackendConfig,
    isMemoryBackendFallbackError,
    DEFAULT_MEMORY_BACKEND_BASE_URL,
    MEMORY_BACKEND_BASE_URL_KEY,
    MEMORY_BACKEND_TOKEN_KEY,
} from "./backend-client";
export { getMemoryStore, MemoryStore, generateMemoryId } from "./memory-store";
export {
    exportAllMemories,
    exportSingleRole,
    downloadMemoriesAsFile,
    importMemories,
    importFromFile,
    migrateLocalToBackend,
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
