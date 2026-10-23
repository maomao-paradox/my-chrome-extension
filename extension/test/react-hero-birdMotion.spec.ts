import { describe, expect, it } from "vitest";
import { getBirdMotion } from "@/pages/hero/systems/birdMotion";

const viewportWidth = 16;
const landingPosition: [number, number, number] = [2, -2, 1];

describe("hero bird motion", () => {
  it("keeps birds offscreen before 09:00", () => {
    const motion = getBirdMotion(1.99 / 24, viewportWidth, landingPosition, 0);

    expect(motion.phase).toBe("hidden");
    expect(motion.visible).toBe(false);
  });

  it("flies in after 09:00 and lands before midday", () => {
    const arriving = getBirdMotion(2.5 / 24, viewportWidth, landingPosition, 0);
    const landed = getBirdMotion(4 / 24, viewportWidth, landingPosition, 0);

    expect(arriving.phase).toBe("flying-in");
    expect(arriving.visible).toBe(true);
    expect(arriving.position[1]).toBeGreaterThan(0);
    expect(landed.phase).toBe("grounded");
    expect(landed.position).toEqual(landingPosition);
  });

  it("flies away after 16:00 and is hidden after exiting", () => {
    const departing = getBirdMotion(
      9.5 / 24,
      viewportWidth,
      landingPosition,
      0,
    );
    const gone = getBirdMotion(10.1 / 24, viewportWidth, landingPosition, 0);

    expect(departing.phase).toBe("flying-out");
    expect(departing.visible).toBe(true);
    expect(departing.position[1]).toBeGreaterThan(0);
    expect(gone.phase).toBe("hidden");
    expect(gone.visible).toBe(false);
  });
});
