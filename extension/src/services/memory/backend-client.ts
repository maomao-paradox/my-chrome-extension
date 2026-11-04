/**
 * @file services/memory/backend-client.ts
 * @description 记忆后端 HTTP 客户端 —— 探针判定 + 统一请求封装
 *
 * 与 `memory-server`（Rust + axum，默认 http://127.0.0.1:8790）对接。
 *
 * 设计要点：
 *   1. 探针优先：`GET /health` 通过才认为后端可用；失败结果同样进缓存，
 *      避免后端未启动时每次记忆操作都白等一次超时（失败短路）。
 *   2. 探针结果带 TTL 缓存（健康 30s / 失败 10s），并发探针会复用同一个 Promise。
 *   3. 所有业务请求带超时（AbortController）与统一错误映射；
 *      网络层失败会把探针缓存标记为不可用，让后续调用立刻回到本地模式。
 *   4. `/health`、`/readyz` 无需鉴权；设置 API_TOKEN 后业务请求自动带上
 *      `Authorization: Bearer <token>`，同时附带 `X-API-Key` 以便服务端任选其一。
 */

import type {
    IdentityMemory,
    MemoryCategory,
    MemoryEntry,
    MemoryExportPayload,
    MemoryImportance,
    MemoryQueryResult,
    ShortTermSnapshot,
} from "./types";

/** 后端默认地址 —— 与 memory-server 的 SERVER_HOST / SERVER_PORT 默认值一致 */
export const DEFAULT_MEMORY_BACKEND_BASE_URL = "http://127.0.0.1:8790";

/** chrome.storage.local 中的配置键：后端地址 */
export const MEMORY_BACKEND_BASE_URL_KEY = "memoryBackendBaseUrl";
/** chrome.storage.local 中的配置键：可选 API_TOKEN */
export const MEMORY_BACKEND_TOKEN_KEY = "memoryBackendApiToken";

/** 探针健康结果的缓存时长（30 秒） */
const PROBE_HEALTHY_TTL_MS = 30_000;
/** 探针失败后的短路时长（10 秒）—— 避免后端离线时反复超时 */
const PROBE_FAILED_TTL_MS = 10_000;
/** 探针单次超时（3 秒）—— 探针必须快速给出结论 */
const PROBE_TIMEOUT_MS = 3_000;
/** 业务请求超时（8 秒） */
const REQUEST_TIMEOUT_MS = 8_000;

/** 后端统一错误码（见 openapi.yaml ErrorEnvelope） */
export type MemoryBackendErrorCode =
    | "bad_request"
    | "unauthorized"
    | "not_found"
    | "payload_too_large"
    | "internal"
    /** 客户端侧：网络失败 / 超时 / 服务不可达 */
    | "unavailable";

/** 业务错误码集合 —— 用于从响应信封里安全收敛取值 */
const KNOWN_ERROR_CODES = new Set<string>([
    "bad_request",
    "unauthorized",
    "not_found",
    "payload_too_large",
    "internal",
]);

/** 记忆后端错误 —— 统一携带 code，便于门面决定是否降级到本地 */
export class MemoryBackendError extends Error {
    constructor(
        public readonly code: MemoryBackendErrorCode,
        message: string,
        /** HTTP 状态码（网络层失败时为 undefined） */
        public readonly status?: number,
    ) {
        super(message);
        this.name = "MemoryBackendError";
    }
}

/** 判断错误是否应该触发"后端 → 本地"降级 */
export function isMemoryBackendFallbackError(error: unknown): boolean {
    if (!(error instanceof MemoryBackendError)) return false;
    // 网络不可达 / 超时 / 服务端 5xx：都视为后端暂时不可用，回退本地保证业务不中断
    return error.code === "unavailable" || error.code === "internal";
}

/** 后端连接配置 */
export interface MemoryBackendConfig {
    /** 归一化后的 base URL（无尾斜杠） */
    baseUrl: string;
    /** 可选 API_TOKEN */
    token?: string;
}

/** 判断当前环境是否有 chrome.storage */
const hasChromeStorage = (): boolean =>
    typeof chrome !== "undefined" && !!chrome.storage?.local;

/**
 * 读取后端连接配置
 * —— 没有配置时返回默认地址；storage 异常时同样给出安全默认值
 */
