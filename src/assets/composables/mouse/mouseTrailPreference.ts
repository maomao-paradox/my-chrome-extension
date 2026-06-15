export const mouseTrailStorageKey = 'mouseTrailEnabled';
const legacyPopupMouseTrailStorageKey = 'popupMouseTrail';
const defaultMouseTrailEnabled = false;

export const normalizeMouseTrailEnabled = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true';
  }

  return defaultMouseTrailEnabled;
};

export const readStoredMouseTrail = async (): Promise<boolean> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const snapshot = await chrome.storage.local.get([
        mouseTrailStorageKey,
        legacyPopupMouseTrailStorageKey,
      ]);
      return normalizeMouseTrailEnabled(
        snapshot[mouseTrailStorageKey] ?? snapshot[legacyPopupMouseTrailStorageKey],
      );
    }
  } catch (error) {
    maLogger.warn('读取鼠标拖尾配置失败，使用本地缓存:', error);
  }

  try {
    return normalizeMouseTrailEnabled(
      localStorage.getItem(mouseTrailStorageKey) ?? localStorage.getItem(legacyPopupMouseTrailStorageKey),
    );
  } catch {
    return defaultMouseTrailEnabled;
  }
};

export const persistMouseTrail = async (enabled: boolean): Promise<void> => {
  try {
    localStorage.setItem(mouseTrailStorageKey, String(enabled));
  } catch (error) {
    maLogger.warn('写入鼠标拖尾本地缓存失败:', error);
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [mouseTrailStorageKey]: enabled });
    }
  } catch (error) {
    maLogger.warn('保存鼠标拖尾配置失败:', error);
  }
};
