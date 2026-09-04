import type {
  AchievementDefinition,
  AchievementEvent,
  AchievementProgress,
  AchievementState,
} from "./types";

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first-contact",
    name: "初次接触",
    rarity: "discovery",
    hint: "先找到一个能跟着你走的东西。",
    description: "打开浮动球，并把它拖过一段距离。",
    source: "浮动球",
  },
  {
    id: "spectrum-collector",
    name: "频谱收藏家",
    rarity: "exploration",
    hint: "四种颜色，缺一不可。",
    description: "预览全部四种光谱效果。",
    source: "光谱效应",
  },
  {
    id: "text-alchemist",
    name: "文本炼金术",
    rarity: "exploration",
    hint: "复制只是开始。",
    description: "在选中文本工具中完成四种不同操作。",
    source: "文本工具栏",
  },
  {
    id: "bookmark-archaeologist",
    name: "书签考古学家",
    rarity: "exploration",
    hint: "让未来的你找得到今天的线索。",
    description: "创建 10 条片段书签，且来自至少 3 个站点。",
    source: "书签",
  },
  {
    id: "image-quartermaster",
    name: "图片军需官",
    rarity: "discovery",
    hint: "把页面上的图像整齐带走。",
    description: "成功打包下载一次包含至少 5 张图片的 ZIP。",
    source: "图片下载",
  },
];

export const getAchievementDefinition = (id: string) =>
  ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === id);

export const createInitialAchievementState = (): AchievementState => ({
  version: 1,
  unlocked: {},
  counters: {},
  sets: {},
  recent: [],
  processedEvents: [],
});

const count = (state: AchievementState, key: string) => state.counters[key] ?? 0;
const setSize = (state: AchievementState, key: string) => state.sets[key]?.length ?? 0;

export const getAchievementProgress = (
  state: AchievementState,
): Record<string, AchievementProgress> => ({
  "first-contact": {
    current:
      (count(state, "floatingball.opens") > 0 ? 1 : 0) +
      (count(state, "floatingball.drags") > 0 ? 1 : 0),
    target: 2,
    complete:
      count(state, "floatingball.opens") > 0 &&
      count(state, "floatingball.drags") > 0,
  },
  "spectrum-collector": {
    current: Math.min(4, setSize(state, "spectrum.effects")),
    target: 4,
    complete: setSize(state, "spectrum.effects") >= 4,
  },
  "text-alchemist": {
    current: Math.min(4, setSize(state, "selection.actions")),
    target: 4,
    complete: setSize(state, "selection.actions") >= 4,
  },
  "bookmark-archaeologist": {
    current: Math.min(10, count(state, "bookmarks.total")),
    target: 10,
    complete:
      count(state, "bookmarks.total") >= 10 &&
      setSize(state, "bookmarks.sites") >= 3,
  },
  "image-quartermaster": {
    current: Math.min(5, count(state, "images.bestBatch")),
    target: 5,
    complete: count(state, "images.bestBatch") >= 5,
  },
});

export const isAchievementComplete = (
  id: string,
  state: AchievementState,
): boolean => getAchievementProgress(state)[id]?.complete ?? false;

export const applyAchievementEvent = (
  state: AchievementState,
  event: AchievementEvent,
): AchievementState => {
  const next: AchievementState = {
    ...state,
    counters: { ...state.counters },
    sets: Object.fromEntries(
      Object.entries(state.sets).map(([key, values]) => [key, [...values]]),
    ),
    recent: [...state.recent],
    processedEvents: [...state.processedEvents],
  };

  const increment = (key: string, amount = 1) => {
    next.counters[key] = (next.counters[key] ?? 0) + amount;
  };
  const addToSet = (key: string, value: string) => {
    if (!value) return;
    const values = next.sets[key] ?? [];
    if (!values.includes(value)) next.sets[key] = [...values, value];
  };

  switch (event.name) {
    case "floatingball.open":
      increment("floatingball.opens");
      break;
    case "floatingball.drag":
      increment("floatingball.drags");
      break;
    case "spectrum.preview":
      addToSet("spectrum.effects", String(event.meta?.effectId ?? ""));
      break;
    case "selection.action.completed":
      addToSet("selection.actions", String(event.meta?.actionId ?? ""));
      break;
    case "bookmark.created":
      increment("bookmarks.total");
      addToSet("bookmarks.sites", String(event.meta?.siteBucket ?? ""));
      break;
    case "image.download.batch.completed": {
      const batchSize = Number(event.meta?.count ?? 0);
      if (batchSize > (next.counters["images.bestBatch"] ?? 0)) {
        next.counters["images.bestBatch"] = batchSize;
      }
      break;
    }
  }

  next.recent = [
    { id: event.name, at: event.at ?? Date.now() },
    ...next.recent,
  ].slice(0, 30);
  return next;
};
