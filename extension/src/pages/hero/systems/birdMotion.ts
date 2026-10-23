import { normalizeScrollProgress } from "./timeMapping";

const ARRIVAL_START = 2 / 24;
const ARRIVAL_DURATION = 1 / 24;
const DEPARTURE_START = 9 / 24;
const DEPARTURE_DURATION = 1 / 24;
const BIRD_STAGGER = 1 / 144;
const FLIGHT_HEIGHT = 3.4;

export type BirdMotionPhase =
  | "hidden"
  | "flying-in"
  | "grounded"
  | "flying-out";

export interface BirdMotion {
  phase: BirdMotionPhase;
  visible: boolean;
  position: [number, number, number];
  direction: number;
}

const smoothstep = (start: number, end: number, value: number) => {
  const amount = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return amount * amount * (3 - 2 * amount);
};

export const getBirdMotion = (
  progress: number,
  viewportWidth: number,
  target: [number, number, number],
  index: number,
): BirdMotion => {
  const normalizedProgress = normalizeScrollProgress(progress);
  const stagger = index * BIRD_STAGGER;
  const arrivalStart = ARRIVAL_START + stagger;
  const arrivalEnd = arrivalStart + ARRIVAL_DURATION;
  const departureStart = DEPARTURE_START + stagger;
  const departureEnd = departureStart + DEPARTURE_DURATION;
  const entrySide = index === 1 ? 1 : -1;
  const exitSide = -entrySide;
  const entryX = entrySide * (viewportWidth / 2 + 1.5);
  const exitX = exitSide * (viewportWidth / 2 + 1.5);

  if (normalizedProgress < arrivalStart) {
    return {
      phase: "hidden",
      visible: false,
      position: [entryX, target[1] + FLIGHT_HEIGHT + 0.8, target[2]],
      direction: entrySide,
    };
  }

  if (normalizedProgress < arrivalEnd) {
    const amount = smoothstep(arrivalStart, arrivalEnd, normalizedProgress);
    return {
      phase: "flying-in",
      visible: true,
      position: [
        entryX + (target[0] - entryX) * amount,
        target[1] +
          (1 - amount) * (FLIGHT_HEIGHT + 0.8) +
          Math.sin(amount * Math.PI) * 1.2,
        target[2],
      ],
      direction: -entrySide,
    };
  }

  if (normalizedProgress < departureStart) {
    return {
      phase: "grounded",
      visible: true,
      position: [...target],
      direction: 0,
    };
  }

  if (normalizedProgress < departureEnd) {
    const amount = smoothstep(
      departureStart,
      departureEnd,
      normalizedProgress,
    );
    return {
      phase: "flying-out",
      visible: true,
      position: [
        target[0] + (exitX - target[0]) * amount,
        target[1] +
          Math.sin(amount * Math.PI) * 1.2 +
          amount * (FLIGHT_HEIGHT + 0.8),
        target[2],
      ],
      direction: exitSide,
    };
  }

  return {
    phase: "hidden",
    visible: false,
    position: [exitX, target[1] + FLIGHT_HEIGHT + 0.8, target[2]],
    direction: exitSide,
  };
};
