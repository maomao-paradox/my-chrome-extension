/**
 * @file services/memory/types.ts
 * @description AI 记忆系统核心类型定义
 *
 * 分层记忆架构：
 * ┌─────────────────────────────────────────────────────────┐
 * │  Working Memory   工作记忆（内存态，当前对话上下文）      │
 * │  ├─ messages: ChatMessage[]                              │
 * │  └─ 生命周期：单次对话 session                            │
 * ├─────────────────────────────────────────────────────────┤
 * │  Short-term Memory  短期记忆（最近 N 轮摘要）             │
 * │  ├─ summary: string                                     │
 * │  ├─ lastSummaryAt: number                               │
 * │  └─ 生命周期：跨 session，定期更新                        │
 * ├─────────────────────────────────────────────────────────┤
 * │  Long-term Memory   长期记忆（持久化，chrome.storage）    │
 * │  ├─ IdentityMemory    角色身份/设定                      │
 * │  ├─ ConversationMemory 对话历史快照                      │
 * │  ├─ PreferenceMemory  用户偏好/重要信息                   │
 * │  └─ 生命周期：永久，支持导入导出                          │
 * └─────────────────────────────────────────────────────────┘
 */

/** 记忆条目等级 —— 用于检索时的权重 */
export type MemoryImportance = "low" | "medium" | "high" | "critical";

/** 记忆类型分类 */
export type MemoryCategory =
    | "identity"       // 角色身份：名字、性格、system prompt 模板
    | "conversation"   // 对话摘要：历史对话要点
    | "preference"     // 用户偏好：用户明确表达的喜好/习惯/禁忌
    | "fact"           // 事实信息：用户提到的具体信息（职业、项目等）
    | "episodic";      // 情景记忆：某次具体对话事件

/**
 * 遗忘状态 —— 由艾宾浩斯保留率 R(t) 推导，决定是否进入 prompt
 *   active    R >= 0.55        正常注入
 *   fading    0.2 <= R < 0.55  仅高重要度或 RAG 命中时注入
 *   forgotten R < 0.2          不注入，但保留在存储，被提起时复活
 */
export type MemoryDecayState = "active" | "fading" | "forgotten";

/** 单条长期记忆 */
export interface MemoryEntry {
    /** 唯一 ID (nanoid 或时间戳+随机) */
    id: string;
    /** 归属角色 (如 "hatsune_miku_tavern") */
    role: string;
    /** 记忆分类 */
    category: MemoryCategory;
    /** 记忆内容（自然语言文本） */
    content: string;
    /** 重要程度 */
    importance: MemoryImportance;
    /** 来源摘要（从哪段对话提取） */
    source?: string;
    /** 创建时间戳 */
    createdAt: number;
    /** 最后访问时间戳（用于 LRU 排序） */
    lastAccessedAt: number;
    /** 访问次数 */
    accessCount: number;
    /** 可选的标签，用于主题聚类 */
    tags?: string[];
    /**
     * 记忆稳定性 S —— 单位：小时。越大遗忘越慢。
     * 每次真正被想起时按间隔重复系数增长；缺省时按 importance 推导
     */
    stability?: number;
    /**
     * 上一次"真正被想起"的时间（不是被检索扫过的时间）
     * —— 艾宾浩斯曲线的计时起点
     */
    lastReactivatedAt?: number;
    /** 由 R(t) 推导出的遗忘状态（运行时计算，仅用于展示/导出） */
    decayState?: MemoryDecayState;
}

/** 角色身份记忆 —— 独立于 MemoryEntry 便于直接读取 */
export interface IdentityMemory {
    /** 角色唯一标识 */
    role: string;
    /** 角色显示名 */
    displayName: string;
    /** system prompt 模板（每次对话都会注入） */
    systemPromptTemplate: string;
    /** 角色描述（可选，用于记忆系统自我认知） */
    personaDescription?: string;
    /** 记忆版本号 —— 用于检测修改 */
    version: number;
    /** 更新时间 */
    updatedAt: number;
}

/** 短期记忆快照 */
export interface ShortTermSnapshot {
    /** 该角色最近对话的滚动摘要 */
    summary: string;
    /** 覆盖的消息数量 */
    coveredMessageCount: number;
    /** 生成时间 */
    updatedAt: number;
}

/** 导入导出数据包 */
export interface MemoryExportPayload {
    /** 导出版本号 */
    schemaVersion: 1;
    /** 导出时间 */
    exportedAt: string;
    /** 所有角色的身份记忆 */
    identities: IdentityMemory[];
    /** 所有长期记忆条目 */
    entries: MemoryEntry[];
    /** 短期记忆快照 */
    shortTerm: Record<string, ShortTermSnapshot>;
}

/** 记忆检索结果 */
export interface MemoryQueryResult {
    /** 匹配的记忆条目 */
    entries: MemoryEntry[];
    /** 角色身份（如果有） */
    identity?: IdentityMemory;
    /** 短期记忆（如果有） */
    shortTerm?: ShortTermSnapshot;
    /** 最终拼接好的可直接注入 system prompt 的文本 */
    assembledContext: string;
}

/** 记忆存储接口 —— 抽象层，方便 mock 和替换 */
export interface MemoryStorageAdapter {
    /** 存储单条或批量记忆条目 */
    saveEntries(entries: MemoryEntry[]): Promise<void>;
    /** 按角色获取所有记忆条目 */
    listEntries(role: string): Promise<MemoryEntry[]>;
    /** 按 ID 删除记忆条目 */
    deleteEntry(id: string): Promise<void>;
    /** 按分类过滤列出 */
    listByCategory(role: string, category: MemoryCategory): Promise<MemoryEntry[]>;
    /** 获取角色身份记忆 */
    getIdentity(role: string): Promise<IdentityMemory | null>;
    /** 保存/更新角色身份记忆 */
    saveIdentity(identity: IdentityMemory): Promise<void>;
    /** 获取短期记忆快照 */
    getShortTerm(role: string): Promise<ShortTermSnapshot | null>;
    /** 保存短期记忆快照 */
    saveShortTerm(role: string, snapshot: ShortTermSnapshot): Promise<void>;
    /** 清除某角色所有记忆（用于"遗忘"） */
    clearRole(role: string): Promise<void>;
    /** 统计某角色记忆数量 */
    count(role: string): Promise<number>;
}

/** chrome.storage.local 的 key 前缀 */
export const MEMORY_STORAGE_PREFIX = "ai_memory::";

/** 构造记忆存储 key */
export const buildStorageKey = (type: string, role: string, extra?: string): string =>
    extra
        ? `${MEMORY_STORAGE_PREFIX}${type}::${role}::${extra}`
        : `${MEMORY_STORAGE_PREFIX}${type}::${role}`;
