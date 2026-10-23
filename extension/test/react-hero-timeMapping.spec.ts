import { describe, expect, it } from "vitest";
import {
  getProgressFromLocalTime,
  mapProgressToTime,
  normalizeScrollProgress,
} from "@/pages/hero/systems/timeMapping";
import { useTimeStore } from "@/pages/hero/store/useTimeStore";

const timeCases: Array<[number, string]> = [
  [0, "07:00"],
  [0.25, "13:00"],
  [0.5, "19:00"],
  [0.75, "01:00"],
  [1, "07:00"],
];

describe("hero time mapping", () => {
  it.each(timeCases)("maps progress %s to %s", (progress, expectedTime) => {
    expect(mapProgressToTime(progress).label).toBe(expectedTime);
  });

  it("keeps progress within the one-day range", () => {
    expect(normalizeScrollProgress(-0.5)).toBe(0);
    expect(normalizeScrollProgress(1.5)).toBe(1);
    expect(normalizeScrollProgress(Number.NaN)).toBe(0);
  });

  it("keeps the final minute distinct until the scroll reaches its end", () => {
    expect(mapProgressToTime(1439 / 1440).label).toBe("06:59");
    expect(mapProgressToTime(1).label).toBe("07:00");
  });

  it.each([
    [7, 0, "07:00"],
    [9, 35, "09:35"],
    [23, 59, "23:59"],
    [6, 59, "06:59"],
  ])("initializes local time %s:%s as %s", (hour, minute, expectedTime) => {
    const localDate = new Date(2026, 0, 1, hour, minute);
    const progress = getProgressFromLocalTime(localDate);

    expect(mapProgressToTime(progress).label).toBe(expectedTime);
  });

  it("updates the stored clock when scroll progress changes", () => {
    useTimeStore.getState().setScrollProgress(0.5);
    expect(useTimeStore.getState().timeOfDay.label).toBe("19:00");

    useTimeStore.getState().setScrollProgress(1);
    expect(useTimeStore.getState().timeOfDay.label).toBe("07:00");
  });

  it("initializes from local time and advances one minute at a time", () => {
    useTimeStore
      .getState()
      .initializeFromLocalTime(new Date(2026, 0, 1, 9, 35));

    expect(useTimeStore.getState().timeOfDay.label).toBe("09:35");
    useTimeStore.getState().advanceOneMinute();
    expect(useTimeStore.getState().timeOfDay.label).toBe("09:36");
  });

  it("resumes minute advancement from the time selected by scrolling", () => {
    useTimeStore.getState().setScrollProgress(0.5);
    useTimeStore.getState().advanceOneMinute();

    expect(useTimeStore.getState().timeOfDay.label).toBe("19:01");
  });

  it("wraps the automatic clock from 06:59 back to 07:00", () => {
    useTimeStore.getState().setScrollProgress(1439 / 1440);
    useTimeStore.getState().advanceOneMinute();

    expect(useTimeStore.getState().timeOfDay.label).toBe("07:00");
    expect(useTimeStore.getState().scrollProgress).toBe(0);
  });
});
