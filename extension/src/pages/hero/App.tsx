import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { TimeOverlay } from "./components/TimeOverlay";
import { WeatherPicker } from "./components/WeatherPicker";
import { useScrollProgress } from "./hooks/useScrollProgress";
import { useTimeStore } from "./store/useTimeStore";
import { getScenePalette } from "./systems/colorKeyframes";
import { getRandomWeather, getWeatherPalette } from "./systems/weather";
import type { WeatherType } from "./systems/weather";
import { Scene } from "./scenes/Scene";
import "./style.scss";

const App = () => {
  useScrollProgress();
  const scrollProgress = useTimeStore((state) => state.scrollProgress);
  const [isCompact, setIsCompact] = useState(false);
  const [weather, setWeather] = useState<WeatherType>(() => getRandomWeather());
  const [isAutomaticWeather, setIsAutomaticWeather] = useState(true);
  const scenePalette = useMemo(
    () => getWeatherPalette(getScenePalette(scrollProgress), weather),
    [scrollProgress, weather],
  );
  const isNight = scrollProgress >= 0.53 && scrollProgress < 0.95;
  const hasScrolled = scrollProgress > 0.012;

  const selectWeather = (nextWeather: WeatherType) => {
    setWeather(nextWeather);
    setIsAutomaticWeather(false);
  };

  const randomizeWeather = () => {
    setWeather(getRandomWeather());
    setIsAutomaticWeather(true);
  };

  useEffect(() => {
    const compactQuery = window.matchMedia("(max-width: 700px)");
    const updateCompactMode = (event: MediaQueryListEvent) =>
      setIsCompact(event.matches);

    setIsCompact(compactQuery.matches);
    compactQuery.addEventListener("change", updateCompactMode);
    return () =>
      compactQuery.removeEventListener("change", updateCompactMode);
  }, []);

  return (
    <main className="hero-page">
      <section
        className="hero-page__viewport"
        data-night={isNight}
        data-scrolled={hasScrolled}
        data-weather={weather}
        aria-label="一日公园时间体验"
      >
        <Canvas
          className="hero-page__canvas"
          orthographic
          camera={{ position: [0, 5, 20], zoom: 55, near: 0.1, far: 60 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true }}
          shadows={!isCompact}
          fallback={
            <div className="hero-page__fallback" role="status">
              当前设备无法启用 3D 渲染，请使用支持 WebGL 的浏览器查看。
            </div>
          }
          onCreated={({ gl, scene }) => {
            gl.setClearColor(0x000000, 0);
            scene.background = null;
          }}
        >
          <Scene
            progress={scrollProgress}
            palette={scenePalette}
            weather={weather}
          />
        </Canvas>
        <div className="hero-page__mood" aria-hidden="true" />
        <header className="hero-page__intro">
          <p className="hero-page__eyebrow">A DAY IN THE PARK · 24 HOURS</p>
          <h1>ALONE</h1>
          <p className="hero-page__description">
            滚动，看看同一座公园如何走过一天。
          </p>
        </header>

        <TimeOverlay />
        <WeatherPicker
          weather={weather}
          automatic={isAutomaticWeather}
          onSelect={selectWeather}
          onRandomize={randomizeWeather}
        />

        <div className="hero-page__scroll-status">
          <p className="hero-page__scroll-label">SCROLL THROUGH ONE DAY</p>
          <div
            className="hero-page__progress"
            role="progressbar"
            aria-label="一日循环进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(scrollProgress * 100)}
          >
            <span style={{ width: `${scrollProgress * 100}%` }} />
          </div>
          <p className="hero-page__scroll-hint">向下滚动推进时间</p>
        </div>

        <p className="hero-page__stage">STAGE 06 / TIME IN MOTION</p>
      </section>
    </main>
  );
};

export default App;
