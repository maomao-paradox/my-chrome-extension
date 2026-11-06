/**
 * @file test/memory-gateway.spec.ts
 * @description 记忆后端探针网关 —— 单元测试
 *
 * 覆盖范围：
 *   1. 探针通过 → 后端模式（业务请求打到 memory-server）
 *   2. 探针失败 / 超时 → 本地模式（行为与此前完全一致）
 *   3. 探针 TTL 缓存与失败短路（不重复打探针）
 *   4. API_TOKEN 鉴权头注入
 *   5. 后端业务请求网络失败时按次降级到本地
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    MemoryBackendClient,
    MEMORY_BACKEND_BASE_URL_KEY,
    MEMORY_BACKEND_TOKEN_KEY,
    setMemoryBackendClient,
} from "@/services/memory/backend-client";
import { MemoryGateway, setMemoryGateway } from "@/services/memory/memory-gateway";
import { getMemoryStore } from "@/services/memory/memory-store";

const TEST_ROLE = "gateway_test_role";

/** 构造一个最小可用的 JSON Response */
const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

/** 提取 fetch 调用的 URL 字符串 */
const urlOf = (input: RequestInfo | URL): string =>
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

beforeEach(() => {
    // 每个用例使用干净的本地缓存
    getMemoryStore().invalidateCache();
    setMemoryBackendClient(null);
    setMemoryGateway(null);
});

afterEach(async () => {
    await getMemoryStore().clearRole(TEST_ROLE);
    getMemoryStore().invalidateCache();
    setMemoryBackendClient(null);
    setMemoryGateway(null);
    // 清理可能写入的后端配置
    await chrome.storage.local.set({
        [MEMORY_BACKEND_BASE_URL_KEY]: undefined,
        [MEMORY_BACKEND_TOKEN_KEY]: undefined,
    });
});

// ======================================================================
// 1. 探针缓存
// ======================================================================
describe("MemoryBackendClient —— 探针", () => {
    it("探针通过时返回 true，并在 TTL 内复用缓存", async () => {
        const fetchMock = vi.fn(async () => jsonResponse({ status: "ok" }));
        const client = new MemoryBackendClient({ fetchImpl: fetchMock });

        await expect(client.isAvailable()).resolves.toBe(true);
        await expect(client.isAvailable()).resolves.toBe(true);

        // 30s 内只探一次
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(urlOf(fetchMock.mock.calls[0][0])).toContain("/health");
    });

    it("探针失败时返回 false，并短路后续探针", async () => {
        const fetchMock = vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        });
        const client = new MemoryBackendClient({ fetchImpl: fetchMock });

        await expect(client.isAvailable()).resolves.toBe(false);
        await expect(client.isAvailable()).resolves.toBe(false);

        // 失败缓存的 10s 内不再重试
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("健康缓存过期后会重新探针", async () => {
        let now = 1_000;
        const fetchMock = vi.fn(async () => jsonResponse({ status: "ok" }));
        const client = new MemoryBackendClient({
            fetchImpl: fetchMock,
            now: () => now,
        });

        await expect(client.isAvailable()).resolves.toBe(true);
        now += 31_000; // 超过 30s TTL
        await expect(client.isAvailable()).resolves.toBe(true);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("探针超时会中止请求并判定失败", async () => {
        const fetchMock = vi.fn(
            (_input: RequestInfo | URL, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () =>
                        reject(new DOMException("aborted", "AbortError")),
                    );
                }),
        );
        const client = new MemoryBackendClient({
            fetchImpl: fetchMock as unknown as typeof fetch,
            probeTimeoutMs: 20,
        });

        await expect(client.isAvailable()).resolves.toBe(false);
    });
});