export async function resolveMemoryBackendConfig(): Promise<MemoryBackendConfig> {
    if (!hasChromeStorage()) {
        return { baseUrl: DEFAULT_MEMORY_BACKEND_BASE_URL };
    }

    try {
        const stored = await chrome.storage.local.get([
            MEMORY_BACKEND_BASE_URL_KEY,
            MEMORY_BACKEND_TOKEN_KEY,
        ]);
        const rawBaseUrl = stored[MEMORY_BACKEND_BASE_URL_KEY];
        const rawToken = stored[MEMORY_BACKEND_TOKEN_KEY];

        const baseUrl =
            typeof rawBaseUrl === "string" && rawBaseUrl.trim()
                ? rawBaseUrl.trim().replace(/\/+$/, "")
                : DEFAULT_MEMORY_BACKEND_BASE_URL;
        const token =
            typeof rawToken === "string" && rawToken.trim()
                ? rawToken.trim()
                : undefined;

        return { baseUrl, token };
    } catch (error) {
        console.warn("[MemoryBackend] 读取后端配置失败，使用默认地址:", error);
        return { baseUrl: DEFAULT_MEMORY_BACKEND_BASE_URL };
    }
}

/**
 * 写入后端连接配置（供设置页 / 调试脚本使用）
 * —— baseUrl 传空串会回落到默认地址；token 传 null / 空串表示清除
 */
export async function setMemoryBackendConfig(patch: {
    baseUrl?: string;
    token?: string | null;
}): Promise<void> {
    if (!hasChromeStorage()) return;

    const writes: Record<string, unknown> = {};
    if (patch.baseUrl !== undefined) {
        const normalized = patch.baseUrl.trim().replace(/\/+$/, "");
        writes[MEMORY_BACKEND_BASE_URL_KEY] =
            normalized || DEFAULT_MEMORY_BACKEND_BASE_URL;
    }
    if (patch.token !== undefined) {
        const normalized = (patch.token ?? "").trim();
        writes[MEMORY_BACKEND_TOKEN_KEY] = normalized;
    }

    if (Object.keys(writes).length === 0) return;
    await chrome.storage.local.set(writes);
}

/** 构造函数可注入的依赖（方便单元测试替换 fetch / 时钟） */
interface MemoryBackendClientOptions {
    fetchImpl?: typeof fetch;
    now?: () => number;
    probeTimeoutMs?: number;
    requestTimeoutMs?: number;
}

/** 新增记忆条目的入参（与本地 MemoryService.addEntry 保持一致） */
export interface BackendAddEntryParams {
    role: string;
    content: string;
    category?: MemoryCategory;
    importance?: MemoryImportance;
    source?: string;
    tags?: string[];
}

/** 短期记忆输入 —— 直接摘要或消息列表二选一 */
type ShortTermMessage = {
    role: "user" | "assistant" | "system";
    content: string;
};

/** 单次请求的附加选项 */
interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    timeoutMs?: number;
    /** 是否携带鉴权头（探针不需要） */
    auth?: boolean;
}

/** 原始响应（仅保留客户端需要的信息） */
interface RawResponse {
    ok: boolean;
    status: number;
    text: string;
}

/** URL path 片段编码 */
const encodeSegment = (value: string): string => encodeURIComponent(value);

/**
 * MemoryBackendClient —— 记忆后端 HTTP 客户端
 *
 * 只负责网络层：拼 URL、带鉴权、超时、错误映射。
 * 业务分流由 `memory-gateway.ts` 负责。
 */
export class MemoryBackendClient {
    private readonly fetchImpl: typeof fetch;
    private readonly now: () => number;
    private readonly probeTimeoutMs: number;
    private readonly requestTimeoutMs: number;

    /** 探针结果缓存 */
    private probeCache: { healthy: boolean; expiresAt: number } | null = null;
    /** 并发探针去重 —— 多个调用同时触发探针时只发一次请求 */
    private probeInFlight: Promise<boolean> | null = null;

    constructor(options: MemoryBackendClientOptions = {}) {
        // 绑定到 globalThis，避免把 fetch 作为方法调用时丢失 this
        this.fetchImpl =
            options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
        this.now = options.now ?? (() => Date.now());
        this.probeTimeoutMs = options.probeTimeoutMs ?? PROBE_TIMEOUT_MS;
        this.requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    }

