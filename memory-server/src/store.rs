//! SQLite 存储层：连接池管理、嵌入式迁移执行、三张表（identities / entries / short_term）的 CRUD。
//!
//! 约定：
//! - 查询使用 `sqlx::query`（运行时检查），避免编译期依赖数据库；
//! - 枚举与 TEXT 列互转走 models 层的 `as_str()` / `from_str()`；
//! - `MemoryEntry.decay_state` / `retention` 为运行时计算字段，不入库，读取时置 `None`。

use std::str::FromStr;

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteRow},
    Row, SqlitePool,
};

use crate::models::{IdentityMemory, MemoryCategory, MemoryEntry, MemoryImportance, ShortTermSnapshot};

/// entries 表完整列清单（供 SELECT 语句复用，顺序与建表一致）
const ENTRY_COLUMNS: &str = "id, role, category, content, importance, source, tags, \
                             created_at, last_accessed_at, access_count, stability, last_reactivated_at";

/// SQLite 记忆存储：内部持有连接池，可廉价克隆后跨任务共享
#[derive(Clone)]
pub struct SqliteMemoryStore {
    pool: SqlitePool,
}

impl SqliteMemoryStore {
    /// 基于既有连接池构造存储
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// 暴露内部连接池（供就绪探针等场景直接使用）
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// 按连接串建立连接池：自动建库、WAL 日志模式、开启外键约束
    pub async fn connect(database_url: &str) -> Result<SqlitePool, sqlx::Error> {
        let options = SqliteConnectOptions::from_str(database_url)?
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .foreign_keys(true);
        SqlitePoolOptions::new().connect_with(options).await
    }

