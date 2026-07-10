export const mouseTrailStorageKey = 'mouseTrailEnabled';
const legacyPopupMouseTrailStorageKey = 'popupMouseTrail';
const defaultMouseTrailEnabled = false;
export const defaultMouseTrailPreset = 'music';

export type MouseTrailPreset = 'star' | 'snowflake' | 'music';

export interface MouseTrailPreference {
  enabled: boolean;
  preset: MouseTrailPreset;
}

export const mouseTrailPresetOptions: Array<{ value: MouseTrailPreset; label: string }> = [
  { value: 'star', label: '星星' },
  { value: 'snowflake', label: '雪花' },
  { value: 'music', label: '音符' },
];

export const normalizeMouseTrailEnabled = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true';
  }

  return defaultMouseTrailEnabled;
};

export const normalizeMouseTrailPreset = (value: unknown): MouseTrailPreset => {
  return mouseTrailPresetOptions.some((option) => option.value === value)
    ? value as MouseTrailPreset
    : defaultMouseTrailPreset;
};

export const normalizeMouseTrailPreference = (value: unknown): MouseTrailPreference => {
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      return normalizeMouseTrailPreference(JSON.parse(value));
    } catch {
      return {
        enabled: defaultMouseTrailEnabled,
        preset: defaultMouseTrailPreset,
      };
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return {
      enabled: normalizeMouseTrailEnabled(record.enabled),
      preset: normalizeMouseTrailPreset(record.preset),
    };
  }

  return {
    enabled: normalizeMouseTrailEnabled(value),
    preset: defaultMouseTrailPreset,
  };
};

export const readStoredMouseTrailPreference = async (): Promise<MouseTrailPreference> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const snapshot = await chrome.storage.local.get([
        mouseTrailStorageKey,
        legacyPopupMouseTrailStorageKey,
      ]);
      return normalizeMouseTrailPreference(
        snapshot[mouseTrailStorageKey] ?? snapshot[legacyPopupMouseTrailStorageKey],
      );
    }
  } catch (error) {
    maLogger.warn('读取鼠标拖尾配置失败，使用本地缓存:', error);
  }

  try {
    return normalizeMouseTrailPreference(
      localStorage.getItem(mouseTrailStorageKey) ?? localStorage.getItem(legacyPopupMouseTrailStorageKey),
    );
  } catch {
    return {
      enabled: defaultMouseTrailEnabled,
      preset: defaultMouseTrailPreset,
    };
  }
};

export const readStoredMouseTrail = async (): Promise<boolean> => {
  return (await readStoredMouseTrailPreference()).enabled;
};

export const persistMouseTrail = async (preference: MouseTrailPreference | boolean): Promise<void> => {
  const normalizedPreference = normalizeMouseTrailPreference(preference);

  try {
    localStorage.setItem(mouseTrailStorageKey, JSON.stringify(normalizedPreference));
  } catch (error) {
    maLogger.warn('写入鼠标拖尾本地缓存失败:', error);
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [mouseTrailStorageKey]: normalizedPreference });
    }
  } catch (error) {
    maLogger.warn('保存鼠标拖尾配置失败:', error);
  }
};
