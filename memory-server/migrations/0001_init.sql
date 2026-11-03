-- 记忆系统初始化迁移：identities / entries / short_term 三张表
-- 时间戳统一为毫秒整数（与扩展端 Date.now() 语义一致）

-- 角色身份记忆：角色名为主键，version 随每次 upsert 递增
CREATE TABLE IF NOT EXISTS identities (
    role TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    system_prompt_template TEXT NOT NULL DEFAULT '',
    persona_description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
);

-- 长期记忆条目：tags 以 JSON 数组字符串存储
-- decay_state / retention 为运行时计算字段，不入库
CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    importance TEXT NOT NULL,
    source TEXT,
    tags TEXT,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 1,
    stability REAL,
    last_reactivated_at INTEGER
);

-- 检索常用路径索引：按角色、角色+类目、角色+创建时间
CREATE INDEX IF NOT EXISTS idx_entries_role ON entries(role);
CREATE INDEX IF NOT EXISTS idx_entries_role_category ON entries(role, category);
CREATE INDEX IF NOT EXISTS idx_entries_role_created ON entries(role, created_at);

-- 短期记忆快照：每个角色一行
CREATE TABLE IF NOT EXISTS short_term (
    role TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    covered_message_count INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
