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
  LazyExoticComponent,
} from "react";
import GlassCursor from "@/components/cursors/GlassCursor";
import { STARSHIP_MODULES, StarshipPanelId } from "./views/starshipModules";
import Static404 from "@/components/Static404";
import ContentScriptDomainConfig from "./views/ContentScriptDomainConfig";
import ExtensionSettings from "./views/ExtensionSettings";
import ErrorMonitorConfig from "./views/ErrorMonitorConfig";
import BrowserVarView from "./views/BrowserVarView";
import XHRuleOption from "./views/XHRuleOption";
import AITerminalView from "./views/AITerminalView";
import KnowledgeGraphView from "./views/KnowledgeGraphView";
import UserOption from "./views/UserOption";
import "./views/options-views.scss";
import SlicedText from "@/components/SlicedText";
import TextScramble from "@/components/TextScramble";
import NavigationCircle from "@/components/NavigationCircle";
import Aladdin from "@/components/Aladdin";

// 懒加载组件
const HeroSection = lazy(() => import("./views/HeroSection"));
type PerformanceLevel = "low" | "medium" | "high";

const PERFORMANCE_BODY_CLASSES = [
  "options-performance-low",
  "options-performance-medium",
  "options-performance-high",
] as const;

const componentMap: Record<
  StarshipPanelId,
  ComponentType | LazyExoticComponent<React.FC<any>>
> = {
  main: HeroSection,
  top: ErrorMonitorConfig,
  "top-left": XHRuleOption,
  "top-right": BrowserVarView,
  left: ExtensionSettings,
  right: UserOption,
  bottom: ContentScriptDomainConfig,
  "bottom-left": KnowledgeGraphView,
  "bottom-right": AITerminalView,
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
      <GlassCursor />
      <SlicedText text="Sliced" />
      <TextScramble
        phrases={[
          "Neo,",
          "sooner or later",
          "you're going to realize",
          "just as I did",
          "that there's a difference",
          "between knowing the path",
          "and walking the path",
        ]}
        chars="!<>-_\/[]{}?=+*^?#________"
        speed={800}
      />
      <div style={{ height: "100vh" }}>
        <Aladdin />
      </div>
      <NavigationCircle />
    </main>
  );
};

export default App;
