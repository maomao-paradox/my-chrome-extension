/**
 * @file src/pages/options/App.tsx
 * @description Options 页面 React 根组件。
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  CSSProperties,
  ComponentType,
  lazy,
  Suspense,
} from "react";
import GlassCursor from "@components/cursors/GlassCursor";
import PanelNav, {
  DIRECTION_OFFSETS,
  Panel,
  PanelBase,
  PanelNavs,
} from "@components/layout/PanelNav";
import { STARSHIP_MODULES, StarshipPanelId } from "./views/starshipModules";
import Static404 from "@/assets/components/Static404";

// 懒加载组件
// const HeroSection = lazy(() => import('@/pages/options/views/HeroSection'));
// const ContentScriptDomainConfig = lazy(() => import('@/pages/options/views/ContentScriptDomainConfig'));
// const UserOption = lazy(() => import('@/pages/options/views/UserOption'));
// const ExtensionSettings = lazy(() => import('@/pages/options/views/ExtensionSettings'));
// const ErrorMonitorConfig = lazy(() => import('@/pages/options/views/ErrorMonitorConfig'));
// const BrowserVarView = lazy(() => import('@/pages/options/views/BrowserVarView'));
// const XHRuleOption = lazy(() => import('@/pages/options/views/XHRuleOption'));
// const AITerminalView = lazy(() => import('@/pages/options/views/AITerminalView'));
// const KnowledgeGraphView = lazy(() => import('@/pages/options/views/KnowledgeGraphView'));
// const TacticalOverview = lazy(() => import('@/pages/options/views/TacticalOverview'));

type PerformanceLevel = "low" | "medium" | "high";

const PERFORMANCE_BODY_CLASSES = [
  "options-performance-low",
  "options-performance-medium",
  "options-performance-high",
] as const;

const componentMap: Record<StarshipPanelId, ComponentType | React.ReactNode> = {
  main: Static404,
  top: Static404,
  "top-left": Static404,
  "top-right": Static404,
  left: Static404,
  right: Static404,
  bottom: Static404,
  "bottom-left": Static404,
  "bottom-right": Static404,
};

const createBasePanels = (): Record<StarshipPanelId, PanelBase> => {
  return STARSHIP_MODULES.reduce(
    (acc, module) => {
      acc[module.id] = {
        xPos: module.position.x,
        yPos: module.position.y,
        page: componentMap[module.id] || Static404,
        title: module.title,
        meta: module,
      };
      return acc;
    },
    {} as Record<StarshipPanelId, PanelBase>,
  );
};

const buildPanels = (): Record<string, Panel> => {
  const basePanels = createBasePanels();
  const entries = Object.entries(basePanels) as [string, PanelBase][];

  return entries.reduce(
    (acc, [key, panel]) => {
      const navs = Object.entries(DIRECTION_OFFSETS).reduce(
        (navAcc, [direction, offset]) => {
          navAcc[direction as keyof PanelNavs] = entries.some(
            ([, candidate]) =>
              candidate.xPos === panel.xPos + offset.x &&
              candidate.yPos === panel.yPos + offset.y,
          );
          return navAcc;
        },
        {} as PanelNavs,
      );

      acc[key] = {
        ...panel,
        navs,
      };
      return acc;
    },
    {} as Record<string, Panel>,
  );
};

const normalizePerformanceLevel = (value: unknown): PerformanceLevel => {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "high";
};

const canUseChromeStorage = () =>
  typeof chrome !== "undefined" && !!chrome.storage?.local;

const readPerformanceLevel = async (): Promise<PerformanceLevel> => {
  if (!canUseChromeStorage()) {
    return normalizePerformanceLevel(
      localStorage.getItem("mria_options_performance_mode"),
    );
  }

  try {
    const snapshot = await chrome.storage.local.get("extensionSettings");
    const settings = snapshot.extensionSettings as
      | { performanceMode?: unknown }
      | undefined;
    return normalizePerformanceLevel(settings?.performanceMode);
  } catch (error) {
    console.warn("[options] Failed to load performance mode:", error);
    return normalizePerformanceLevel(
      localStorage.getItem("mria_options_performance_mode"),
    );
  }
};

const App = () => {
  const [performanceLevel, setPerformanceLevel] =
    useState<PerformanceLevel>("high");

  const panels = buildPanels();

  useEffect(() => {
    let disposed = false;

    const applyPerformanceClass = (level: PerformanceLevel) => {
      if (disposed) {
        return;
      }

      setPerformanceLevel(level);
      document.body.classList.add("options-page-body");
      PERFORMANCE_BODY_CLASSES.forEach((className) =>
        document.body.classList.remove(className),
      );
      document.body.classList.add(`options-performance-${level}`);
      localStorage.setItem("mria_options_performance_mode", level);
    };

    void readPerformanceLevel().then(applyPerformanceClass);

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes.extensionSettings) {
        return;
      }
      const nextSettings = changes.extensionSettings.newValue as
        | { performanceMode?: unknown }
        | undefined;
      applyPerformanceClass(
        normalizePerformanceLevel(nextSettings?.performanceMode),
      );
    };

    if (canUseChromeStorage()) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      disposed = true;
      document.body.classList.remove("options-page-body");
      PERFORMANCE_BODY_CLASSES.forEach((className) =>
        document.body.classList.remove(className),
      );
      if (canUseChromeStorage()) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  return (
    <main className={`options-page options-page--${performanceLevel}`}>
      {performanceLevel === "high" ? <GlassCursor /> : null}
      <PanelNav shipModules={panels} />
    </main>
  );
};

export default App;