    // ─── 探针 ─── //

    /**
     * 探针是否通过（带 TTL 缓存与失败短路）
     * —— 这是"走后端 / 走本地"的唯一判定入口
     */
    async isAvailable(): Promise<boolean> {
        const now = this.now();

        // 1. 缓存命中（健康或失败都算命中）
        if (this.probeCache && now < this.probeCache.expiresAt) {
            return this.probeCache.healthy;
        }

        // 2. 已有探针在飞 → 复用，避免并发风暴
        if (this.probeInFlight) {
            return this.probeInFlight;
        }

        // 3. 发起新探针
        this.probeInFlight = this.runProbe().finally(() => {
            this.probeInFlight = null;
        });
        return this.probeInFlight;
    }

    /** 显式探测一次（等价于 isAvailable，语义更直白） */
    async probe(): Promise<boolean> {
        return this.isAvailable();
    }

    /** 执行 `GET /health` 并写入缓存 */
    private async runProbe(): Promise<boolean> {
        const startedAt = this.now();
        try {
            const config = await resolveMemoryBackendConfig();
            const response = await this.rawRequest(config, "/health", {
                method: "GET",
                timeoutMs: this.probeTimeoutMs,
                auth: false,
            });

            const healthy = response.ok;
            this.probeCache = {
                healthy,
                expiresAt: startedAt + (healthy ? PROBE_HEALTHY_TTL_MS : PROBE_FAILED_TTL_MS),
            };
            return healthy;
        } catch (error) {
            this.probeCache = {
                healthy: false,
                expiresAt: this.now() + PROBE_FAILED_TTL_MS,
            };
            console.debug(
                "[MemoryBackend] 探针未通过，切回本地记忆模式:",
                error instanceof Error ? error.message : error,
            );
            return false;
        }
    }

    /** 标记后端不可用 —— 业务请求发生网络层失败时调用，让后续调用立即回本地 */
    private markUnavailable(): void {
        this.probeCache = {
            healthy: false,
            expiresAt: this.now() + PROBE_FAILED_TTL_MS,
        };
    }

    /** 清空探针缓存（配置变更 / 测试使用） */
    resetProbeCache(): void {
        this.probeCache = null;
        this.probeInFlight = null;
    }

    // ─── 业务 API ─── //

    /** 列出角色 —— chatOnly=true 时服务端过滤纯工具角色 */
    async listRoles(chatOnly = false): Promise<string[]> {
        const query = chatOnly ? "?chatOnly=true" : "";
        const result = await this.request<{ roles?: string[] }>(
            `/api/v1/roles${query}`,
            { method: "GET" },
        );
        return result.roles ?? [];
    }

