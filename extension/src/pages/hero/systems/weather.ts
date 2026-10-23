import type { ScenePalette } from "./colorKeyframes";

export const WEATHER_TYPES = [
  "晴天",
  "阴天",
  "雷雨",
  "下雪",
  "大风",
] as const;

export type WeatherType = (typeof WEATHER_TYPES)[number];

export const shouldShowBirds = (weather: WeatherType) => weather === "晴天";

export interface WeatherEffects {
  cloudCover: number;
  precipitation: "rain" | "snow" | null;
  windStrength: number;
  thunderstorm: boolean;
}

export const getWeatherEffects = (weather: WeatherType): WeatherEffects => {
  switch (weather) {
    case "阴天":
      return {
        cloudCover: 0.72,
        precipitation: null,
        windStrength: 0,
        thunderstorm: false,
      };
    case "雷雨":
      return {
        cloudCover: 1,
        precipitation: "rain",
        windStrength: 0.55,
        thunderstorm: true,
      };
    case "下雪":
      return {
        cloudCover: 0.84,
        precipitation: "snow",
        windStrength: 0.18,
        thunderstorm: false,
      };
    case "大风":
      return {
        cloudCover: 0.48,
        precipitation: null,
        windStrength: 1,
        thunderstorm: false,
      };
    case "晴天":
      return {
        cloudCover: 0,
        precipitation: null,
        windStrength: 0,
        thunderstorm: false,
      };
  }
};

const WEATHER_PALETTES: Record<
  Exclude<WeatherType, "晴天">,
  {
    zenith: string;
    horizon: string;
    ground: string;
    ambientColor: string;
    keyLightColor: string;
    fogColor: string;
    blend: number;
    ambientFactor: number;
    keyLightFactor: number;
    fogAddition: number;
  }
> = {
  阴天: {
    zenith: "#78848d",
    horizon: "#aaa7a0",
    ground: "#666957",
    ambientColor: "#a5afb6",
    keyLightColor: "#c1c0b6",
    fogColor: "#929da3",
    blend: 0.5,
    ambientFactor: 0.9,
    keyLightFactor: 0.72,
    fogAddition: 0.004,
  },
  雷雨: {
    zenith: "#303d50",
    horizon: "#68747c",
    ground: "#46483f",
    ambientColor: "#77818e",
    keyLightColor: "#a7b2bf",
    fogColor: "#64717c",
    blend: 0.72,
    ambientFactor: 0.62,
    keyLightFactor: 0.5,
    fogAddition: 0.01,
  },
  下雪: {
    zenith: "#a5b8c2",
    horizon: "#d2d7d2",
    ground: "#9b9c8d",
    ambientColor: "#c3d2db",
    keyLightColor: "#e1e6e4",
    fogColor: "#b4c4cb",
    blend: 0.6,
    ambientFactor: 1.05,
    keyLightFactor: 0.78,
    fogAddition: 0.008,
  },
  大风: {
    zenith: "#788a8d",
    horizon: "#b5b6a9",
    ground: "#747565",
    ambientColor: "#aab6b0",
    keyLightColor: "#d1c8ad",
    fogColor: "#a0aaa5",
    blend: 0.38,
    ambientFactor: 0.92,
    keyLightFactor: 0.84,
    fogAddition: 0.003,
  },
};

const mixColor = (start: string, end: string, amount: number) => {
  const channels = [1, 3, 5].map((offset) => {
    const startChannel = Number.parseInt(start.slice(offset, offset + 2), 16);
    const endChannel = Number.parseInt(end.slice(offset, offset + 2), 16);
    const channel = Math.round(startChannel + (endChannel - startChannel) * amount);
    return channel.toString(16).padStart(2, "0");
  });

  return `#${channels.join("")}`;
};

export const getRandomWeather = (
  random: () => number = Math.random,
): WeatherType => {
  const index = Math.min(
    WEATHER_TYPES.length - 1,
    Math.floor(random() * WEATHER_TYPES.length),
  );

  return WEATHER_TYPES[index];
};

export const getWeatherPalette = (
  palette: ScenePalette,
  weather: WeatherType,
): ScenePalette => {
  if (weather === "晴天") {
    return palette;
  }

  const weatherPalette = WEATHER_PALETTES[weather];
  const colorKeys = [
    "zenith",
    "horizon",
    "ground",
    "ambientColor",
    "keyLightColor",
    "fogColor",
  ] as const;
  const colors = Object.fromEntries(
    colorKeys.map((key) => [
      key,
      mixColor(palette[key], weatherPalette[key], weatherPalette.blend),
    ]),
  ) as Pick<ScenePalette, (typeof colorKeys)[number]>;

  return {
    ...palette,
    ...colors,
    ambientIntensity: palette.ambientIntensity * weatherPalette.ambientFactor,
    keyLightIntensity: palette.keyLightIntensity * weatherPalette.keyLightFactor,
    fogDensity: Math.min(0.08, palette.fogDensity + weatherPalette.fogAddition),
  };
};
