import { beforeEach, describe, expect, it } from "vitest";
import {
  achievements,
  applyAchievementEvent,
  createInitialAchievementState,
  getAchievementProgress,
} from "@/services/achievements";

describe("achievement service", () => {
  beforeEach(async () => {
    await achievements.reset();
  });

  it("unlocks the spectrum collector only after four unique effects", async () => {
    for (const effectId of ["prism", "aurora", "halo"]) {
      await achievements.track({
        name: "spectrum.preview",
        source: "floatingball",
        meta: { effectId },
      });
    }

    expect((await achievements.getSnapshot()).state.unlocked["spectrum-collector"]).toBeUndefined();

    const unlocked = await achievements.track({
      name: "spectrum.preview",
      source: "floatingball",
      meta: { effectId: "diffraction" },
    });

    expect(unlocked.map((item) => item.id)).toContain("spectrum-collector");
  });

  it("requires both opening and dragging the floating ball", async () => {
    await achievements.track({ name: "floatingball.open", source: "floatingball" });
    await achievements.track({ name: "floatingball.open", source: "floatingball" });
    expect((await achievements.getSnapshot()).state.unlocked["first-contact"]).toBeUndefined();

    const unlocked = await achievements.track({
      name: "floatingball.drag",
      source: "floatingball",
      meta: { distance: 100 },
    });
    expect(unlocked.map((item) => item.id)).toContain("first-contact");
  });

  it("deduplicates event ids and keeps the same unlock one-shot", async () => {
    const event = {
      name: "image.download.batch.completed" as const,
      source: "floatingball" as const,
      id: "download-1",
      meta: { count: 5 },
    };

    expect((await achievements.track(event)).map((item) => item.id)).toContain(
      "image-quartermaster",
    );
    expect(await achievements.track(event)).toEqual([]);
    expect((await achievements.getSnapshot()).state.counters["images.bestBatch"]).toBe(5);
  });

  it("requires both bookmark count and three distinct site buckets", () => {
    let state = createInitialAchievementState();
    for (let index = 0; index < 10; index += 1) {
      state = applyAchievementEvent(state, {
        name: "bookmark.created",
        source: "content",
        meta: { siteBucket: `site-${index % 3}` },
      });
    }

    expect(getAchievementProgress(state)["bookmark-archaeologist"]).toEqual({
      current: 10,
      target: 10,
      complete: true,
    });
  });
});