// ======================================================================
// 2. 门面分流
// ======================================================================
describe("MemoryGateway —— 模式分流", () => {
    it("探针通过 → 走后端，不写本地存储", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = urlOf(input);
            if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
            if (url.includes(`/api/v1/roles/${TEST_ROLE}/entries`) && init?.method === "POST") {
                return jsonResponse(
                    {
                        id: "entry-1",
                        role: TEST_ROLE,
                        category: "preference",
                        content: "主人喜欢喝美式咖啡",
                        importance: "high",
                        createdAt: 1,
                        lastAccessedAt: 1,
                        accessCount: 1,
                    },
                    201,
                );
            }
            return jsonResponse({});
        });
        setMemoryBackendClient(
            new MemoryBackendClient({ fetchImpl: fetchMock as unknown as typeof fetch }),
        );
        const gateway = new MemoryGateway();

        await expect(gateway.getMode()).resolves.toBe("backend");

        const entry = await gateway.addEntry({
            role: TEST_ROLE,
            content: "主人喜欢喝美式咖啡",
            category: "preference",
            importance: "high",
        });

        expect(entry.id).toBe("entry-1");
        // 后端模式下不应写入 chrome.storage.local 的记忆键
        const setCalls = (chrome.storage.local.set as unknown as ReturnType<typeof vi.fn>).mock
            .calls;
        const hasLocalWrite = setCalls.some(([payload]) =>
            Object.keys(payload as Record<string, unknown>).some((key) =>
                key.startsWith("ai_memory::entries::"),
            ),
        );
        expect(hasLocalWrite).toBe(false);
        // 本地存储应保持为空
        await expect(getMemoryStore().listEntries(TEST_ROLE)).resolves.toHaveLength(0);
    });

    it("后端写入记忆时保留用户消息的原始时间", async () => {
        const requestBodies: Array<{ url: string; body: Record<string, unknown> }> = [];
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = urlOf(input);
            if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
            if (init?.method === "POST") {
                requestBodies.push({
                    url,
                    body: JSON.parse(String(init.body)) as Record<string, unknown>,
                });
            }
            if (url.endsWith("/observe")) return jsonResponse({ ok: true });
            if (url.endsWith("/entries")) {
                return jsonResponse({
                    id: "timed-entry",
                    role: TEST_ROLE,
                    category: "conversation",
                    content: "用户：消息",
                    importance: "medium",
                    createdAt: 1_743_840_428_000,
                    lastAccessedAt: Date.now(),
                    accessCount: 1,
                }, 201);
            }
            return jsonResponse({});
        });
        setMemoryBackendClient(
            new MemoryBackendClient({ fetchImpl: fetchMock as unknown as typeof fetch }),
        );
        const gateway = new MemoryGateway();
        const createdAt = 1_743_840_428_000;

        await gateway.addEntry({
            role: TEST_ROLE,
            content: "用户：消息",
            category: "conversation",
            createdAt,
        });
        await gateway.observe(TEST_ROLE, "用户消息", "AI 回复", createdAt);

        expect(requestBodies).toContainEqual(
            expect.objectContaining({
                url: expect.stringMatching(/\/entries$/),
                body: expect.objectContaining({ createdAt }),
            }),
        );
        expect(requestBodies).toContainEqual(
            expect.objectContaining({
                url: expect.stringMatching(/\/observe$/),
                body: expect.objectContaining({ createdAt }),
            }),
        );
    });

    it("探针失败 → 完全走本地，行为不变", async () => {
        const fetchMock = vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        });
        setMemoryBackendClient(
            new MemoryBackendClient({ fetchImpl: fetchMock as unknown as typeof fetch }),
        );
        const gateway = new MemoryGateway();

        await expect(gateway.getMode()).resolves.toBe("local");

        const entry = await gateway.addEntry({
            role: TEST_ROLE,
            content: "用户喜欢 TypeScript",
            category: "fact",
        });

        const local = await getMemoryStore().listEntries(TEST_ROLE);
        expect(local).toHaveLength(1);
        expect(local[0].id).toBe(entry.id);
        expect(local[0].content).toBe("用户喜欢 TypeScript");
    });

    it("后端业务请求网络失败 → 当次降级本地并标记探针失败", async () => {
        let now = 1_000;
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = urlOf(input);
            if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
            if (url.includes("/entries") && init?.method === "POST") {
                throw new TypeError("network down");
            }
            return jsonResponse({});
        });
        const client = new MemoryBackendClient({
            fetchImpl: fetchMock as unknown as typeof fetch,
            now: () => now,
        });
        setMemoryBackendClient(client);
        const gateway = new MemoryGateway();

        await expect(gateway.getMode()).resolves.toBe("backend");

        await gateway.addEntry({ role: TEST_ROLE, content: "降级测试内容" });

        // 降级后写入本地
        const local = await getMemoryStore().listEntries(TEST_ROLE);
        expect(local).toHaveLength(1);
        expect(local[0].content).toBe("降级测试内容");

        // 探针已被标记为失败，后续直接走本地
        await expect(client.isAvailable()).resolves.toBe(false);
    });

    it("设置 API_TOKEN 后业务请求携带鉴权头，探针不带", async () => {
        await chrome.storage.local.set({ [MEMORY_BACKEND_TOKEN_KEY]: "secret-token" });

        const seenHeaders: Array<Record<string, string>> = [];
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = urlOf(input);
            seenHeaders.push((init?.headers ?? {}) as Record<string, string>);
            if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
            if (url.includes("/roles") && init?.method === "GET") {
                return jsonResponse({ roles: [] });
            }
            return jsonResponse({});
        });
        setMemoryBackendClient(
            new MemoryBackendClient({ fetchImpl: fetchMock as unknown as typeof fetch }),
        );
        const gateway = new MemoryGateway();

        await gateway.listRoles();

        const probeHeaders = seenHeaders[0];
        const apiHeaders = seenHeaders[1];
        expect(probeHeaders.Authorization).toBeUndefined();
        expect(apiHeaders.Authorization).toBe("Bearer secret-token");
        expect(apiHeaders["X-API-Key"]).toBe("secret-token");
    });
});

