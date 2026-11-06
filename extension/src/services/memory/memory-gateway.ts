/**
 * @file services/memory/memory-gateway.ts
 * @description 记忆统一门面 —— 按探针结果在「后端模式 / 本地模式」之间分流
 *
 * 分流规则：
 *   - 探针（GET /health）通过 → 所有记忆业务走后端 HTTP API；
 *   - 探针未通过 / 后端请求网络层失败 → 完全回退到原有的 chrome.storage 本地实现。
 *
 * 对上层暴露的方法签名与 `MemoryService` 保持一致，
 * 因此调用方（stream-manager / proactive-chat / options 页 / MCP 工具）
 * 只需要把 `getMemoryService` 换成门面的同名导出即可，无需改调用代码。
 */

import {
    getMemoryService as getLocalMemoryService,
    isFunctionalRole,
} from "./memory-service";
import { isMemoryBackendFallbackError, getMemoryBackendClient } from "./backend-client";
import type {
    IdentityMemory,
    MemoryCategory,
    MemoryEntry,
    MemoryImportance,
    MemoryQueryResult,
} from "./types";

/** 新增记忆条目入参（与本地 MemoryService.addEntry 一致） */
export interface AddMemoryEntryParams {
    role: string;
    content: string;
    category?: MemoryCategory;
    importance?: MemoryImportance;
    source?: string;
    tags?: string[];
    createdAt?: number;
}

/** 短期记忆消息 */
interface ShortTermMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

/** 当前记忆模式 */
export type MemoryMode = "backend" | "local";

/**
 * MemoryGateway —— 记忆业务统一入口
 *
 * 内部持有两个实现：
 *   - `local`  ：原有 MemoryService（chrome.storage.local）
 *   - 后端客户端：MemoryBackendClient（memory-server）
 */
export class MemoryGateway {
    private readonly local = getLocalMemoryService();

    /** 当前实际生效的模式（会触发 / 复用探针缓存） */
    async getMode(): Promise<MemoryMode> {
        return (await getMemoryBackendClient().isAvailable()) ? "backend" : "local";
    }

    /** 是否走后端模式（供 UI / 日志展示） */
    async isBackendMode(): Promise<boolean> {
        return getMemoryBackendClient().isAvailable();
    }

    /** 强制重新探针（忽略 TTL 缓存） */
    async refreshMode(): Promise<MemoryMode> {
        const client = getMemoryBackendClient();
        client.resetProbeCache();
        return (await client.isAvailable()) ? "backend" : "local";
    }

    // ─── 身份记忆 ─── //

    async upsertIdentity(
        params: Omit<IdentityMemory, "version" | "updatedAt">,
    ): Promise<IdentityMemory> {
        return this.route(
            (client) => client.upsertIdentity(params),
            () => this.local.upsertIdentity(params),
        );
    }

    async getIdentity(role: string): Promise<IdentityMemory | null> {
        return this.route(
            (client) => client.getIdentity(role),
            () => this.local.getIdentity(role),
        );
    }

    // ─── 记忆条目 CRUD ─── //

    async addEntry(params: AddMemoryEntryParams): Promise<MemoryEntry> {
        return this.route(
            (client) => client.addEntry(params),
            () => this.local.addEntry(params),
        );
    }

    /** 更新条目 —— 本地实现返回 void，保持签名一致 */
    async updateEntry(id: string, patch: Partial<MemoryEntry>): Promise<void> {
        await this.route<void>(
            async (client) => {
                await client.updateEntry(id, patch);
            },
            async () => {
                await this.local.updateEntry(id, patch);
            },
        );
    }

    async removeEntry(id: string): Promise<void> {
        await this.route(
            (client) => client.removeEntry(id),
            () => this.local.removeEntry(id),
        );
    }

    async listEntries(role: string): Promise<MemoryEntry[]> {
        return this.route(
            (client) => client.listEntries(role),
            () => this.local.listEntries(role),
        );
    }

    async listByCategory(
        role: string,
        category: MemoryCategory,
    ): Promise<MemoryEntry[]> {
        return this.route(
            (client) => client.listEntries(role, category),
            () => this.local.listByCategory(role, category),
        );
    }

    async recallEntry(id: string): Promise<MemoryEntry | null> {
        return this.route(
            (client) => client.recallEntry(id),
            () => this.local.recallEntry(id),
        );
    }

    async listRoles(): Promise<string[]> {
        return this.route(
            (client) => client.listRoles(false),
            () => this.local.listRoles(),
        );
    }

    async listChatRoles(): Promise<string[]> {
        return this.route(
            (client) => client.listRoles(true),
            () => this.local.listChatRoles(),
        );
    }

    async forgetAll(role: string): Promise<void> {
        await this.route(
            (client) => client.forgetAll(role),
            () => this.local.forgetAll(role),
        );
    }

    // ─── 检索与上下文 ─── //

    async retrieve(role: string, query?: string, limit = 15): Promise<MemoryEntry[]> {
        return this.route(
            (client) => client.retrieve(role, query, limit),
            () => this.local.retrieve(role, query, limit),
        );
    }

    async buildContext(role: string, query?: string): Promise<MemoryQueryResult> {
        return this.route(
            (client) => client.buildContext(role, query),
            () => this.local.buildContext(role, query),
        );
    }

    async observe(
        role: string,
        userMessage: string,
        aiResponse: string,
        createdAt?: number,
    ): Promise<void> {
        await this.route(
            (client) => client.observe(role, userMessage, aiResponse, createdAt),
            () => this.local.observe(role, userMessage, aiResponse, createdAt),
        );
    }

    async updateShortTerm(role: string, messages: ShortTermMessage[]): Promise<void> {
        await this.route<void>(
            async (client) => {
                await client.saveShortTermFromMessages(role, messages);
            },
            () => this.local.updateShortTerm(role, messages),
        );
    }

    // ─── 分流核心 ─── //

    /**
     * 按探针结果选择后端或本地实现
     *
     * @param remote 后端实现
     * @param local  本地实现
     */
    private async route<T>(
        remote: (client: ReturnType<typeof getMemoryBackendClient>) => Promise<T>,
        local: () => Promise<T>,
    ): Promise<T> {
        const client = getMemoryBackendClient();

        if (!(await client.isAvailable())) {
            return local();
        }

        try {
            return await remote(client);
        } catch (error) {
            // 网络层失败 / 服务端 5xx：探针已被标记为失败，本次立即回退本地
            if (isMemoryBackendFallbackError(error)) {
                console.warn(
                    "[MemoryGateway] 后端请求失败，已回退本地记忆:",
                    error instanceof Error ? error.message : error,
                );
                return local();
            }
            throw error;
        }
    }
}

/** 全局单例 */
let _gateway: MemoryGateway | null = null;

export function getMemoryGateway(): MemoryGateway {
    if (!_gateway) {
        _gateway = new MemoryGateway();
    }
    return _gateway;
}

/**
 * 兼容旧调用点 —— 记忆业务统一入口
 * （内部按探针结果分流：后端优先，失败回退本地）
 */
export function getMemoryService(): MemoryGateway {
    return getMemoryGateway();
}

/** 重置门面单例（测试使用） */
export function setMemoryGateway(gateway: MemoryGateway | null): void {
    _gateway = gateway;
}

// isFunctionalRole 保持从原模块透出，避免调用方改 import
export { isFunctionalRole };
