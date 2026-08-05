/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/composables/usePopupTheme.ts
 * @description React 版主题管理 Hook
 */
import { useState, useCallback } from 'react';

export const popupThemeStorageKey = 'popupTheme';

export const popupThemes = [
  {
    key: 'midnight',
    label: '深海',
    description: '深色高对比',
  },
  {
    key: 'daylight',
    label: '晨雾',
    description: '浅色柔和',
  },
  {
    key: 'jungle-knot',
    label: '故障结',
    description: '青紫故障色',
  },
  {
    key: 'retro-terminal',
    label: '黑白',
    description: '极简强对比',
  },
] as const;

export type PopupThemeKey = (typeof popupThemes)[number]['key'];

const defaultTheme: PopupThemeKey = 'midnight';

/**
 * 判断值是否为有效主题键
 */
const isPopupThemeKey = (value: unknown): value is PopupThemeKey => {
  return popupThemes.some((theme) => theme.key === value);
};

/**
 * 规范化主题键值
 */
const normalizeThemeKey = (value: unknown): PopupThemeKey => {
  return isPopupThemeKey(value) ? value : defaultTheme;
};

/**
 * 应用主题到文档根元素
 */
const applyTheme = (themeKey: PopupThemeKey): void => {
  document.documentElement.dataset.popupTheme = themeKey;
  document.body?.setAttribute('data-popup-theme', themeKey);
};

/**
 * 应用已存储的主题（用于入口初始化）
 */
export const applyStoredPopupThemeHint = (): void => {
  try {
    const storedTheme = localStorage.getItem(popupThemeStorageKey);
    const theme = normalizeThemeKey(storedTheme);
    applyTheme(theme);
  } catch {
    applyTheme(defaultTheme);
  }
};

/**
 * 从存储读取主题
 */
const readStoredTheme = async (): Promise<PopupThemeKey> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const snapshot = await chrome.storage.local.get(popupThemeStorageKey);
      return normalizeThemeKey(snapshot[popupThemeStorageKey]);
    }
  } catch (error) {
    maLogger.warn('读取 popup 主题失败，使用本地缓存:', error);
  }

  try {
    return normalizeThemeKey(localStorage.getItem(popupThemeStorageKey));
  } catch {
    return defaultTheme;
  }
};

/**
 * 持久化主题到存储
 */
const persistTheme = async (themeKey: PopupThemeKey): Promise<void> => {
  try {
    localStorage.setItem(popupThemeStorageKey, themeKey);
  } catch (error) {
    maLogger.warn('写入 popup 主题缓存失败:', error);
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [popupThemeStorageKey]: themeKey });
    }
  } catch (error) {
    maLogger.warn('保存 popup 主题失败:', error);
  }
};

/**
 * Popup 主题管理 Hook
 */
export const usePopupTheme = () => {
  const [activeTheme, setActiveTheme] = useState<PopupThemeKey>(defaultTheme);
  const [isLoaded, setIsLoaded] = useState(false);

  const activeThemeConfig = popupThemes.find(
    (theme) => theme.key === activeTheme,
  ) ?? popupThemes[0];

  const loadPopupTheme = useCallback(async (): Promise<void> => {
    const theme = await readStoredTheme();
    setActiveTheme(theme);
    applyTheme(theme);
    setIsLoaded(true);
  }, []);

  const setPopupTheme = useCallback(
    async (themeKey: PopupThemeKey): Promise<void> => {
      const nextTheme = normalizeThemeKey(themeKey);
      setActiveTheme(nextTheme);
      applyTheme(nextTheme);
      await persistTheme(nextTheme);
    },
    [],
  );

  return {
    activeTheme,
    activeThemeConfig,
    isLoaded,
    popupThemes,
    loadPopupTheme,
    setPopupTheme,
  };
};
