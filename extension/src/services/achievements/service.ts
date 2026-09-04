import { storage } from "@/stores";
import {
  ACHIEVEMENT_DEFINITIONS,
  applyAchievementEvent,
  createInitialAchievementState,
  getAchievementProgress,
  isAchievementComplete,
} from "./catalog";
import type {
  AchievementDefinition,
  AchievementEvent,
  AchievementSnapshot,
  AchievementState,
  AchievementSubscriber,
} from "./types";

export const ACHIEVEMENTS_STORAGE_KEY = "kria-nove:achievements:v1";

const EVENT_DEDUPE_LIMIT = 100;
const VALID_EVENT_NAMES = new Set([
  "floatingball.open",
  "floatingball.drag",
  "spectrum.preview",
  "selection.action.completed",
  "bookmark.created",
  "image.download.batch.completed",
]);
const VALID_SOURCES = new Set([
  "popup",
  "content",
  "floatingball",
  "sidepanel",
  "options",
  "devtools",
]);

const cloneState = (state: AchievementState): AchievementState => ({
  ...state,
  unlocked: { ...state.unlocked },
  counters: { ...state.counters },
  sets: Object.fromEntries(
    Object.entries(state.sets).map(([key, values]) => [key, [...values]]),
  ),
  recent: [...state.recent],
  processedEvents: [...state.processedEvents],
});

const normalizeState = (value: unknown): AchievementState => {
  const initial = createInitialAchievementState();
  if (!value || typeof value !== "object") return initial;
  const candidate = value as Partial<AchievementState>;
  const rawSets = candidate.sets && typeof candidate.sets === "object"
    ? candidate.sets
    : {};
  const sets = Object.fromEntries(
    Object.entries(rawSets).map(([key, values]) => [
      key,
      Array.isArray(values)
        ? values.filter((item): item is string => typeof item === "string")
        : [],
    ]),
  );
  return {
    version: 1,
    unlocked: candidate.unlocked && typeof candidate.unlocked === "object" ? candidate.unlocked : {},
    counters: candidate.counters && typeof candidate.counters === "object" ? candidate.counters : {},
    sets,
    recent: Array.isArray(candidate.recent) ? candidate.recent.slice(0, 30) : [],
    processedEvents: Array.isArray(candidate.processedEvents)
      ? candidate.processedEvents.slice(-EVENT_DEDUPE_LIMIT)
      : [],
  };
};

const canUseChromeStorage = () =>
  typeof chrome !== "undefined" && !!chrome.storage?.local;

const readState = async (): Promise<AchievementState> => {
  try {
    if (canUseChromeStorage()) {
      return normalizeState(
        await storage.ext.local.get(ACHIEVEMENTS_STORAGE_KEY, null),
      );
    }
  } catch (error) {
    maLogger.warn("读取成就状态失败，尝试页面存储:", error);
  }

  try {
    if (typeof localStorage !== "undefined") {
      return normalizeState(
        JSON.parse(localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY) ?? "null"),
      );
    }
  } catch (error) {
    maLogger.warn("读取页面成就状态失败:", error);
  }
  return createInitialAchievementState();
};

const writeState = async (state: AchievementState): Promise<void> => {
  try {
    if (canUseChromeStorage()) {
      await storage.ext.local.set(ACHIEVEMENTS_STORAGE_KEY, state);
      return;
    }
  } catch (error) {
    maLogger.warn("写入成就状态失败，尝试页面存储:", error);
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(state));
    }
  } catch (error) {
    maLogger.warn("写入页面成就状态失败:", error);
  }
};

class AchievementService {
  private state: AchievementState | null = null;
  private loadPromise: Promise<AchievementState> | null = null;
  private operationQueue: Promise<unknown> = Promise.resolve();
  private subscribers = new Set<AchievementSubscriber>();
  private storageListenerInstalled = false;

  private async ensureLoaded(): Promise<AchievementState> {
    if (this.state) return this.state;
    this.loadPromise ??= readState().then((state) => {
      this.state = state;
      this.installStorageListener();
      return state;
    });
    return this.loadPromise;
  }

  private installStorageListener(): void {
    if (this.storageListenerInstalled || !canUseChromeStorage()) return;
    const onChanged = chrome.storage.onChanged;
    if (!onChanged?.addListener) return;
    onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[ACHIEVEMENTS_STORAGE_KEY]?.newValue) {
        return;
      }
      this.state = normalizeState(changes[ACHIEVEMENTS_STORAGE_KEY].newValue);
      this.notify([]);
    });
    this.storageListenerInstalled = true;
  }

  private snapshot(state: AchievementState): AchievementSnapshot {
    return {
      state: cloneState(state),
      definitions: [...ACHIEVEMENT_DEFINITIONS],
      progress: getAchievementProgress(state),
    };
  }

  private notify(unlocked: AchievementDefinition[]): void {
    if (!this.state) return;
    const snapshot = this.snapshot(this.state);
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(snapshot, unlocked);
      } catch (error) {
        maLogger.warn("成就订阅回调失败:", error);
      }
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.catch(() => undefined);
    return result;
  }

  async getSnapshot(): Promise<AchievementSnapshot> {
    return this.enqueue(async () => this.snapshot(await this.ensureLoaded()));
  }

  async track(event: AchievementEvent): Promise<AchievementDefinition[]> {
    return this.enqueue(async () => {
      if (!VALID_SOURCES.has(event.source) || !VALID_EVENT_NAMES.has(event.name)) {
        return [];
      }
      const state = await this.ensureLoaded();
      if (event.id && state.processedEvents.includes(event.id)) return [];

      if (event.id) {
        state.processedEvents = [
          ...state.processedEvents.filter((id) => id !== event.id),
          event.id,
        ].slice(-EVENT_DEDUPE_LIMIT);
      }

      const previous = cloneState(state);
      this.state = applyAchievementEvent(state, event);
      const unlocked = ACHIEVEMENT_DEFINITIONS.filter(
        (definition) =>
          !previous.unlocked[definition.id] &&
          isAchievementComplete(definition.id, this.state as AchievementState),
      );

      if (unlocked.length) {
        const unlockedAt = event.at ?? Date.now();
        unlocked.forEach((definition) => {
          (this.state as AchievementState).unlocked[definition.id] = {
            unlockedAt,
          };
        });
      }

      await writeState(this.state as AchievementState);
      this.notify(unlocked);
      return unlocked;
    });
  }

  subscribe(subscriber: AchievementSubscriber): () => void {
    this.subscribers.add(subscriber);
    void this.getSnapshot().then((snapshot) => subscriber(snapshot, []));
    return () => this.subscribers.delete(subscriber);
  }

  async reset(): Promise<void> {
    return this.enqueue(async () => {
      this.state = createInitialAchievementState();
      await writeState(this.state);
      this.notify([]);
    });
  }

  async getStateForTesting(): Promise<AchievementState> {
    return cloneState(await this.ensureLoaded());
  }
}

export const achievements = new AchievementService();
export type { AchievementSnapshot, AchievementState } from "./types";
