import { create } from "zustand";
import {
  getProgressFromLocalTime,
  mapProgressToTime,
  normalizeScrollProgress,
  type TimeOfDay,
} from "../systems/timeMapping";

interface TimeStore {
  scrollProgress: number;
  timeOfDay: TimeOfDay;
  initializeFromLocalTime: (date: Date) => void;
  setScrollProgress: (progress: number) => void;
  advanceOneMinute: () => void;
}

export const useTimeStore = create<TimeStore>((set) => ({
  scrollProgress: 0,
  timeOfDay: mapProgressToTime(0),
  initializeFromLocalTime: (date) => {
    const scrollProgress = getProgressFromLocalTime(date);

    set({
      scrollProgress,
      timeOfDay: mapProgressToTime(scrollProgress),
    });
  },
  setScrollProgress: (progress) => {
    const normalizedProgress = normalizeScrollProgress(progress);

    set((state) => {
      if (state.scrollProgress === normalizedProgress) {
        return state;
      }

      return {
        scrollProgress: normalizedProgress,
        timeOfDay: mapProgressToTime(normalizedProgress),
      };
    });
  },
  advanceOneMinute: () => {
    set((state) => {
      const elapsedMinutes =
        (state.timeOfDay.elapsedMinutes + 1) % (24 * 60);
      const scrollProgress = elapsedMinutes / (24 * 60);

      return {
        scrollProgress,
        timeOfDay: mapProgressToTime(scrollProgress),
      };
    });
  },
}));
