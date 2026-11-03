//! 艾宾浩斯遗忘曲线：保留率计算、三态判定、间隔重复稳定性增长。
//!
//! 与扩展端 `services/memory/decay.ts` 逐行对齐：
//! - 保留率 `R(t) = exp(-Δt / S)`，Δt 与 S 单位均为小时；
//! - 每次「真正被想起」时 `S ← min(S × growth, MAX_STABILITY_HOURS)`；
//! - critical 重要度与 identity 类目的记忆保留率下限 0.6，永不彻底遗忘。

use crate::models::{MemoryCategory, MemoryDecayState, MemoryEntry, MemoryImportance};

/// 1 小时对应的毫秒数
pub const HOUR_MS: f64 = 3_600_000.0;

/// 每次被想起时稳定性增长系数（间隔重复）
pub const REACTIVATION_GROWTH: f64 = 2.2;

/// 稳定性上限（小时）—— 约 2 年，避免无限膨胀
pub const MAX_STABILITY_HOURS: f64 = 17_520.0;

/// active 阈值：R >= 0.55 视为清晰记忆
pub const ACTIVE_THRESHOLD: f64 = 0.55;

/// forgotten 阈值：R < 0.2 视为已遗忘（不注入 prompt）
pub const FORGOTTEN_THRESHOLD: f64 = 0.2;

/// 豁免记忆的保留率下限 —— 保证永不落入 forgotten
pub const EXEMPT_RETENTION_FLOOR: f64 = 0.6;

/// 各重要度的初始稳定性（单位：小时）
pub fn initial_stability_hours(imp: MemoryImportance) -> f64 {
    match imp {
        // 365 天 —— 约等于永久
        MemoryImportance::Critical => 8_760.0,
        // 30 天
        MemoryImportance::High => 720.0,
        // 7 天
        MemoryImportance::Medium => 168.0,
        // 1 天
        MemoryImportance::Low => 24.0,
    }
}

/// 计算保留率的计时起点 —— 优先 last_reactivated_at，兼容旧数据
pub fn decay_anchor(e: &MemoryEntry) -> i64 {
    e.last_reactivated_at.unwrap_or(e.last_accessed_at)
}

/// 取得条目稳定性 S —— 缺省时按 importance 推导（兼容旧数据）
pub fn stability_of(e: &MemoryEntry) -> f64 {
    match e.stability {
        Some(s) if s > 0.0 => s,
        _ => initial_stability_hours(e.importance),
    }
}

/// 是否为豁免遗忘的记忆（critical 重要度 或 identity 类目）
pub fn is_exempt_from_forgetting(e: &MemoryEntry) -> bool {
    e.importance == MemoryImportance::Critical || e.category == MemoryCategory::Identity
}

/// 计算记忆保留率 R(t) ∈ (0, 1] —— 艾宾浩斯指数衰减
pub fn compute_retention(e: &MemoryEntry, now_ms: i64) -> f64 {
    let elapsed_hours = ((now_ms - decay_anchor(e)) as f64 / HOUR_MS).max(0.0);
    let retention = (-elapsed_hours / stability_of(e)).exp();
    // 豁免记忆保底，永不判为 forgotten
    if is_exempt_from_forgetting(e) {
        retention.max(EXEMPT_RETENTION_FLOOR)
    } else {
        retention
    }
}

/// 由保留率判定遗忘状态
pub fn classify_decay_state(e: &MemoryEntry, now_ms: i64) -> MemoryDecayState {
    let retention = compute_retention(e, now_ms);
    if retention >= ACTIVE_THRESHOLD {
        MemoryDecayState::Active
    } else if retention >= FORGOTTEN_THRESHOLD {
        MemoryDecayState::Fading
    } else {
        MemoryDecayState::Forgotten
    }
}

/// 复活/强化一条记忆 —— 间隔重复的核心
///
/// 调用时机：RAG 命中、用户再次提起、或被实际注入 prompt。
/// `growth` 为稳定性增长系数（默认 2.2；弱命中可传更小的值）。
pub fn reactivate_entry(e: &MemoryEntry, now_ms: i64, growth: f64) -> MemoryEntry {
    let next_stability = (stability_of(e) * growth).min(MAX_STABILITY_HOURS);
    let mut next = e.clone();
    next.stability = Some(next_stability);
    next.last_reactivated_at = Some(now_ms);
    next.last_accessed_at = now_ms;
    next.access_count = e.access_count + 1;
    next.decay_state = Some(MemoryDecayState::Active);
    next
}

