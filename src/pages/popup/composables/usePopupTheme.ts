import { computed, ref } from 'vue';

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
] as const;

export type PopupThemeKey = (typeof popupThemes)[number]['key'];

const defaultTheme: PopupThemeKey = 'midnight';
const activeTheme = ref<PopupThemeKey>(defaultTheme);
const isLoaded = ref(false);

const isPopupThemeKey = (value: unknown): value is PopupThemeKey => {
  return popupThemes.some((theme) => theme.key === value);
};

const normalizeThemeKey = (value: unknown): PopupThemeKey => {
  return isPopupThemeKey(value) ? value : defaultTheme;
};

const applyTheme = (themeKey: PopupThemeKey): void => {
  document.documentElement.dataset.popupTheme = themeKey;
  document.body?.setAttribute('data-popup-theme', themeKey);
};

export const applyStoredPopupThemeHint = (): void => {
  try {
    const storedTheme = localStorage.getItem(popupThemeStorageKey);
    activeTheme.value = normalizeThemeKey(storedTheme);
  } catch {
    activeTheme.value = defaultTheme;
  }

  applyTheme(activeTheme.value);
};

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

export const usePopupTheme = () => {
  const activeThemeConfig = computed(() => {
    return popupThemes.find((theme) => theme.key === activeTheme.value) ?? popupThemes[0];
  });

  const loadPopupTheme = async (): Promise<void> => {
    activeTheme.value = await readStoredTheme();
    applyTheme(activeTheme.value);
    isLoaded.value = true;
  };

  const setPopupTheme = async (themeKey: PopupThemeKey): Promise<void> => {
    const nextTheme = normalizeThemeKey(themeKey);
    activeTheme.value = nextTheme;
    applyTheme(nextTheme);
    await persistTheme(nextTheme);
  };

  return {
    activeTheme,
    activeThemeConfig,
    isLoaded,
    popupThemes,
    loadPopupTheme,
    setPopupTheme,
  };
};