    /** 读取角色身份 —— 不存在返回 null（服务端 404） */
    async getIdentity(role: string): Promise<IdentityMemory | null> {
        try {
            return await this.request<IdentityMemory>(
                `/api/v1/roles/${encodeSegment(role)}/identity`,
                { method: "GET" },
            );
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    }

    /** 注册 / 更新角色身份（服务端自动 version +1） */
    async upsertIdentity(
        params: Omit<IdentityMemory, "version" | "updatedAt">,
    ): Promise<IdentityMemory> {
        return this.request<IdentityMemory>(
            `/api/v1/roles/${encodeSegment(params.role)}/identity`,
            {
                method: "PUT",
                body: {
                    displayName: params.displayName,
                    systemPromptTemplate: params.systemPromptTemplate,
                    personaDescription: params.personaDescription,
                },
            },
        );
    }

    /** 新增记忆条目 */
    async addEntry(params: BackendAddEntryParams): Promise<MemoryEntry> {
        return this.request<MemoryEntry>(
            `/api/v1/roles/${encodeSegment(params.role)}/entries`,
            {
                method: "POST",
                body: {
                    content: params.content,
                    category: params.category,
                    importance: params.importance,
                    source: params.source,
                    tags: params.tags,
                },
            },
        );
    }

    /**
     * 局部更新记忆条目
     * —— 只透传服务端支持的字段，忽略 role / decay 等本地专属字段
     */
    async updateEntry(id: string, patch: Partial<MemoryEntry>): Promise<MemoryEntry> {
        const body: Record<string, unknown> = {};
        if (patch.content !== undefined) body.content = patch.content;
        if (patch.importance !== undefined) body.importance = patch.importance;
        if (patch.category !== undefined) body.category = patch.category;
        if (patch.tags !== undefined) body.tags = patch.tags;

        return this.request<MemoryEntry>(`/api/v1/entries/${encodeSegment(id)}`, {
            method: "PATCH",
            body,
        });
    }

    /** 删除记忆条目 —— 本地实现本就不存在时静默返回，这里吞掉 404 */
    async removeEntry(id: string): Promise<void> {
        try {
            await this.request<void>(`/api/v1/entries/${encodeSegment(id)}`, {
                method: "DELETE",
            });
        } catch (error) {
            if (isNotFound(error)) return;
            throw error;
        }
    }

    /** 列出角色记忆条目（可按分类过滤） */
    async listEntries(
        role: string,
        category?: MemoryCategory,
    ): Promise<MemoryEntry[]> {
        const query = category ? `?category=${encodeSegment(category)}` : "";
        const result = await this.request<{ entries?: MemoryEntry[] }>(
            `/api/v1/roles/${encodeSegment(role)}/entries${query}`,
            { method: "GET" },
        );
        return result.entries ?? [];
    }

    /** 手动唤醒记忆 —— 不存在返回 null */
    async recallEntry(id: string): Promise<MemoryEntry | null> {
        try {
            return await this.request<MemoryEntry>(
                `/api/v1/entries/${encodeSegment(id)}/recall`,
                { method: "POST" },
            );
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    }

    /** 混合排序检索 */
    async retrieve(role: string, query?: string, limit = 15): Promise<MemoryEntry[]> {
        const result = await this.request<{ entries?: MemoryEntry[] }>(
            `/api/v1/roles/${encodeSegment(role)}/retrieve`,
            { method: "POST", body: { query, limit } },
        );
        return result.entries ?? [];
    }

    /** 装配可直接注入 system prompt 的上下文 */
    async buildContext(role: string, query?: string): Promise<MemoryQueryResult> {
        return this.request<MemoryQueryResult>(
            `/api/v1/roles/${encodeSegment(role)}/context`,
            { method: "POST", body: { query } },
        );
    }

    /** 观察一轮对话，服务端自动提取记忆 */
    async observe(role: string, userMessage: string, aiResponse: string): Promise<void> {
        await this.request<{ ok: boolean }>(
            `/api/v1/roles/${encodeSegment(role)}/observe`,
            { method: "POST", body: { userMessage, aiResponse } },
        );
    }

    /** 读取短期记忆快照 —— 不存在返回 null */
    async getShortTerm(role: string): Promise<ShortTermSnapshot | null> {
        try {
            return await this.request<ShortTermSnapshot>(
                `/api/v1/roles/${encodeSegment(role)}/short-term`,
                { method: "GET" },
            );
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    }

    /** 直接写入短期记忆快照 */
    async saveShortTerm(role: string, snapshot: ShortTermSnapshot): Promise<ShortTermSnapshot> {
        return this.request<ShortTermSnapshot>(
            `/api/v1/roles/${encodeSegment(role)}/short-term`,
            {
                method: "PUT",
                body: {
                    summary: snapshot.summary,
                    coveredMessageCount: snapshot.coveredMessageCount,
                },
            },
        );
    }

    /** 由消息列表让服务端自动生成短期摘要（取最近 6 条，每条截断 100 字符） */
    async saveShortTermFromMessages(
        role: string,
        messages: ShortTermMessage[],
    ): Promise<ShortTermSnapshot> {
        return this.request<ShortTermSnapshot>(
            `/api/v1/roles/${encodeSegment(role)}/short-term`,
            { method: "PUT", body: { messages } },
        );
    }

    /** 忘记角色的一切 */
    async forgetAll(role: string): Promise<void> {
        try {
            await this.request<void>(`/api/v1/roles/${encodeSegment(role)}`, {
                method: "DELETE",
            });
        } catch (error) {
            if (isNotFound(error)) return;
            throw error;
        }
    }

    /** 导出备份 —— 不传 role 时为全量 */
    async exportAll(role?: string): Promise<MemoryExportPayload> {
        const query = role ? `?role=${encodeSegment(role)}` : "";
        return this.request<MemoryExportPayload>(`/api/v1/export${query}`, {
            method: "GET",
        });
    }

    /** 导入备份 */
    async importMemories(
        payload: MemoryExportPayload,
        mode: "merge" | "replace" = "merge",
    ): Promise<{
        identitiesImported: number;
        entriesImported: number;
        shortTermImported: number;
        rolesCleared: number;
        rolesImported: string[];
    }> {
        return this.request(`/api/v1/import?mode=${mode}`, {
            method: "POST",
            body: payload,
        });
    }

    // ─── 请求底层 ─── //

    /**
     * 发起并解析一次业务请求
     * —— 非 2xx 时按 ErrorEnvelope 收敛成 MemoryBackendError
     */
    private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const config = await resolveMemoryBackendConfig();
        const response = await this.rawRequest(config, path, options);

        if (!response.ok) {
            throw this.toBackendError(response);
        }

        if (!response.text) {
            return undefined as T;
        }

        try {
            return JSON.parse(response.text) as T;
        } catch {
            throw new MemoryBackendError(
                "unavailable",
                `记忆后端返回了非 JSON 响应: ${response.text.slice(0, 120)}`,
                response.status,
            );
        }
    }

    /**
     * 底层 fetch 封装 —— 超时、鉴权、文本读取
     * —— 网络层异常统一抛 `unavailable` 并标记探针失败
     */
    private async rawRequest(
        config: MemoryBackendConfig,
        path: string,
        options: RequestOptions,
    ): Promise<RawResponse> {
        const timeoutMs = options.timeoutMs ?? this.requestTimeoutMs;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const headers: Record<string, string> = {
                Accept: "application/json",
            };
            if (options.body !== undefined) {
                headers["Content-Type"] = "application/json";
            }
            // 鉴权头：服务端支持 Bearer 与 X-API-Key 两种形态，二者都带上
            if (options.auth !== false && config.token) {
                headers.Authorization = `Bearer ${config.token}`;
                headers["X-API-Key"] = config.token;
            }

            const response = await this.fetchImpl(`${config.baseUrl}${path}`, {
                method: options.method ?? "GET",
                headers,
                body:
                    options.body === undefined
                        ? undefined
                        : JSON.stringify(options.body),
                signal: controller.signal,
            });

            const text = await response.text();
            return { ok: response.ok, status: response.status, text };
        } catch (error) {
            this.markUnavailable();
            const reason =
                error instanceof Error ? error.message : String(error);
            throw new MemoryBackendError(
                "unavailable",
                `无法连接记忆后端（${config.baseUrl}）: ${reason}`,
            );
        } finally {
            clearTimeout(timer);
        }
    }

    /** 把错误响应转换为 MemoryBackendError */
    private toBackendError(response: RawResponse): MemoryBackendError {
        let code: MemoryBackendErrorCode = response.status >= 500 ? "internal" : "bad_request";
        let message = `HTTP ${response.status}`;

        try {
            const payload = JSON.parse(response.text) as {
                error?: { code?: string; message?: string };
            };
            const rawCode = payload?.error?.code;
            if (typeof rawCode === "string" && KNOWN_ERROR_CODES.has(rawCode)) {
                code = rawCode as MemoryBackendErrorCode;
            }
            if (payload?.error?.message) {
                message = payload.error.message;
            }
        } catch {
            // 非 JSON 错误体：保留 HTTP 状态描述
            if (response.text) {
                message = `HTTP ${response.status}: ${response.text.slice(0, 120)}`;
            }
        }

        return new MemoryBackendError(code, message, response.status);
    }
}

/** 判断是否为 404（not_found）错误 */
function isNotFound(error: unknown): boolean {
    return error instanceof MemoryBackendError && error.code === "not_found";
}

/** 全局单例 —— 所有上层模块共享同一份探针缓存 */
let _client: MemoryBackendClient | null = null;

export function getMemoryBackendClient(): MemoryBackendClient {
    if (!_client) {
        _client = new MemoryBackendClient();
    }
    return _client;
}

/** 替换 / 重置单例（测试或配置变更时使用；传 null 则下次访问重新创建） */
export function setMemoryBackendClient(client: MemoryBackendClient | null): void {
    _client = client;
}
