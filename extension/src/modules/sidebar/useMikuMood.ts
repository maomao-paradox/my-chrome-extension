/**
 * @file modules/sidebar/useMikuMood.ts
 * @description 按 AI 当前心情切换 Miku 形象图（content script 侧）
 *
 * 心情状态由后台 proactive-chat 写入 chrome.storage.local，
 * 这里只读取 + 监听变化，不参与心情推导与写入。
 *
 * 图片映射：
 *   happy / sad  → imgs/miku.png        （常态形象）
 *   angry / frenzy → imgs/miku_angry.png（生气形象，frenzy 视作更生气）
 *
 * @author Vivy
 * @date 2026-11-02
 */
import { useEffect, useState } from "react";
import {
  deriveMood,
  getDateKey,
  MOOD_STATE_KEY,
  normalizeMoodState,
  type ProactiveMood,
} from "@/service-worker/background/proactive-mood";

/** 心情 → 图片路径（相对扩展根目录） */
const MIKU_IMAGE_BY_MOOD: Record<ProactiveMood, string> = {
  happy: "imgs/miku.png",
  sad: "imgs/miku.png",
  angry: "imgs/miku_angry.png",
  frenzy: "imgs/miku_angry.png",
};

/** 默认心情 —— 未读到状态时按开心处理，避免头像闪变 */
const DEFAULT_MOOD: ProactiveMood = "happy";

/** content script 中 chrome.storage 是否可用（组件墙预览等环境可能没有） */
function hasMoodStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

/** 把 storage 原始值收敛为当前心情 */
function toMood(raw: unknown): ProactiveMood {
  return deriveMood(normalizeMoodState(raw, getDateKey(new Date())));
}

/**
 * 订阅 AI 当前心情。
 * - 首次挂载读取一次存储
 * - 监听 storage.onChanged，心情写入后立即更新
 */
export function useMikuMood(): ProactiveMood {
  const [mood, setMood] = useState<ProactiveMood>(DEFAULT_MOOD);

  useEffect(() => {
    if (!hasMoodStorage()) return;

    let alive = true;

    // 首次读取
    chrome.storage.local.get(MOOD_STATE_KEY, (result) => {
      if (alive) setMood(toMood(result?.[MOOD_STATE_KEY]));
    });

    // 心情变化时实时同步
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[MOOD_STATE_KEY]) return;
      setMood(toMood(changes[MOOD_STATE_KEY].newValue));
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return mood;
}

/** 心情 → 可直接放进 <img src> 的扩展资源 URL */
export function getMikuImageSrc(mood: ProactiveMood): string {
  return chrome.runtime.getURL(MIKU_IMAGE_BY_MOOD[mood]);
}

/** 组件用这个：拿到随心情变化的 Miku 图片 URL */
export function useMikuImageSrc(): string {
  return getMikuImageSrc(useMikuMood());
}
