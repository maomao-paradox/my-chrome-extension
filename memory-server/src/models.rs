//! 领域模型定义：与浏览器扩展端 TS 版（services/memory/types.ts）完全兼容。
//!
//! 约定：
//! - 全部结构体 serde `rename_all = "camelCase"`，枚举 `rename_all = "lowercase"`；
//! - Option 字段均 `skip_serializing_if = "Option::is_none"`，与 TS 可选字段语义一致；
//! - 时间戳统一为 i64 毫秒（对应 TS 的 `Date.now()`）。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use rand::Rng;

/// 记忆条目等级 —— 用于检索时的权重
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryImportance {
    Low,
    Medium,
    High,
    Critical,
}

impl MemoryImportance {
    /// 转为 SQLite TEXT 存储用的字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::Critical => "critical",
        }
    }

    /// 从 SQLite TEXT 字符串解析
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "low" => Some(Self::Low),
            "medium" => Some(Self::Medium),
            "high" => Some(Self::High),
            "critical" => Some(Self::Critical),
            _ => None,
        }
    }
}

/// 记忆类型分类
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryCategory {
    Identity,
    Conversation,
    Preference,
    Fact,
    Episodic,
}

impl MemoryCategory {
    /// 转为 SQLite TEXT 存储用的字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Identity => "identity",
            Self::Conversation => "conversation",
            Self::Preference => "preference",
            Self::Fact => "fact",
            Self::Episodic => "episodic",
        }
    }

    /// 从 SQLite TEXT 字符串解析
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "identity" => Some(Self::Identity),
            "conversation" => Some(Self::Conversation),
            "preference" => Some(Self::Preference),
            "fact" => Some(Self::Fact),
            "episodic" => Some(Self::Episodic),
            _ => None,
        }
    }
}

/// 遗忘状态 —— 由艾宾浩斯保留率 R(t) 推导，决定是否进入 prompt
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryDecayState {
    Active,
    Fading,
    Forgotten,
}

/// 单条长期记忆
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    /// 唯一 ID（毫秒时间戳 base36 + 随机后缀）
    pub id: String,
    /// 归属角色
    pub role: String,
    /// 记忆分类
    pub category: MemoryCategory,
    /// 记忆内容（自然语言文本）
    pub content: String,
    /// 重要程度
    pub importance: MemoryImportance,
    /// 来源摘要（从哪段对话提取）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// 创建时间戳（毫秒）
    pub created_at: i64,
    /// 最后访问时间戳（毫秒，用于 LRU 排序）
    pub last_accessed_at: i64,
    /// 访问次数
    pub access_count: u32,
    /// 可选标签，用于主题聚类
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    /// 记忆稳定性 S（单位：小时），越大遗忘越慢；缺省时按 importance 推导
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stability: Option<f64>,
    /// 上一次「真正被想起」的时间 —— 艾宾浩斯曲线的计时起点
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_reactivated_at: Option<i64>,
    /// 运行时计算的遗忘状态（仅展示/导出）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decay_state: Option<MemoryDecayState>,
    /// 运行时计算的保留率（仅 API 响应用，不入库）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retention: Option<f64>,
}

/// 角色身份记忆 —— 独立于 MemoryEntry 便于直接读取
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityMemory {
    /// 角色唯一标识
    pub role: String,
    /// 角色显示名
    pub display_name: String,
    /// system prompt 模板（每次对话都会注入）
    pub system_prompt_template: String,
    /// 角色描述（可选，用于记忆系统自我认知）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persona_description: Option<String>,
    /// 记忆版本号 —— 用于检测修改
    pub version: u32,
    /// 更新时间（毫秒）
    pub updated_at: i64,
}

/// 短期记忆快照
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortTermSnapshot {
    /// 该角色最近对话的滚动摘要
    pub summary: String,
    /// 覆盖的消息数量
    pub covered_message_count: u32,
    /// 生成时间（毫秒）
    pub updated_at: i64,
}

/// 导入导出数据包（schemaVersion: 1，与扩展端备份文件兼容）
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryExportPayload {
    /// 导出版本号
    pub schema_version: u32,
    /// 导出时间（ISO 字符串）
    pub exported_at: String,
    /// 所有角色的身份记忆
    pub identities: Vec<IdentityMemory>,
    /// 所有长期记忆条目
    pub entries: Vec<MemoryEntry>,
    /// 短期记忆快照（按角色键控）
    pub short_term: HashMap<String, ShortTermSnapshot>,
}

