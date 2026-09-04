import { achievements } from "./service";
import type {
  AchievementDefinition,
  AchievementEvent,
  AchievementEventName,
  AchievementSource,
} from "./types";

export const trackAchievement = (
  name: AchievementEventName,
  source: AchievementSource,
  meta?: AchievementEvent["meta"],
): Promise<AchievementDefinition[]> => achievements.track({ name, source, meta });

export const trackFloatingBallOpen = () =>
  trackAchievement("floatingball.open", "floatingball");

export const trackFloatingBallDrag = (distance: number) => {
  if (distance >= 80) {
    trackAchievement("floatingball.drag", "floatingball", { distance });
  }
};

export const trackSpectrumPreview = (effectId: string) =>
  trackAchievement("spectrum.preview", "floatingball", { effectId });

export const trackTextAction = (actionId: string) =>
  trackAchievement("selection.action.completed", "content", { actionId });

export const trackImageBatchDownload = (count: number) =>
  trackAchievement("image.download.batch.completed", "floatingball", { count });