    /// 执行 migrations/ 目录下的嵌入式迁移（新库从零建表，已有库幂等跳过）
    pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
        sqlx::migrate!("./migrations").run(pool).await
    }

    /// 批量写入记忆条目（INSERT OR REPLACE），整体在单个事务中提交
    pub async fn save_entries(&self, entries: &[MemoryEntry]) -> sqlx::Result<()> {
        let mut tx = self.pool.begin().await?;
        for entry in entries {
            // tags 序列化为 JSON 数组字符串；None 落 NULL
            let tags_json = entry
                .tags
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .map_err(|err| sqlx::Error::Encode(Box::new(err)))?;

            sqlx::query(&format!(
                "INSERT OR REPLACE INTO entries ({ENTRY_COLUMNS}) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ))
            .bind(&entry.id)
            .bind(&entry.role)
            .bind(entry.category.as_str())
            .bind(&entry.content)
            .bind(entry.importance.as_str())
            .bind(&entry.source)
            .bind(&tags_json)
            .bind(entry.created_at)
            .bind(entry.last_accessed_at)
            .bind(i64::from(entry.access_count))
            .bind(entry.stability)
            .bind(entry.last_reactivated_at)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await
    }

    /// 按 ID 读取单条记忆，不存在返回 None
    pub async fn get_entry(&self, id: &str) -> sqlx::Result<Option<MemoryEntry>> {
        let row = sqlx::query(&format!("SELECT {ENTRY_COLUMNS} FROM entries WHERE id = ?"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        row.as_ref().map(row_to_entry).transpose()
    }

    /// 列出某角色全部记忆条目，按创建时间倒序
    pub async fn list_entries(&self, role: &str) -> sqlx::Result<Vec<MemoryEntry>> {
        let rows = sqlx::query(&format!(
            "SELECT {ENTRY_COLUMNS} FROM entries WHERE role = ? ORDER BY created_at DESC"
        ))
        .bind(role)
        .fetch_all(&self.pool)
        .await?;
        rows.iter().map(row_to_entry).collect()
    }

    /// 按角色 + 类目过滤记忆条目，按创建时间倒序
    pub async fn list_by_category(
        &self,
        role: &str,
        category: MemoryCategory,
    ) -> sqlx::Result<Vec<MemoryEntry>> {
        let rows = sqlx::query(&format!(
            "SELECT {ENTRY_COLUMNS} FROM entries WHERE role = ? AND category = ? \
             ORDER BY created_at DESC"
        ))
        .bind(role)
        .bind(category.as_str())
        .fetch_all(&self.pool)
        .await?;
        rows.iter().map(row_to_entry).collect()
    }

    /// 删除单条记忆，返回是否实际删除（rows_affected > 0）
    pub async fn delete_entry(&self, id: &str) -> sqlx::Result<bool> {
        let result = sqlx::query("DELETE FROM entries WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// 读取角色身份记忆，不存在返回 None
    pub async fn get_identity(&self, role: &str) -> sqlx::Result<Option<IdentityMemory>> {
        let row = sqlx::query(
            "SELECT role, display_name, system_prompt_template, persona_description, version, updated_at \
             FROM identities WHERE role = ?",
        )
        .bind(role)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| {
            let version: i64 = row.get("version");
            IdentityMemory {
                role: row.get("role"),
                display_name: row.get("display_name"),
                system_prompt_template: row.get("system_prompt_template"),
                persona_description: row.get("persona_description"),
                version: version as u32,
                updated_at: row.get("updated_at"),
            }
        }))
    }

    /// 写入角色身份记忆（INSERT OR REPLACE，version 由调用方递增）
    pub async fn save_identity(&self, identity: &IdentityMemory) -> sqlx::Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO identities \
             (role, display_name, system_prompt_template, persona_description, version, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&identity.role)
        .bind(&identity.display_name)
        .bind(&identity.system_prompt_template)
        .bind(&identity.persona_description)
        .bind(i64::from(identity.version))
        .bind(identity.updated_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// 读取角色短期记忆快照，不存在返回 None
    pub async fn get_short_term(&self, role: &str) -> sqlx::Result<Option<ShortTermSnapshot>> {
        let row = sqlx::query(
            "SELECT summary, covered_message_count, updated_at FROM short_term WHERE role = ?",
        )
        .bind(role)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| {
            let covered: i64 = row.get("covered_message_count");
            ShortTermSnapshot {
                summary: row.get("summary"),
                covered_message_count: covered as u32,
                updated_at: row.get("updated_at"),
            }
        }))
    }

    /// 写入角色短期记忆快照（INSERT OR REPLACE）
    pub async fn save_short_term(
        &self,
        role: &str,
        snapshot: &ShortTermSnapshot,
    ) -> sqlx::Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO short_term (role, summary, covered_message_count, updated_at) \
             VALUES (?, ?, ?, ?)",
        )
        .bind(role)
        .bind(&snapshot.summary)
        .bind(i64::from(snapshot.covered_message_count))
        .bind(snapshot.updated_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// 清空某角色在三张表中的全部数据（单事务提交，避免半清空状态）
    pub async fn clear_role(&self, role: &str) -> sqlx::Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("DELETE FROM entries WHERE role = ?")
            .bind(role)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM identities WHERE role = ?")
            .bind(role)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM short_term WHERE role = ?")
            .bind(role)
            .execute(&mut *tx)
            .await?;
        tx.commit().await
    }

    /// 统计某角色的记忆条目数
    pub async fn count(&self, role: &str) -> sqlx::Result<i64> {
        let row = sqlx::query("SELECT COUNT(*) AS cnt FROM entries WHERE role = ?")
            .bind(role)
            .fetch_one(&self.pool)
            .await?;
        Ok(row.get::<i64, _>("cnt"))
    }

    /// 汇总三张表出现过的全部角色（UNION 去重后按字典序排序）
    pub async fn list_all_roles(&self) -> sqlx::Result<Vec<String>> {
        let rows = sqlx::query(
            "SELECT role FROM entries \
             UNION SELECT role FROM identities \
             UNION SELECT role FROM short_term \
             ORDER BY role",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.iter().map(|row| row.get::<String, _>("role")).collect())
    }
}

/// 将数据库行映射为 MemoryEntry；非法枚举值 / 非法 tags JSON 归为 Decode 错误
fn row_to_entry(row: &SqliteRow) -> sqlx::Result<MemoryEntry> {
    let category_raw: &str = row.get("category");
    let category = MemoryCategory::from_str(category_raw)
        .ok_or_else(|| sqlx::Error::Decode(format!("非法记忆类目: {category_raw}").into()))?;

    let importance_raw: &str = row.get("importance");
    let importance = MemoryImportance::from_str(importance_raw)
        .ok_or_else(|| sqlx::Error::Decode(format!("非法重要度: {importance_raw}").into()))?;

    // tags 列存 JSON 数组字符串，NULL 映射为 None
    let tags: Option<Vec<String>> = row
        .get::<Option<String>, _>("tags")
        .map(|raw| serde_json::from_str(&raw))
        .transpose()
        .map_err(|err| sqlx::Error::Decode(Box::new(err)))?;

    let access_count: i64 = row.get("access_count");

    Ok(MemoryEntry {
        id: row.get("id"),
        role: row.get("role"),
        category,
        content: row.get("content"),
        importance,
        source: row.get("source"),
        tags,
        created_at: row.get("created_at"),
        last_accessed_at: row.get("last_accessed_at"),
        access_count: access_count as u32,
        stability: row.get("stability"),
        last_reactivated_at: row.get("last_reactivated_at"),
        // 运行时计算字段，不入库
        decay_state: None,
        retention: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 构造内存库并完成迁移的测试存储
    ///
    /// 内存库每个连接独立，必须 max_connections(1) 保证同一连接复用同一数据库
    async fn test_store() -> SqliteMemoryStore {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("内存库连接失败");
        SqliteMemoryStore::run_migrations(&pool)
            .await
            .expect("内存库迁移失败");
        SqliteMemoryStore::new(pool)
    }

    /// 构造一条测试记忆条目（id / role / category / created_at 可定制，其余固定）
    fn make_entry(id: &str, role: &str, category: MemoryCategory, created_at: i64) -> MemoryEntry {
        MemoryEntry {
            id: id.to_string(),
            role: role.to_string(),
            category,
            content: format!("内容-{id}"),
            importance: MemoryImportance::High,
            source: Some("测试来源".to_string()),
            tags: Some(vec!["猫娘".to_string(), "测试".to_string()]),
            created_at,
            last_accessed_at: created_at,
            access_count: 1,
            stability: Some(720.0),
            last_reactivated_at: None,
            decay_state: None,
            retention: None,
        }
    }

    /// 构造测试用角色身份
    fn make_identity(role: &str, version: u32, updated_at: i64) -> IdentityMemory {
        IdentityMemory {
            role: role.to_string(),
            display_name: format!("角色-{role}"),
            system_prompt_template: "你是 {role}".to_string(),
            persona_description: Some("一只温柔的猫娘".to_string()),
            version,
            updated_at,
        }
    }

    /// 构造测试用短期快照
    fn make_snapshot(summary: &str, covered: u32, updated_at: i64) -> ShortTermSnapshot {
        ShortTermSnapshot {
            summary: summary.to_string(),
            covered_message_count: covered,
            updated_at,
        }
    }

    /// 覆盖条目写入、单查、列表倒序、类目过滤、INSERT OR REPLACE 覆盖与删除
    #[tokio::test]
    async fn entries_增查删与类目过滤() {
        let store = test_store().await;
        store
            .save_entries(&[
                make_entry("e1", "miku", MemoryCategory::Preference, 1000),
                make_entry("e2", "miku", MemoryCategory::Fact, 2000),
                make_entry("e3", "miku", MemoryCategory::Preference, 3000),
                make_entry("e4", "rin", MemoryCategory::Preference, 4000),
            ])
            .await
            .expect("批量写入失败");

        // 单查命中，tags 正确反序列化
        let got = store
            .get_entry("e1")
            .await
            .expect("单查失败")
            .expect("条目应当存在");
        assert_eq!(got.content, "内容-e1");
        assert_eq!(got.tags, Some(vec!["猫娘".to_string(), "测试".to_string()]));
        assert_eq!(got.source, Some("测试来源".to_string()));
        assert_eq!(got.stability, Some(720.0));
        // 运行时字段不入库
        assert_eq!(got.retention, None);

        // 列表按 created_at 倒序，且不串角色
        let list = store.list_entries("miku").await.expect("列表查询失败");
        let ids: Vec<&str> = list.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(ids, vec!["e3", "e2", "e1"]);

        // 类目过滤，同角色同类目按倒序
        let prefs = store
            .list_by_category("miku", MemoryCategory::Preference)
            .await
            .expect("类目查询失败");
        let ids: Vec<&str> = prefs.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(ids, vec!["e3", "e1"]);

        // INSERT OR REPLACE：同 id 覆盖写
        let mut replaced = make_entry("e1", "miku", MemoryCategory::Fact, 5000);
        replaced.content = "覆盖后的内容".to_string();
        replaced.tags = None;
        store
            .save_entries(std::slice::from_ref(&replaced))
            .await
            .expect("覆盖写失败");
        let got = store.get_entry("e1").await.expect("单查失败").unwrap();
        assert_eq!(got.content, "覆盖后的内容");
        assert_eq!(got.tags, None);
        assert_eq!(got.created_at, 5000);

        // 删除：存在返回 true，重复删除返回 false
        assert!(store.delete_entry("e1").await.expect("删除失败"));
        assert!(!store.delete_entry("e1").await.expect("重复删除失败"));
        assert!(store.get_entry("e1").await.expect("单查失败").is_none());
    }

    /// 覆盖身份 upsert 与读取（含 persona_description 置空覆盖）
    #[tokio::test]
    async fn identity_upsert与读取() {
        let store = test_store().await;
        assert!(store.get_identity("miku").await.expect("读取失败").is_none());

        let identity = make_identity("miku", 1, 1000);
        store.save_identity(&identity).await.expect("写入失败");
        let got = store
            .get_identity("miku")
            .await
            .expect("读取失败")
            .expect("身份应当存在");
        assert_eq!(got.display_name, "角色-miku");
        assert_eq!(got.persona_description, Some("一只温柔的猫娘".to_string()));
        assert_eq!(got.version, 1);
        assert_eq!(got.updated_at, 1000);

        // upsert：version 递增、persona_description 覆盖为 NULL
        let updated = IdentityMemory {
            version: 2,
            updated_at: 2000,
            persona_description: None,
            ..make_identity("miku", 2, 2000)
        };
        store.save_identity(&updated).await.expect("覆盖写失败");
        let got = store.get_identity("miku").await.expect("读取失败").unwrap();
        assert_eq!(got.version, 2);
        assert_eq!(got.updated_at, 2000);
        assert_eq!(got.persona_description, None);
    }

    /// 覆盖短期记忆快照写入与读取
    #[tokio::test]
    async fn short_term_读写() {
        let store = test_store().await;
        assert!(store.get_short_term("miku").await.expect("读取失败").is_none());

        let snapshot = make_snapshot("最近聊了猫和咖啡", 6, 1234);
        store
            .save_short_term("miku", &snapshot)
            .await
            .expect("写入失败");
        let got = store
            .get_short_term("miku")
            .await
            .expect("读取失败")
            .expect("快照应当存在");
        assert_eq!(got.summary, "最近聊了猫和咖啡");
        assert_eq!(got.covered_message_count, 6);
        assert_eq!(got.updated_at, 1234);

        // 覆盖写
        store
            .save_short_term("miku", &make_snapshot("新摘要", 10, 5678))
            .await
            .expect("覆盖写失败");
        let got = store.get_short_term("miku").await.expect("读取失败").unwrap();
        assert_eq!(got.summary, "新摘要");
        assert_eq!(got.covered_message_count, 10);
    }

    /// 覆盖三表 UNION 去重排序：只在单一表出现的角色也要列出
    #[tokio::test]
    async fn list_all_roles_三表并集去重() {
        let store = test_store().await;
        assert!(store.list_all_roles().await.expect("查询失败").is_empty());

        // 只出现在 entries 的角色
        store
            .save_entries(&[make_entry("e1", "role_entry", MemoryCategory::Fact, 1)])
            .await
            .expect("写入失败");
        // 只出现在 identities 的角色
        store
            .save_identity(&make_identity("role_identity", 1, 1))
            .await
            .expect("写入失败");
        // 只出现在 short_term 的角色
        store
            .save_short_term("role_short", &make_snapshot("s", 1, 1))
            .await
            .expect("写入失败");
        // 三表都出现的角色（验证去重）
        store
            .save_entries(&[make_entry("e2", "role_all", MemoryCategory::Fact, 1)])
            .await
            .expect("写入失败");
        store
            .save_identity(&make_identity("role_all", 1, 1))
            .await
            .expect("写入失败");
        store
            .save_short_term("role_all", &make_snapshot("s", 1, 1))
            .await
            .expect("写入失败");

        let roles = store.list_all_roles().await.expect("查询失败");
        assert_eq!(
            roles,
            vec!["role_all", "role_entry", "role_identity", "role_short"]
        );
    }

    /// 覆盖 clear_role 清空三表且不影响其他角色
    #[tokio::test]
    async fn clear_role_清空三表() {
        let store = test_store().await;
        store
            .save_entries(&[
                make_entry("e1", "miku", MemoryCategory::Fact, 1),
                make_entry("e2", "rin", MemoryCategory::Fact, 1),
            ])
            .await
            .expect("写入失败");
        store.save_identity(&make_identity("miku", 1, 1)).await.expect("写入失败");
        store.save_identity(&make_identity("rin", 1, 1)).await.expect("写入失败");
        store.save_short_term("miku", &make_snapshot("s", 1, 1)).await.expect("写入失败");
        store.save_short_term("rin", &make_snapshot("s", 1, 1)).await.expect("写入失败");

        store.clear_role("miku").await.expect("清空失败");
        assert!(store.list_entries("miku").await.expect("查询失败").is_empty());
        assert!(store.get_identity("miku").await.expect("查询失败").is_none());
        assert!(store.get_short_term("miku").await.expect("查询失败").is_none());

        // 其他角色不受影响
        assert_eq!(store.count("rin").await.expect("计数失败"), 1);
        assert!(store.get_identity("rin").await.expect("查询失败").is_some());
        assert!(store.get_short_term("rin").await.expect("查询失败").is_some());
    }

    /// 覆盖按角色统计条目数
    #[tokio::test]
    async fn count_按角色统计() {
        let store = test_store().await;
        assert_eq!(store.count("miku").await.expect("计数失败"), 0);

        store
            .save_entries(&[
                make_entry("a", "miku", MemoryCategory::Fact, 1),
                make_entry("b", "miku", MemoryCategory::Fact, 2),
                make_entry("c", "rin", MemoryCategory::Fact, 3),
            ])
            .await
            .expect("写入失败");
        assert_eq!(store.count("miku").await.expect("计数失败"), 2);
        assert_eq!(store.count("rin").await.expect("计数失败"), 1);
    }
}
