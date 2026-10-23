import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { FogExp2 } from "three";
import { Ground } from "./Ground";
import { Lights } from "./Lights";
import { Moon } from "./Moon";
import { Park } from "./Park";
import { Sky } from "./Sky";
import { Stars } from "./Stars";
import { Sun } from "./Sun";
import { WeatherAtmosphere } from "./WeatherAtmosphere";
import type { ScenePalette } from "../systems/colorKeyframes";
import { getWeatherEffects, type WeatherType } from "../systems/weather";

interface SceneProps {
  progress: number;
  palette: ScenePalette;
  weather: WeatherType;
}

const DynamicFog = ({ palette }: { palette: ScenePalette }) => {
  const scene = useThree((state) => state.scene);
  const fogRef = useRef<FogExp2 | null>(null);

  if (!fogRef.current) {
    fogRef.current = new FogExp2(palette.fogColor, palette.fogDensity);
  }
  const fog = fogRef.current;

  useEffect(() => {
    scene.fog = fog;

    return () => {
      if (scene.fog === fog) {
        scene.fog = null;
      }
    };
  }, [fog, scene]);

  useEffect(() => {
    fog.color.set(palette.fogColor);
    fog.density = palette.fogDensity;
  }, [fog, palette.fogColor, palette.fogDensity]);

  return null;
};

export const Scene = ({ progress, palette, weather }: SceneProps) => {
  const cloudCover = getWeatherEffects(weather).cloudCover;

  return (
    <>
      <DynamicFog palette={palette} />
      <Sky palette={palette} />
      <Ground palette={palette} />
      <Stars progress={progress} cloudCover={cloudCover} />
      <Sun progress={progress} cloudCover={cloudCover} />
      <Moon progress={progress} cloudCover={cloudCover} />
      <Lights progress={progress} palette={palette} />
      <WeatherAtmosphere weather={weather} />
      <Park progress={progress} weather={weather} />
    </>
  );
};