/// 把旧数据补全为带遗忘字段的形状（不做写回，只用于计算）
pub fn normalize_entry(e: &MemoryEntry) -> MemoryEntry {
    let mut next = e.clone();
    next.stability = Some(stability_of(e));
    next.last_reactivated_at = Some(decay_anchor(e));
    next
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 构造测试条目：指定重要度与计时起点（last_accessed_at），其余字段取默认
    fn entry_with(importance: MemoryImportance, anchor_ms: i64) -> MemoryEntry {
        MemoryEntry {
            id: "t-1".to_string(),
            role: "miku".to_string(),
            category: MemoryCategory::Fact,
            content: "测试记忆".to_string(),
            importance,
            source: None,
            created_at: anchor_ms,
            last_accessed_at: anchor_ms,
            access_count: 0,
            tags: None,
            stability: None,
            last_reactivated_at: None,
            decay_state: None,
            retention: None,
        }
    }

    /// 初始稳定性推导：critical 8760 / high 720 / medium 168 / low 24
    #[test]
    fn 初始稳定性按重要度推导() {
        assert_eq!(initial_stability_hours(MemoryImportance::Critical), 8_760.0);
        assert_eq!(initial_stability_hours(MemoryImportance::High), 720.0);
        assert_eq!(initial_stability_hours(MemoryImportance::Medium), 168.0);
        assert_eq!(initial_stability_hours(MemoryImportance::Low), 24.0);

        // stability 缺省（None）时按 importance 回退推导
        let e = entry_with(MemoryImportance::High, 0);
        assert_eq!(stability_of(&e), 720.0);

        // stability 存在但为 0 时同样回退
        let mut e0 = e.clone();
        e0.stability = Some(0.0);
        assert_eq!(stability_of(&e0), 720.0);

        // stability 有效时直接使用
        let mut e1 = e.clone();
        e1.stability = Some(100.0);
        assert_eq!(stability_of(&e1), 100.0);
    }

    /// decay_anchor：last_reactivated_at 优先，否则 last_accessed_at
    #[test]
    fn 计时起点优先复活时间() {
        let mut e = entry_with(MemoryImportance::Medium, 1_000);
        assert_eq!(decay_anchor(&e), 1_000);
        e.last_reactivated_at = Some(2_000);
        assert_eq!(decay_anchor(&e), 2_000);
    }

    /// 三态边界：R 恰好跨越 0.55 / 0.2 时状态切换
    ///
    /// R = exp(-Δt/S)，取 medium（S=168h）：
    /// - Δt = -ln(0.55)×168 ≈ 100.4h 时 R = 0.55（active 边界）
    /// - Δt = -ln(0.2)×168 ≈ 270.3h 时 R = 0.2（fading/forgotten 边界）
    #[test]
    fn 三态边界判定() {
        let now: i64 = 1_700_000_000_000;
        let s_ms = (168.0 * HOUR_MS) as i64;
        let anchor = now; // anchor 与 now 的差由下方构造

        // R 略大于 0.55 → active
        let dt_active = (-(0.56_f64.ln()) * s_ms as f64) as i64;
        let mut e = entry_with(MemoryImportance::Medium, anchor - dt_active);
        assert_eq!(classify_decay_state(&e, now), MemoryDecayState::Active);

        // R 恰好 0.55（取 Δt 略小于临界值，保证 >= 阈值）→ active
        let dt_edge = (-(0.55_f64.ln()) * s_ms as f64) as i64;
        e.last_accessed_at = now - dt_edge + 1;
        assert_eq!(classify_decay_state(&e, now), MemoryDecayState::Active);

        // R 介于 0.2 与 0.55 之间 → fading
        let dt_fading = (-(0.3_f64.ln()) * s_ms as f64) as i64;
        e.last_accessed_at = now - dt_fading;
        assert_eq!(classify_decay_state(&e, now), MemoryDecayState::Fading);

        // R 恰好 0.2 边界内侧 → fading（>= 0.2）
        let dt_edge2 = (-(0.2_f64.ln()) * s_ms as f64) as i64;
        e.last_accessed_at = now - dt_edge2 + 1;
        assert_eq!(classify_decay_state(&e, now), MemoryDecayState::Fading);

        // R 小于 0.2 → forgotten
        let dt_gone = (-(0.1_f64.ln()) * s_ms as f64) as i64;
        e.last_accessed_at = now - dt_gone;
        assert_eq!(classify_decay_state(&e, now), MemoryDecayState::Forgotten);
    }

    /// 豁免通道：critical 重要度或 identity 类目，保留率永不低于 0.6
    #[test]
    fn 豁免记忆保留率保底() {
        let now: i64 = 1_700_000_000_000;
        // 一万年前，普通记忆早已遗忘
        let ancient = now - (10_000.0 * 365.0 * 24.0 * HOUR_MS) as i64;

        // critical 重要度豁免
        let e = entry_with(MemoryImportance::Critical, ancient);
        assert!(is_exempt_from_forgetting(&e));
        assert!(compute_retention(&e, now) >= EXEMPT_RETENTION_FLOOR);
        assert_ne!(classify_decay_state(&e, now), MemoryDecayState::Forgotten);

        // identity 类目豁免（即使重要度只有 low）
        let mut e2 = entry_with(MemoryImportance::Low, ancient);
        e2.category = MemoryCategory::Identity;
        assert!(is_exempt_from_forgetting(&e2));
        assert!(compute_retention(&e2, now) >= EXEMPT_RETENTION_FLOOR);
        assert_eq!(classify_decay_state(&e2, now), MemoryDecayState::Active);

        // 非豁免记忆没有保底
        let e3 = entry_with(MemoryImportance::Low, ancient);
        assert!(!is_exempt_from_forgetting(&e3));
        assert!(compute_retention(&e3, now) < FORGOTTEN_THRESHOLD);
    }

    /// 复活：S × 2.2 增长，且不超过 17520 上限
    #[test]
    fn 复活增长稳定性() {
        let now: i64 = 1_700_000_000_000;
        // 普通增长：720 × 2.2 = 1584
        let e = entry_with(MemoryImportance::High, now - 1_000);
        let r = reactivate_entry(&e, now, REACTIVATION_GROWTH);
        assert_eq!(r.stability, Some(720.0 * 2.2));

        // 上限截断：8760 × 2.2 = 19272 → 截到 17520
        let e2 = entry_with(MemoryImportance::Critical, now - 1_000);
        let r2 = reactivate_entry(&e2, now, REACTIVATION_GROWTH);
        assert_eq!(r2.stability, Some(MAX_STABILITY_HOURS));

        // 已达上限时不再增长
        let mut e3 = entry_with(MemoryImportance::High, now - 1_000);
        e3.stability = Some(MAX_STABILITY_HOURS);
        let r3 = reactivate_entry(&e3, now, REACTIVATION_GROWTH);
        assert_eq!(r3.stability, Some(MAX_STABILITY_HOURS));
    }

    /// 复活：accessCount + 1，计时起点与访问时间重置为 now，状态回到 active
    #[test]
    fn 复活重置计时与计数() {
        let now: i64 = 1_700_000_000_000;
        let mut e = entry_with(MemoryImportance::Medium, now - 999_999_999);
        e.access_count = 7;
        e.decay_state = Some(MemoryDecayState::Forgotten);

        let r = reactivate_entry(&e, now, REACTIVATION_GROWTH);
        assert_eq!(r.access_count, 8);
        assert_eq!(r.last_reactivated_at, Some(now));
        assert_eq!(r.last_accessed_at, now);
        assert_eq!(r.decay_state, Some(MemoryDecayState::Active));
        // 复活后保留率回到 1（Δt = 0）
        assert!((compute_retention(&r, now) - 1.0).abs() < 1e-9);
    }

    /// normalize_entry：补全 stability 与 last_reactivated_at，不改其他字段
    #[test]
    fn 补全旧数据遗忘字段() {
        let e = entry_with(MemoryImportance::Low, 42_000);
        let n = normalize_entry(&e);
        assert_eq!(n.stability, Some(24.0));
        assert_eq!(n.last_reactivated_at, Some(42_000));
        assert_eq!(n.content, e.content);

        // 已有字段不被覆盖
        let mut e2 = e.clone();
        e2.stability = Some(99.0);
        e2.last_reactivated_at = Some(50_000);
        let n2 = normalize_entry(&e2);
        assert_eq!(n2.stability, Some(99.0));
        assert_eq!(n2.last_reactivated_at, Some(50_000));
    }

    /// 未来时间戳不产生负 Δt（max(0, …) 保护）
    #[test]
    fn 未来时间不产生负衰减() {
        let now: i64 = 1_700_000_000_000;
        let e = entry_with(MemoryImportance::Medium, now + 1_000_000);
        assert!((compute_retention(&e, now) - 1.0).abs() < 1e-9);
    }
}
