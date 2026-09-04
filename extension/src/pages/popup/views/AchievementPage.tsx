import React, { useEffect, useState } from "react";
import {
  CheckCircleOutlined,
  LockOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import TableContainer from "../components/TableContainer";
import {
  achievements,
  type AchievementSnapshot,
} from "@/services/achievements";
import "./achievement-page.scss";

const RARITY_LABELS = {
  discovery: "发现",
  exploration: "探索",
} as const;

const AchievementPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<AchievementSnapshot | null>(null);

  useEffect(() => achievements.subscribe((next) => setSnapshot(next)), []);

  const definitions = snapshot?.definitions ?? [];
  const unlocked = snapshot
    ? Object.keys(snapshot.state.unlocked).length
    : 0;

  return (
    <TableContainer
      density="compact"
      sectionGap="8px"
      contentGap="8px"
      heroGap="8px"
      rightMaxWidth="88px"
      headLeft={
        <>
          <p className="section-kicker">Hidden Deck</p>
          <h2 className="section-title">隐藏成就</h2>
          <p className="section-subtitle">探索插件时偶尔会亮起的小彩蛋。</p>
        </>
      }
      headRight={
        <div className="achievement-total" aria-label={`已解锁 ${unlocked} 个成就`}>
          <TrophyOutlined />
          <strong>{unlocked}</strong>
          <span>/ {definitions.length || "-"}</span>
        </div>
      }
    >
      <section className="achievement-list" aria-label="成就列表">
        {definitions.map((definition) => {
          const progress = snapshot?.progress[definition.id];
          const unlockedAt = snapshot?.state.unlocked[definition.id]?.unlockedAt;
          const isUnlocked = Boolean(unlockedAt);
          const current = progress?.current ?? 0;
          const target = progress?.target ?? 1;

          return (
            <article
              className={`achievement-item${isUnlocked ? " is-unlocked" : ""}`}
              key={definition.id}
            >
              <div className="achievement-icon" aria-hidden="true">
                {isUnlocked ? <CheckCircleOutlined /> : <LockOutlined />}
              </div>
              <div className="achievement-copy">
                <div className="achievement-heading">
                  <strong>{definition.name}</strong>
                  <span>{RARITY_LABELS[definition.rarity]}</span>
                </div>
                <p>{isUnlocked ? definition.description : definition.hint}</p>
                <div className="achievement-progress" aria-label={`进度 ${current} / ${target}`}>
                  <span style={{ width: `${Math.min(100, (current / target) * 100)}%` }} />
                </div>
              </div>
              <time dateTime={unlockedAt ? new Date(unlockedAt).toISOString() : undefined}>
                {isUnlocked ? "已解锁" : `${current} / ${target}`}
              </time>
            </article>
          );
        })}
      </section>
    </TableContainer>
  );
};

export default AchievementPage;
