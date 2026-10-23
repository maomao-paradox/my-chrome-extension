import { normalizeScrollProgress } from "./timeMapping";

export type CelestialBody = "sun" | "moon";

export interface CelestialState {
  horizontal: number;
  height: number;
  opacity: number;
}

const smoothstep = (start: number, end: number, value: number) => {
  const amount = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return amount * amount * (3 - 2 * amount);
};

export const getCelestialState = (
  progress: number,
  body: CelestialBody,
): CelestialState => {
  const normalizedProgress = normalizeScrollProgress(progress);
  // The sun and moon share a semicircle, each occupying half of the 24-hour cycle.
  const cycleStart = body === "sun" ? 0 : 0.5;
  const cycleProgress = Math.min(
    1,
    Math.max(0, (normalizedProgress - cycleStart) * 2),
  );
  const opacity =
    smoothstep(0, 0.08, cycleProgress) *
    (1 - smoothstep(0.9, 1, cycleProgress));

  return {
    horizontal: (1 - Math.cos(Math.PI * cycleProgress)) / 2,
    height: Math.sin(Math.PI * cycleProgress),
    opacity,
  };
};

export const getNightOpacity = (progress: number) => {
  const normalizedProgress = normalizeScrollProgress(progress);
  return (
    smoothstep(0.44, 0.56, normalizedProgress) *
    (1 - smoothstep(0.94, 1, normalizedProgress))
  );
};