/// 记忆检索结果
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryQueryResult {
    /// 匹配的记忆条目
    pub entries: Vec<MemoryEntry>,
    /// 角色身份（如果有）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<IdentityMemory>,
    /// 短期记忆（如果有）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_term: Option<ShortTermSnapshot>,
    /// 最终拼接好的可直接注入 system prompt 的文本
    pub assembled_context: String,
}

/// PATCH /entries/{id} 局部更新体（全字段可选）
#[derive(Clone, PartialEq, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub importance: Option<MemoryImportance>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<MemoryCategory>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

/// 导入模式
#[derive(Clone, Copy, PartialEq, Eq, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportMode {
    Merge,
    Replace,
}

/// 导入结果统计
#[derive(Clone, PartialEq, Eq, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub identities_imported: usize,
    pub entries_imported: usize,
    pub short_term_imported: usize,
    pub roles_cleared: usize,
    pub roles_imported: Vec<String>,
}

/// 聊天消息（短期记忆自动摘要输入）
#[derive(Clone, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// 短期记忆写入输入：直接给摘要，或给消息列表自动生成摘要
#[derive(Clone, PartialEq, Debug, Deserialize)]
#[serde(untagged)]
pub enum ShortTermInput {
    /// 直接写入摘要
    Direct {
        summary: String,
        #[serde(rename = "coveredMessageCount")]
        covered_message_count: u32,
    },
    /// 从消息列表自动生成摘要
    Messages { messages: Vec<ChatMessage> },
}

/// 当前时间的毫秒时间戳（对应 TS `Date.now()`）
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// u64 转 base36 字符串（0-9a-z）
fn to_base36(mut n: u64) -> String {
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 {
        return "0".to_string();
    }
    let mut buf = Vec::new();
    while n > 0 {
        buf.push(DIGITS[(n % 36) as usize]);
        n /= 36;
    }
    buf.reverse();
    String::from_utf8(buf).expect("base36 字符均为合法 ASCII")
}

