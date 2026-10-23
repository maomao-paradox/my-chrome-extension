import { describe, expect, it } from "vitest";
import { IcosahedronGeometry } from "three";
import {
  SCENE_COLOR_KEYFRAMES,
  getScenePalette,
  getSkyPalette,
} from "@/pages/hero/systems/colorKeyframes";
import {
  getCelestialState,
  getNightOpacity,
} from "@/pages/hero/systems/celestialMotion";
import {
  getWeatherEffects,
  getRandomWeather,
  getWeatherPalette,
  shouldShowBirds,
  WEATHER_TYPES,
} from "@/pages/hero/systems/weather";
import { createCanopySnowGeometry } from "@/pages/hero/systems/canopySnow";

describe("hero sky palette", () => {
  it("uses the same palette at both ends of the day cycle", () => {
    expect(getSkyPalette(0)).toEqual(getSkyPalette(1));
  });

  it("interpolates between the configured color keyframes", () => {
    const noon = getSkyPalette(5 / 24);
    const sceneNoon = getScenePalette(5 / 24);
    const beforeNoon = getSkyPalette(4 / 24);

    expect(noon).toEqual({
      zenith: SCENE_COLOR_KEYFRAMES[1].zenith,
      horizon: SCENE_COLOR_KEYFRAMES[1].horizon,
      ground: SCENE_COLOR_KEYFRAMES[1].ground,
    });
    expect(sceneNoon.ambientIntensity).toBe(
      SCENE_COLOR_KEYFRAMES[1].ambientIntensity,
    );
    expect(sceneNoon.fogDensity).toBe(SCENE_COLOR_KEYFRAMES[1].fogDensity);
    expect(beforeNoon).not.toEqual(noon);
  });

  it("clamps out-of-range progress before choosing a palette", () => {
    expect(getSkyPalette(-1)).toEqual(getSkyPalette(0));
    expect(getSkyPalette(2)).toEqual(getSkyPalette(1));
  });

  it("dims key and ambient light and increases haze at night", () => {
    const midday = getScenePalette(5 / 24);
    const midnight = getScenePalette(17 / 24);

    expect(midnight.ambientIntensity).toBeLessThan(midday.ambientIntensity);
    expect(midnight.keyLightIntensity).toBeLessThan(midday.keyLightIntensity);
    expect(midnight.fogDensity).toBeGreaterThan(midday.fogDensity);
  });
});

describe("hero celestial motion", () => {
  it("moves the sun along a daytime arc and fades it at sunrise and sunset", () => {
    const sunrise = getCelestialState(0, "sun");
    const noon = getCelestialState(0.25, "sun");
    const sunset = getCelestialState(0.5, "sun");

    expect(sunrise.horizontal).toBe(0);
    expect(sunrise.opacity).toBe(0);
    expect(noon.horizontal).toBeCloseTo(0.5);
    expect(noon.height).toBeCloseTo(1);
    expect(noon.opacity).toBe(1);
    expect(sunset.horizontal).toBe(1);
    expect(sunset.opacity).toBe(0);
  });

  it("moves the moon on its night arc and fades stars in and out at night", () => {
    const midnight = getCelestialState(0.75, "moon");

    expect(midnight.horizontal).toBeCloseTo(0.5);
    expect(midnight.height).toBeCloseTo(1);
    expect(midnight.opacity).toBe(1);
    expect(getNightOpacity(0)).toBe(0);
    expect(getNightOpacity(0.75)).toBe(1);
    expect(getNightOpacity(1)).toBe(0);
  });
});

describe("hero weather", () => {
  it("includes the five requested weather types", () => {
    expect(WEATHER_TYPES).toEqual(["晴天", "阴天", "雷雨", "下雪", "大风"]);
  });

  it("chooses a weather from the random source", () => {
    expect(getRandomWeather(() => 0)).toBe("晴天");
    expect(getRandomWeather(() => 0.99)).toBe("大风");
  });

  it("maps storm, snow, and wind to distinct scene effects", () => {
    expect(getWeatherEffects("雷雨")).toMatchObject({
      precipitation: "rain",
      thunderstorm: true,
      cloudCover: 1,
    });
    expect(getWeatherEffects("下雪").precipitation).toBe("snow");
    expect(getWeatherEffects("大风").windStrength).toBe(1);
    expect(getWeatherEffects("晴天").cloudCover).toBe(0);
  });

  it("shows birds only in sunny weather", () => {
    expect(shouldShowBirds("晴天")).toBe(true);
    expect(WEATHER_TYPES.filter((weather) => weather !== "晴天").every(
      (weather) => !shouldShowBirds(weather),
    )).toBe(true);
  });

  it("covers only the curved upper canopy facets with a slight surface offset", () => {
    const snow = createCanopySnowGeometry();
    const positions = snow.attributes.position.array as Float32Array;
    const canopy = new IcosahedronGeometry(1, 2);
    const canopyVertexCount = canopy.attributes.position.count;

    expect(positions.length).toBeGreaterThan(0);
    expect(positions.length).toBeLessThan(canopyVertexCount * 3);
    for (let vertex = 0; vertex < positions.length; vertex += 3) {
      const radius = Math.hypot(
        positions[vertex],
        positions[vertex + 1],
        positions[vertex + 2],
      );
      expect(radius).toBeCloseTo(1.018, 3);
    }

    snow.dispose();
    canopy.dispose();
  });

  it("preserves the time palette for sunny weather", () => {
    const palette = getScenePalette(0.25);

    expect(getWeatherPalette(palette, "晴天")).toBe(palette);
  });

  it("adjusts colors and dims the scene for thunderstorms", () => {
    const palette = getScenePalette(0.25);
    const stormPalette = getWeatherPalette(palette, "雷雨");

    expect(stormPalette.zenith).not.toBe(palette.zenith);
    expect(stormPalette.ambientIntensity).toBeLessThan(
      palette.ambientIntensity,
    );
    expect(stormPalette.fogDensity).toBeGreaterThan(palette.fogDensity);
  });
});
