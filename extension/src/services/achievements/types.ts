export type AchievementSource =
  | "popup"
  | "content"
  | "floatingball"
  | "sidepanel"
  | "options"
  | "devtools";

export type AchievementEventName =
  | "floatingball.open"
  | "floatingball.drag"
  | "spectrum.preview"
  | "selection.action.completed"
  | "bookmark.created"
  | "image.download.batch.completed";

export interface AchievementEvent {
  name: AchievementEventName;
  source: AchievementSource;
  at?: number;
  id?: string;
  meta?: Record<string, string | number | boolean>;
}

export type AchievementRarity = "discovery" | "exploration";

export interface AchievementDefinition {
  id: string;
  name: string;
  rarity: AchievementRarity;
  hint: string;
  description: string;
  source: string;
}

export interface AchievementState {
  version: 1;
  unlocked: Record<string, { unlockedAt: number }>;
  counters: Record<string, number>;
  sets: Record<string, string[]>;
  recent: Array<{ id: string; at: number }>;
  processedEvents: string[];
}

export interface AchievementProgress {
  current: number;
  target: number;
  complete: boolean;
}

export interface AchievementSnapshot {
  state: AchievementState;
  definitions: AchievementDefinition[];
  progress: Record<string, AchievementProgress>;
}

export type AchievementSubscriber = (
  snapshot: AchievementSnapshot,
  unlocked: AchievementDefinition[],
) => void;