/// 生成记忆条目 ID：`{毫秒时间戳的base36}-{8位随机base36}`
pub fn generate_memory_id() -> String {
    let ts = to_base36(now_ms() as u64);
    // 取一个随机 u64，按 base36 编码后低位对齐截 8 位，不足补 0
    let mut rng = rand::rng();
    let rand_part: u64 = rng.random();
    let mut suffix = to_base36(rand_part);
    if suffix.len() > 8 {
        suffix.truncate(8);
    } else {
        while suffix.len() < 8 {
            suffix.insert(0, '0');
        }
    }
    format!("{ts}-{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 构造一个最小可用的测试条目
    fn sample_entry() -> MemoryEntry {
        MemoryEntry {
            id: "abc-123".to_string(),
            role: "miku".to_string(),
            category: MemoryCategory::Preference,
            content: "主人喜欢猫".to_string(),
            importance: MemoryImportance::High,
            source: None,
            created_at: 1_700_000_000_000,
            last_accessed_at: 1_700_000_000_000,
            access_count: 1,
            tags: None,
            stability: Some(720.0),
            last_reactivated_at: None,
            decay_state: None,
            retention: None,
        }
    }

    /// camelCase 序列化：字段名与扩展端 JSON 形状一致（createdAt / accessCount ...）
    #[test]
    fn 序列化字段名为camelCase() {
        let entry = sample_entry();
        let v = serde_json::to_value(&entry).unwrap();
        assert!(v.get("createdAt").is_some());
        assert!(v.get("lastAccessedAt").is_some());
        assert!(v.get("accessCount").is_some());
        assert_eq!(v["category"], "preference");
        assert_eq!(v["importance"], "high");
        // 下划线命名的旧键不应出现
        assert!(v.get("created_at").is_none());
    }

    /// Option 为 None 时序列化应省略该字段（对齐 TS 可选字段语义）
    #[test]
    fn none字段序列化时省略() {
        let entry = sample_entry();
        let v = serde_json::to_value(&entry).unwrap();
        assert!(v.get("source").is_none());
        assert!(v.get("tags").is_none());
        assert!(v.get("lastReactivatedAt").is_none());
        assert!(v.get("decayState").is_none());
        assert!(v.get("retention").is_none());
        // stability 有值则保留
        assert!(v.get("stability").is_some());
    }

    /// 扩展端 JSON 形状可直接反序列化为 MemoryEntry
    #[test]
    fn 兼容扩展端JSON反序列化() {
        let json = r#"{
            "id": "abc-123",
            "role": "miku",
            "category": "fact",
            "content": "主人在用 Ubuntu 22.04",
            "importance": "medium",
            "createdAt": 1700000000000,
            "lastAccessedAt": 1700000000000,
            "accessCount": 3
        }"#;
        let entry: MemoryEntry = serde_json::from_str(json).unwrap();
        assert_eq!(entry.category, MemoryCategory::Fact);
        assert_eq!(entry.importance, MemoryImportance::Medium);
        assert_eq!(entry.created_at, 1_700_000_000_000);
        assert!(entry.source.is_none());
        assert!(entry.stability.is_none());
    }

    /// 身份记忆 / 导出载荷的 camelCase 形状
    #[test]
    fn 导出载荷字段名为camelCase() {
        let payload = MemoryExportPayload {
            schema_version: 1,
            exported_at: "2026-11-03T00:00:00.000Z".to_string(),
            identities: vec![IdentityMemory {
                role: "miku".to_string(),
                display_name: "初音未来".to_string(),
                system_prompt_template: "你是……".to_string(),
                persona_description: None,
                version: 1,
                updated_at: 1_700_000_000_000,
            }],
            entries: vec![],
            short_term: HashMap::new(),
        };
        let v = serde_json::to_value(&payload).unwrap();
        assert!(v.get("schemaVersion").is_some());
        assert!(v.get("exportedAt").is_some());
        assert!(v.get("shortTerm").is_some());
        let id = &v["identities"][0];
        assert!(id.get("displayName").is_some());
        assert!(id.get("systemPromptTemplate").is_some());
        assert!(id.get("updatedAt").is_some());
        assert!(id.get("personaDescription").is_none());

        // 反向解析扩展端备份形状
        let text = serde_json::to_string(&payload).unwrap();
        let back: MemoryExportPayload = serde_json::from_str(&text).unwrap();
        assert_eq!(back.schema_version, 1);
        assert_eq!(back.identities.len(), 1);
    }

    /// as_str / from_str 往返一致
    #[test]
    fn 字符串映射往返() {
        for imp in [
            MemoryImportance::Low,
            MemoryImportance::Medium,
            MemoryImportance::High,
            MemoryImportance::Critical,
        ] {
            assert_eq!(MemoryImportance::from_str(imp.as_str()), Some(imp));
        }
        for cat in [
            MemoryCategory::Identity,
            MemoryCategory::Conversation,
            MemoryCategory::Preference,
            MemoryCategory::Fact,
            MemoryCategory::Episodic,
        ] {
            assert_eq!(MemoryCategory::from_str(cat.as_str()), Some(cat));
        }
        // 非法值返回 None
        assert_eq!(MemoryImportance::from_str("urgent"), None);
        assert_eq!(MemoryCategory::from_str("unknown"), None);
    }

    /// ShortTermInput untagged：两种形态均可反序列化
    #[test]
    fn 短期输入两种形态() {
        let direct: ShortTermInput =
            serde_json::from_str(r#"{"summary": "聊了猫", "coveredMessageCount": 4}"#).unwrap();
        match direct {
            ShortTermInput::Direct {
                summary,
                covered_message_count,
            } => {
                assert_eq!(summary, "聊了猫");
                assert_eq!(covered_message_count, 4);
            }
            _ => panic!("应为 Direct 形态"),
        }

        let msgs: ShortTermInput = serde_json::from_str(
            r#"{"messages": [{"role": "user", "content": "你好"}, {"role": "assistant", "content": "喵"}]}"#,
        )
        .unwrap();
        match msgs {
            ShortTermInput::Messages { messages } => {
                assert_eq!(messages.len(), 2);
                assert_eq!(messages[0].role, "user");
            }
            _ => panic!("应为 Messages 形态"),
        }
    }

    /// generate_memory_id：格式 `{base36时间戳}-{8位base36}`，且两次生成不重复
    #[test]
    fn 生成ID格式正确() {
        let id1 = generate_memory_id();
        let id2 = generate_memory_id();
        let parts: Vec<&str> = id1.split('-').collect();
        assert_eq!(parts.len(), 2, "ID 应包含一个连字符: {id1}");
        assert!(!parts[0].is_empty());
        assert_eq!(parts[1].len(), 8);
        // 全部字符均为 base36
        assert!(id1
            .chars()
            .all(|c| c == '-' || c.is_ascii_digit() || ('a'..='z').contains(&c)));
        assert_ne!(id1, id2, "连续生成的 ID 不应重复");
    }

    /// now_ms 返回合理的毫秒时间戳（大于 2024-01-01）
    #[test]
    fn 当前时间戳为毫秒() {
        assert!(now_ms() > 1_704_067_200_000);
    }
}
