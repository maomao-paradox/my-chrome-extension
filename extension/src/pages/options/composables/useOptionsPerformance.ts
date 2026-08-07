import { useState, useEffect, useCallback, useRef } from "react";

// ============ 类型定义 ============
export type OptionsPerformanceLevel = "low" | "medium" | "high";

// ============ 常量 ============
export const DEFAULT_OPTIONS_PERFORMANCE_LEVEL: OptionsPerformanceLevel =
  "high";

const EXTENSION_SETTINGS_KEY = "extensionSettings";
const LOCAL_MIRROR_KEY = "mria_options_performance_mode";
const VALID_LEVELS: OptionsPerformanceLevel[] = ["low", "medium", "high"];

// ============ 工具函数 ============
export const normalizeOptionsPerformanceLevel = (
  value: unknown,
): OptionsPerformanceLevel => {
  if (
    typeof value === "string" &&
    VALID_LEVELS.includes(value as OptionsPerformanceLevel)
  ) {
    return value as OptionsPerformanceLevel;
  }

  return DEFAULT_OPTIONS_PERFORMANCE_LEVEL;
};

const readMirrorLevel = (): OptionsPerformanceLevel => {
  if (typeof window === "undefined") {
    return DEFAULT_OPTIONS_PERFORMANCE_LEVEL;
  }

  return normalizeOptionsPerformanceLevel(
    window.localStorage.getItem(LOCAL_MIRROR_KEY),
  );
};

export const resolvePerformanceLevelFromSettings = (
  settings: unknown,
): OptionsPerformanceLevel => {
  if (!settings || typeof settings !== "object") {
    return DEFAULT_OPTIONS_PERFORMANCE_LEVEL;
  }

  return normalizeOptionsPerformanceLevel(
    (settings as Record<string, unknown>).performanceMode,
  );
};

export const syncOptionsPerformanceMirror = (
  value: unknown,
): OptionsPerformanceLevel => {
  const normalized = normalizeOptionsPerformanceLevel(value);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_MIRROR_KEY, normalized);
    } catch (error) {
      console.warn(
        "[useOptionsPerformance] Failed to sync performance mode mirror:",
        error,
      );
    }
  }

  return normalized;
};

// ============ 全局状态管理 ============
const canUseChromeStorage = (): boolean =>
  typeof chrome !== "undefined" && !!chrome.storage?.local;

// 使用模块级变量替代 Vue 的 ref（因为它们需要在多个 hook 实例间共享）
let currentPerformanceLevel: OptionsPerformanceLevel = readMirrorLevel();
const listeners = new Set<(level: OptionsPerformanceLevel) => void>();
let consumerCount = 0;
let storageSyncBound = false;

const notifyListeners = (level: OptionsPerformanceLevel) => {
  currentPerformanceLevel = level;
  listeners.forEach((listener) => listener(level));
};

const applyPerformanceLevel = (value: unknown): OptionsPerformanceLevel => {
  const normalized = syncOptionsPerformanceMirror(value);
  notifyListeners(normalized);
  return normalized;
};

const loadOptionsPerformanceLevel = async (): Promise<void> => {
  if (!canUseChromeStorage()) {
    applyPerformanceLevel(readMirrorLevel());
    return;
  }

  try {
    const snapshot = await chrome.storage.local.get(EXTENSION_SETTINGS_KEY);
    applyPerformanceLevel(
      resolvePerformanceLevelFromSettings(snapshot[EXTENSION_SETTINGS_KEY]),
    );
  } catch (error) {
    console.error(
      "[useOptionsPerformance] Failed to load performance mode:",
      error,
    );
    applyPerformanceLevel(readMirrorLevel());
  }
};

const handleChromeStorageChange = (
  changes: Record<string, any>,
  areaName: string,
): void => {
  if (areaName !== "local" || !changes[EXTENSION_SETTINGS_KEY]) {
    return;
  }

  applyPerformanceLevel(
    resolvePerformanceLevelFromSettings(
      changes[EXTENSION_SETTINGS_KEY].newValue,
    ),
  );
};

const handleWindowStorageChange = (event: StorageEvent): void => {
  if (event.key !== LOCAL_MIRROR_KEY) {
    return;
  }

  applyPerformanceLevel(event.newValue);
};

const bindStorageSync = (): void => {
  if (storageSyncBound) {
    return;
  }

  storageSyncBound = true;

  if (canUseChromeStorage()) {
    chrome.storage.onChanged.addListener(handleChromeStorageChange);
    return;
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleWindowStorageChange);
  }
};

const unbindStorageSync = (): void => {
  if (!storageSyncBound) {
    return;
  }

  storageSyncBound = false;

  if (canUseChromeStorage()) {
    chrome.storage.onChanged.removeListener(handleChromeStorageChange);
    return;
  }

  if (typeof window !== "undefined") {
    window.removeEventListener("storage", handleWindowStorageChange);
  }
};

// ============ React Hook ============
export interface UseOptionsPerformanceReturn {
  performanceLevel: OptionsPerformanceLevel;
  isLowPerformance: boolean;
  isMediumPerformance: boolean;
  isHighPerformance: boolean;
}

export const useOptionsPerformance = (): UseOptionsPerformanceReturn => {
  const [performanceLevel, setPerformanceLevel] =
    useState<OptionsPerformanceLevel>(currentPerformanceLevel);

  const listenerRef = useRef<(level: OptionsPerformanceLevel) => void>(null);

  // 创建监听器
  const listener = useCallback((level: OptionsPerformanceLevel) => {
    setPerformanceLevel(level);
  }, []);

  useEffect(() => {
    // 注册消费者
    consumerCount += 1;

    if (consumerCount === 1) {
      bindStorageSync();
      loadOptionsPerformanceLevel();
    }

    // 注册当前实例的监听器
    listenerRef.current = listener;
    listeners.add(listener);

    // 如果当前状态与全局状态不同步，立即同步
    if (performanceLevel !== currentPerformanceLevel) {
      setPerformanceLevel(currentPerformanceLevel);
    }

    return () => {
      // 移除监听器
      if (listenerRef.current) {
        listeners.delete(listenerRef.current);
      }

      // 注销消费者
      consumerCount = Math.max(0, consumerCount - 1);

      if (consumerCount === 0) {
        unbindStorageSync();
      }
    };
  }, [listener]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    performanceLevel,
    isLowPerformance: performanceLevel === "low",
    isMediumPerformance: performanceLevel === "medium",
    isHighPerformance: performanceLevel === "high",
  };
};

export default useOptionsPerformance;