// ======================================================================
// 3. 本地 → 后端一键迁移
// ======================================================================
describe("migrateLocalToBackend —— 本地记忆迁移", () => {
    it("后端在线时把本地数据 POST 到 /api/v1/import", async () => {
        // 先在本地落一条记忆 + 身份
        const store = getMemoryStore();
        await store.saveIdentity({
            role: TEST_ROLE,
            displayName: "迁移角色",
            systemPromptTemplate: "",
            version: 1,
            updatedAt: 1,
        });
        await store.saveEntries([
            {
                id: "local-entry-1",
                role: TEST_ROLE,
                category: "preference",
                content: "本地旧记忆",
                importance: "medium",
                createdAt: 1,
                lastAccessedAt: 1,
                accessCount: 1,
            },
        ]);
        store.invalidateCache();

        let importBody: Record<string, unknown> | null = null;
        let importMode: string | null = null;
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = urlOf(input);
            if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
            if (url.includes("/api/v1/import")) {
                importMode = new URL(url).searchParams.get("mode");
                importBody = JSON.parse(String(init?.body));
                return jsonResponse({
                    identitiesImported: 1,
                    entriesImported: 1,
                    shortTermImported: 0,
                    rolesCleared: 0,
                    rolesImported: [TEST_ROLE],
                });
            }
            return jsonResponse({});
        });
        setMemoryBackendClient(
            new MemoryBackendClient({ fetchImpl: fetchMock as unknown as typeof fetch }),
        );

        const { migrateLocalToBackend } = await import(
            "@/services/memory/memory-exporter"
        );
        const result = await migrateLocalToBackend("merge");

        expect(result.entriesImported).toBe(1);
        expect(importMode).toBe("merge");
        expect(importBody).not.toBeNull();
        const payload = importBody as unknown as {
            schemaVersion: number;
            entries: Array<{ id: string; content: string }>;
            identities: Array<{ role: string }>;
        };
        expect(payload.schemaVersion).toBe(1);
        expect(payload.entries[0].id).toBe("local-entry-1");
        expect(payload.identities[0].role).toBe(TEST_ROLE);
    });

    it("后端离线时直接抛错，不读本地数据", async () => {
        setMemoryBackendClient(
            new MemoryBackendClient({
                fetchImpl: async () => {
                    throw new TypeError("Failed to fetch");
                },
            }),
        );

        const { migrateLocalToBackend } = await import(
            "@/services/memory/memory-exporter"
        );
        await expect(migrateLocalToBackend()).rejects.toThrow("不可达");
    });
});
