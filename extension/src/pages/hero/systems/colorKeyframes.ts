import { normalizeScrollProgress } from "./timeMapping";

export interface SkyPalette {
  zenith: string;
  horizon: string;
  ground: string;
}

export interface ScenePalette extends SkyPalette {
  ambientColor: string;
  keyLightColor: string;
  fogColor: string;
  ambientIntensity: number;
  keyLightIntensity: number;
  fogDensity: number;
}

interface SceneKeyframe extends ScenePalette {
  progress: number;
}

// Progress starts at 07:00; the final keyframe repeats it for a seamless cycle.
export const SCENE_COLOR_KEYFRAMES: SceneKeyframe[] = [
  {
    progress: 0,
    zenith: "#9d6977",
    horizon: "#f2b184",
    ground: "#625b48",
    ambientColor: "#bd8d7a",
    keyLightColor: "#ffd49a",
    fogColor: "#b88779",
    ambientIntensity: 0.62,
    keyLightIntensity: 0.95,
    fogDensity: 0.026,
  },
  {
    progress: 5 / 24,
    zenith: "#67a3c1",
    horizon: "#d3e8e7",
    ground: "#78815d",
    ambientColor: "#c9d9cf",
    keyLightColor: "#fff0ca",
    fogColor: "#b9d0d1",
    ambientIntensity: 0.82,
    keyLightIntensity: 1.35,
    fogDensity: 0.015,
  },
  {
    progress: 11 / 24,
    zenith: "#8d586b",
    horizon: "#e8a075",
    ground: "#625340",
    ambientColor: "#bd786d",
    keyLightColor: "#ffad75",
    fogColor: "#a96e67",
    ambientIntensity: 0.54,
    keyLightIntensity: 0.88,
    fogDensity: 0.028,
  },
  {
    progress: 17 / 24,
    zenith: "#111a37",
    horizon: "#263b5e",
    ground: "#252a29",
    ambientColor: "#52658b",
    keyLightColor: "#8298c5",
    fogColor: "#2f4160",
    ambientIntensity: 0.22,
    keyLightIntensity: 0.3,
    fogDensity: 0.038,
  },
  {
    progress: 23 / 24,
    zenith: "#397383",
    horizon: "#e2a07b",
    ground: "#45544a",
    ambientColor: "#789da1",
    keyLightColor: "#efb08e",
    fogColor: "#718c8f",
    ambientIntensity: 0.4,
    keyLightIntensity: 0.58,
    fogDensity: 0.03,
  },
  {
    progress: 1,
    zenith: "#9d6977",
    horizon: "#f2b184",
    ground: "#625b48",
    ambientColor: "#bd8d7a",
    keyLightColor: "#ffd49a",
    fogColor: "#b88779",
    ambientIntensity: 0.62,
    keyLightIntensity: 0.95,
    fogDensity: 0.026,
  },
];

const interpolateHexColor = (start: string, end: string, amount: number) => {
  const channels = [1, 3, 5].map((offset) => {
    const startChannel = Number.parseInt(start.slice(offset, offset + 2), 16);
    const endChannel = Number.parseInt(end.slice(offset, offset + 2), 16);
    const channel = Math.round(startChannel + (endChannel - startChannel) * amount);
    return channel.toString(16).padStart(2, "0");
  });

  return `#${channels.join("")}`;
};

export const getScenePalette = (progress: number): ScenePalette => {
  const normalizedProgress = normalizeScrollProgress(progress);

  for (let index = 0; index < SCENE_COLOR_KEYFRAMES.length - 1; index += 1) {
    const start = SCENE_COLOR_KEYFRAMES[index];
    const end = SCENE_COLOR_KEYFRAMES[index + 1];

    if (normalizedProgress <= end.progress) {
      const span = end.progress - start.progress;
      const amount =
        span === 0 ? 0 : (normalizedProgress - start.progress) / span;

      return {
        zenith: interpolateHexColor(start.zenith, end.zenith, amount),
        horizon: interpolateHexColor(start.horizon, end.horizon, amount),
        ground: interpolateHexColor(start.ground, end.ground, amount),
        ambientColor: interpolateHexColor(
          start.ambientColor,
          end.ambientColor,
          amount,
        ),
        keyLightColor: interpolateHexColor(
          start.keyLightColor,
          end.keyLightColor,
          amount,
        ),
        fogColor: interpolateHexColor(
          start.fogColor,
          end.fogColor,
          amount,
        ),
        ambientIntensity:
          start.ambientIntensity +
          (end.ambientIntensity - start.ambientIntensity) * amount,
        keyLightIntensity:
          start.keyLightIntensity +
          (end.keyLightIntensity - start.keyLightIntensity) * amount,
        fogDensity:
          start.fogDensity + (end.fogDensity - start.fogDensity) * amount,
      };
    }
  }

  return SCENE_COLOR_KEYFRAMES[SCENE_COLOR_KEYFRAMES.length - 1];
};

export const getSkyPalette = (progress: number): SkyPalette => {
  const { zenith, horizon, ground } = getScenePalette(progress);
  return { zenith, horizon, ground };
};
