/**
 * @file test/memory-service.spec.ts
 * @description AI 记忆系统 —— 单元测试
 *
 * 测试范围：
 *   1. MemoryStore（持久化层）—— 验证 chrome.storage 读写、缓存、clear
 *   2. MemoryService（业务层）—— 验证 addEntry / buildContext / retrieve / observe
 *   3. MemoryExporter —— 验证导出格式、导入合并/替换模式
 *
 * 使用 setup.ts 里注入的 chrome.storage.local mock。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    MemoryBackendClient,
    setMemoryBackendClient,
} from "@/services/memory/backend-client";
import {
    getMemoryStore,
    generateMemoryId,
} from "@/services/memory/memory-store";
import { MemoryService, getMemoryService } from "@/services/memory/memory-service";
import {
    exportAllMemories,
    importMemories,
    type MemoryExportPayload,
} from "@/services/memory/memory-exporter";
import type {
    IdentityMemory,
    MemoryEntry,
} from "@/services/memory/types";

// 测试用角色
const TEST_ROLE = "hatsune_miku_tavern";
const TEST_ROLE_2 = "default_ai_assistant";

// 重置每个测试的 service 单例（因为 module 级缓存可能残留）
let service: MemoryService;
let store: ReturnType<typeof getMemoryStore>;

beforeEach(() => {
    // 本文件只测本地实现：注入必定失败的探针，确保门面稳定走 chrome.storage
    setMemoryBackendClient(
        new MemoryBackendClient({
            fetchImpl: async () => {
                throw new TypeError("backend disabled in unit tests");
            },
        }),
    );

    // vitest 会在每次 import 时重置模块吗？不一定，所以手动 clear
    store = getMemoryStore();
    store.invalidateCache();
    service = getMemoryService();
});

afterEach(async () => {
    // 确保每个测试后 chrome.storage.local 干净
    await store.clearRole(TEST_ROLE);
    await store.clearRole(TEST_ROLE_2);
    store.invalidateCache();
    setMemoryBackendClient(null);
});

// ======================================================================
// 1. MemoryStore 基础能力
// ======================================================================
describe("MemoryStore —— 持久化层", () => {
    it("generateMemoryId 应该生成唯一 ID", () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            ids.add(generateMemoryId());
        }
        expect(ids.size).toBe(100);
    });

    it("saveEntries + listEntries 能正确读写", async () => {
        const entry: MemoryEntry = {
            id: generateMemoryId(),
            role: TEST_ROLE,
            category: "fact",
            content: "用户喜欢 TypeScript",
            importance: "high",
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            accessCount: 1,
        };

        await store.saveEntries([entry]);
        const result = await store.listEntries(TEST_ROLE);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe("用户喜欢 TypeScript");
        expect(result[0].category).toBe("fact");
    });

    it("saveEntries 批量写入 + 按 role 分组", async () => {
        const e1: MemoryEntry = {
            id: generateMemoryId(),
            role: TEST_ROLE,
            category: "preference",
            content: "Miku 喜欢唱歌",
            importance: "medium",
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            accessCount: 1,
        };
        const e2: MemoryEntry = {
            id: generateMemoryId(),
            role: TEST_ROLE_2,
            category: "fact",
            content: "另一个角色的记忆",
            importance: "low",
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            accessCount: 1,
        };

        await store.saveEntries([e1, e2]);

        const list1 = await store.listEntries(TEST_ROLE);
        const list2 = await store.listEntries(TEST_ROLE_2);

        expect(list1).toHaveLength(1);
        expect(list2).toHaveLength(1);
    });

    it("clearRole 能清除某角色所有类型数据", async () => {
        const entry: MemoryEntry = {
            id: generateMemoryId(),
            role: TEST_ROLE,
            category: "fact",
            content: "会被清除",
            importance: "low",
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            accessCount: 1,
        };
        const identity: IdentityMemory = {
            role: TEST_ROLE,
            displayName: "Miku",
            systemPromptTemplate: "你是 Miku",
            version: 1,
            updatedAt: Date.now(),
        };

        await store.saveEntries([entry]);
        await store.saveIdentity(identity);

        await store.clearRole(TEST_ROLE);

        expect(await store.listEntries(TEST_ROLE)).toHaveLength(0);
        expect(await store.getIdentity(TEST_ROLE)).toBeNull();
    });

    it("deleteEntry 按 ID 删除正确的条目", async () => {
        const e1: MemoryEntry = {
            id: "keep-me",
            role: TEST_ROLE,
            category: "fact",
            content: "保留",
            importance: "low",
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            accessCount: 1,
        };
        const e2: MemoryEntry = {
            id: "delete-me",
            role: TEST_ROLE,
            category: "fact",
            content: "删除",
            importance: "low",
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            accessCount: 1,
        };

        await store.saveEntries([e1, e2]);
        await store.deleteEntry("delete-me");

        const result = await store.listEntries(TEST_ROLE);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("keep-me");
    });
});

// ======================================================================
// 2. MemoryService 业务层
// ======================================================================
describe("MemoryService —— 业务层", () => {
    it("addEntry 创建记忆并存储", async () => {
        const entry = await service.addEntry({
            role: TEST_ROLE,
            content: "用户叫小明",
            category: "fact",
            importance: "high",
        });

        expect(entry.id).toBeTruthy();
        expect(entry.createdAt).toBeTruthy();
        expect(entry.accessCount).toBe(1);

        const list = await store.listEntries(TEST_ROLE);
        expect(list).toHaveLength(1);
        expect(list[0].content).toBe("用户叫小明");
    });

    it("upsertIdentity 能创建/更新角色身份", async () => {
        const identity = await service.upsertIdentity({
            role: TEST_ROLE,
            displayName: "Miku",
            systemPromptTemplate: "你是初音未来",
            personaDescription: "16 岁的虚拟歌姬",
        });

        expect(identity.version).toBe(1);
        expect(identity.displayName).toBe("Miku");

        // 再次更新，版本号递增
        const updated = await service.upsertIdentity({
            role: TEST_ROLE,
            displayName: "Hatsune Miku",
            systemPromptTemplate: "你是初音未来 v2",
        });
        expect(updated.version).toBe(2);
    });

    it("buildContext 组装空上下文时返回空字符串", async () => {
        const result = await service.buildContext("no-such-role", "随便说点啥");
        expect(result.assembledContext).toBe("");
        expect(result.entries).toHaveLength(0);
    });

    it("buildContext 有记忆时正确拼接", async () => {
        // 先创建身份
        await service.upsertIdentity({
            role: TEST_ROLE,
            displayName: "Miku",
            systemPromptTemplate: "你是 Miku",
            personaDescription: "虚拟歌姬，16 岁，喜欢唱歌",
        });

        const createdAt = Date.now();
        await service.addEntry({
            role: TEST_ROLE,
            content: "用户：最近在学习 TypeScript\nAI：可以从类型系统开始。",
            category: "conversation",
            importance: "medium",
            createdAt,
        });
        await service.addEntry({
            role: TEST_ROLE,
            content: "用户喜欢 TypeScript",
            category: "preference",
            importance: "high",
        });
        await service.addEntry({
            role: TEST_ROLE,
            content: "用户使用 TypeScript",
            category: "fact",
            importance: "medium",
        });
        await service.addEntry({
            role: TEST_ROLE,
            content: "用户在 Ubuntu 22.04 上开发",
            category: "fact",
            importance: "medium",
        });

        const result = await service.buildContext(TEST_ROLE, "我又想学点新东西了");

        expect(result.identity?.displayName).toBe("Miku");
        expect(result.entries).toHaveLength(1);
        expect(result.assembledContext).toContain("角色身份");
        expect(result.assembledContext).toContain("虚拟歌姬");
        expect(result.assembledContext).toContain("最近24小时的聊天记录");
        expect(result.assembledContext).toContain("最近在学习 TypeScript");
        expect(result.assembledContext).toContain(
            "用户：最近在学习 TypeScript\nAI：可以从类型系统开始。",
        );
        expect(result.assembledContext).not.toContain("用户喜欢 TypeScript");
        expect(result.assembledContext).not.toContain("Ubuntu 22.04");
        // 每条对话记录行首注入时间，格式 `- [YYYY/MM/DD HH:mm:ss]`
        expect(result.assembledContext).toMatch(
            /- \[\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\] 用户：最近在学习 TypeScript/,
        );
    });

    it("buildContext 只返回最近 24 小时内最新的 5 条对话记录", async () => {
        const now = Date.now();
        const oldConversationAt = now - 24 * 60 * 60 * 1000 - 1;
        const futureConversationAt = now + 60_000;

        for (let i = 0; i < 25; i += 1) {
            await service.addEntry({
                role: TEST_ROLE,
                content: `近期-${i + 1} ${"词".repeat(400)}`,
                category: "conversation",
                importance: "medium",
                createdAt: now - (25 - i) * 60_000,
            });
        }
        await service.addEntry({
            role: TEST_ROLE,
            content: "24小时前的对话",
            category: "conversation",
            importance: "medium",
            createdAt: oldConversationAt,
        });
        await service.addEntry({
            role: TEST_ROLE,
            content: "未来时间的对话",
            category: "conversation",
            importance: "medium",
            createdAt: futureConversationAt,
        });
        await service.addEntry({
            role: TEST_ROLE,
            content: "用户喜欢简体中文",
            category: "preference",
            importance: "high",
        });

        const result = await service.buildContext(TEST_ROLE);

        expect(result.entries).toHaveLength(5);
        expect(result.entries[0].content).toContain("近期-21");
        expect(result.entries[4].content).toContain("近期-25");
        expect(result.assembledContext.match(/近期-\d+/g)).toHaveLength(5);
        expect(result.assembledContext).not.toContain("24小时前的对话");
        expect(result.assembledContext).not.toContain("未来时间的对话");
        expect(result.assembledContext).not.toContain("用户喜欢简体中文");
    });

    it("observe 使用用户发送消息的时间记录长期记忆", async () => {
        const createdAt = new Date(2025, 3, 5, 6, 7, 8).getTime();

        await service.observe(
            TEST_ROLE,
            "记住：我喜欢喝美式咖啡",
            "好呀，我记住你喜欢喝美式咖啡了。",
            createdAt,
        );

        const entries = await store.listEntries(TEST_ROLE);
        expect(entries.length).toBeGreaterThanOrEqual(2);
        expect(entries.every((entry) => entry.createdAt === createdAt)).toBe(true);
    });

    it("observe 规则 1：捕获用户说'记住XXX'为 preference", async () => {
        await service.observe(TEST_ROLE, "记住我喜欢猫", "好的~");

        const entries = await store.listByCategory(TEST_ROLE, "preference");
        expect(entries).toHaveLength(1);
        expect(entries[0].content).toBe("我喜欢猫");
        expect(entries[0].importance).toBe("high");
    });

    it("observe 规则 2：捕获 URL 为 fact", async () => {
        await service.observe(
            TEST_ROLE,
            "看看这个 https://github.com/vuejs/core",
            "好的",
        );

        const entries = await store.listByCategory(TEST_ROLE, "fact");
        // 应该至少有 URL 被捕获
        const urlEntry = entries.find((e) => e.content.includes("github.com"));
        expect(urlEntry).toBeTruthy();
    });

    it("retrieve 关键词匹配能召回相关记忆", async () => {
        await service.addEntry({
            role: TEST_ROLE,
            content: "用户喜欢 React",
            category: "preference",
            importance: "high",
        });
        await service.addEntry({
            role: TEST_ROLE,
            content: "用户正在做浏览器扩展",
            category: "conversation",
            importance: "medium",
        });

        const results = await service.retrieve(TEST_ROLE, "React hook 怎么用");
        expect(results.length).toBeGreaterThanOrEqual(1);
        // 包含 React 的应该排前面
        expect(results[0].content).toContain("React");
    });
});

// ======================================================================
// 3. 记忆导入导出
// ======================================================================
describe("MemoryImportExport —— 导入导出", () => {
    it("exportAllMemories 返回正确结构", async () => {
        await service.addEntry({
            role: TEST_ROLE,
            content: "测试条目",
            category: "fact",
        });

        const payload = await exportAllMemories();

        expect(payload.schemaVersion).toBe(1);
        expect(payload.exportedAt).toBeTruthy();
        expect(Array.isArray(payload.entries)).toBe(true);
        expect(payload.entries.length).toBeGreaterThanOrEqual(1);
    });

    it("importMemories merge 模式：合并同 ID 条目", async () => {
        // 先存一条
        await service.addEntry({
            role: TEST_ROLE,
            content: "原始记忆",
            category: "fact",
        });

        // 构造一份导入数据
        const imported: MemoryExportPayload = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            identities: [],
            entries: [
                {
                    id: "imported-1",
                    role: TEST_ROLE,
                    category: "preference",
                    content: "导入的新记忆",
                    importance: "high",
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now(),
                    accessCount: 1,
                },
            ],
            shortTerm: {},
        };

        const result = await importMemories(imported, "merge");

        expect(result.entriesImported).toBe(1);
        expect(result.rolesCleared).toBe(0);

        const all = await store.listEntries(TEST_ROLE);
        // merge 模式应该同时有原始和导入的
        const contents = all.map((e) => e.content);
        expect(contents).toContain("原始记忆");
        expect(contents).toContain("导入的新记忆");
    });

    it("importMemories replace 模式：先清除再导入", async () => {
        // 先存两条
        await service.addEntry({
            role: TEST_ROLE,
            content: "旧记忆 1",
            category: "fact",
        });
        await service.addEntry({
            role: TEST_ROLE_2,
            content: "旧记忆 2",
            category: "fact",
        });

        const imported: MemoryExportPayload = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            identities: [],
            entries: [
                {
                    id: "new-1",
                    role: TEST_ROLE,
                    category: "fact",
                    content: "全新记忆",
                    importance: "high",
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now(),
                    accessCount: 1,
                },
            ],
            shortTerm: {},
        };

        const result = await importMemories(imported, "replace");

        expect(result.rolesCleared).toBe(1); // 只清除 TEST_ROLE（导入数据涉及的 role）

        const role1List = await store.listEntries(TEST_ROLE);
        const role2List = await store.listEntries(TEST_ROLE_2);

        expect(role1List).toHaveLength(1);
        expect(role1List[0].content).toBe("全新记忆");
        // TEST_ROLE_2 没被涉及，应该保留
        expect(role2List).toHaveLength(1);
    });

    it("导入只有记忆条目、没有身份设定的备份时自动创建角色", async () => {
        const roleWithoutIdentity = "imported-role";
        const imported: MemoryExportPayload = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            // 备份里没有任何身份设定
            identities: [],
            entries: [
                {
                    id: "auto-role-entry-1",
                    role: roleWithoutIdentity,
                    category: "fact",
                    content: "备份里的记忆条目",
                    importance: "medium",
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now(),
                    accessCount: 1,
                },
            ],
            shortTerm: {},
        };

        const result = await importMemories(imported, "merge");

        // 返回结果包含本次导入涉及的角色，供 UI 自动选中
        expect(result.rolesImported).toContain(roleWithoutIdentity);
        // 缺失身份的角色被自动补全，保证导入后无需手动新建角色
        expect(result.identitiesImported).toBe(1);

        const identity = await service.getIdentity(roleWithoutIdentity);
        expect(identity).not.toBeNull();
        expect(identity?.role).toBe(roleWithoutIdentity);
        expect(identity?.displayName).toBe(roleWithoutIdentity);

        // 记忆条目也已同步落库
        const entries = await store.listEntries(roleWithoutIdentity);
        expect(entries).toHaveLength(1);
        expect(entries[0].content).toBe("备份里的记忆条目");
    });

    it("导入的角色已存在身份时不覆盖原身份", async () => {
        await service.upsertIdentity({
            role: TEST_ROLE,
            displayName: "原有角色名",
            systemPromptTemplate: "原有 system prompt",
        });

        const imported: MemoryExportPayload = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            identities: [],
            entries: [
                {
                    id: "keep-identity-entry",
                    role: TEST_ROLE,
                    category: "fact",
                    content: "新增记忆",
                    importance: "medium",
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now(),
                    accessCount: 1,
                },
            ],
            shortTerm: {},
        };

        await importMemories(imported, "merge");

        const identity = await service.getIdentity(TEST_ROLE);
        expect(identity?.displayName).toBe("原有角色名");
        expect(identity?.systemPromptTemplate).toBe("原有 system prompt");
    });
});

// ======================================================================
// 5. P2：对话语料入库（RAG 语料库）
// ======================================================================
describe("observe —— 对话语料入库", () => {
    it("整轮对话会被存为 conversation 类目语料", async () => {
        await service.observe(
            TEST_ROLE,
            "vite 的路径别名要怎么配才不会报错？",
            "在 vite.config.ts 里配置 resolve.alias，用 path.resolve 指向 src 目录即可。",
        );

        const conversations = await store.listByCategory(TEST_ROLE, "conversation");
        expect(conversations).toHaveLength(1);
        expect(conversations[0].content).toContain("用户：");
        expect(conversations[0].content).toContain("AI：");
        expect(conversations[0].content).toContain("resolve.alias");
        expect(conversations[0].source).toBe("auto:conversation");
        // 语料默认中等重要度，参与遗忘曲线
        expect(conversations[0].importance).toBe("medium");
        expect(conversations[0].stability).toBeGreaterThan(0);
    });

    it("寒暄类对话不入库", async () => {
        await service.observe(TEST_ROLE, "在吗", "在的～");
        await service.observe(TEST_ROLE, "谢谢你", "不客气！");

        expect(await store.listByCategory(TEST_ROLE, "conversation")).toHaveLength(0);
    });

    it("AI 回复为空时不入库", async () => {
        await service.observe(TEST_ROLE, "这是一段足够长的用户提问内容", "");

        expect(await store.listByCategory(TEST_ROLE, "conversation")).toHaveLength(0);
    });

    it("重复的对话会被去重，不会反复刷库", async () => {
        const question = "React 的 useEffect 依赖数组怎么写才不会有警告？";
        const answer =
            "把用到的变量都放进依赖数组，函数用 useCallback 包一层保持引用稳定。";

        await service.observe(TEST_ROLE, question, answer);
        await service.observe(TEST_ROLE, question, answer);

        expect(await store.listByCategory(TEST_ROLE, "conversation")).toHaveLength(1);
    });

    it("过长的对话会被截断后入库", async () => {
        const longAi = "很长的回答".repeat(200); // 1000 字符
        await service.observe(TEST_ROLE, "请详细解释一下", longAi);

        const [entry] = await store.listByCategory(TEST_ROLE, "conversation");
        expect(entry).toBeTruthy();
        // 用户段 150 + AI 段 250 + 前缀，总量受控
        expect(entry.content.length).toBeLessThan(450);
    });

    it("入库的对话能被 RAG 检索召回 —— 证明语料缺口已补上", async () => {
        await service.observe(
            TEST_ROLE,
            "上次我们聊到怎么给 chrome 扩展做流式输出？",
            "用的是 chrome.runtime.connect 建立长连接，然后 service worker 里边收边 postMessage。",
        );

        const results = await service.retrieve(TEST_ROLE, "chrome 扩展流式输出怎么实现");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].category).toBe("conversation");
        expect(results[0].content).toContain("chrome.runtime.connect");
    });

    it("对话语料会进入最终注入的 system prompt 上下文", async () => {
        await service.observe(
            TEST_ROLE,
            "我们的项目叫 mria，主要做浏览器扩展",
            "记下了，mria 是一个浏览器扩展项目。",
        );

        const ctx = await service.buildContext(TEST_ROLE, "mria 是什么项目来着");
        expect(ctx.assembledContext).toContain("mria");
    });
});

describe("端到端对话流程", () => {
    it("一次对话的完整记忆注入 + 学习 + 再注入 能形成闭环", async () => {
        // Step 1: 注册角色身份
        await service.upsertIdentity({
            role: TEST_ROLE,
            displayName: "Miku",
            systemPromptTemplate: "你是初音未来",
            personaDescription: "初音未来，16 岁虚拟歌姬",
        });

        // Step 2: 第一次对话前 —— buildContext 返回身份（没有长期记忆）
        const ctx1 = await service.buildContext(TEST_ROLE, "你好 Miku");
        expect(ctx1.identity).toBeTruthy();
        expect(ctx1.assembledContext).toContain("角色身份");

        // Step 3: 第一次对话 —— 用户说了重要信息
        await service.observe(
            TEST_ROLE,
            "记住我叫小明，我喜欢 TypeScript 和猫",
            "好的小明~ 我记住啦！",
        );

        // Step 4: 第二次对话前 —— buildContext 应该返回刚记住的内容
        const ctx2 = await service.buildContext(TEST_ROLE, "小明今天心情不好");
        expect(ctx2.entries.length).toBeGreaterThan(0);
        expect(ctx2.assembledContext).toContain("小明");
        expect(ctx2.assembledContext).toContain("猫");
    });
});
