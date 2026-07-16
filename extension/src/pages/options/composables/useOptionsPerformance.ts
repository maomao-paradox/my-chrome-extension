import { computed, onMounted, onUnmounted, ref } from 'vue';

export type OptionsPerformanceLevel = 'low' | 'medium' | 'high';

export const DEFAULT_OPTIONS_PERFORMANCE_LEVEL: OptionsPerformanceLevel = 'high';

const EXTENSION_SETTINGS_KEY = 'extensionSettings';
const LOCAL_MIRROR_KEY = 'mria_options_performance_mode';
const VALID_LEVELS: OptionsPerformanceLevel[] = ['low', 'medium', 'high'];

const normalizeOptionsPerformanceLevel = (value: unknown): OptionsPerformanceLevel => {
  if (typeof value === 'string' && VALID_LEVELS.includes(value as OptionsPerformanceLevel)) {
    return value as OptionsPerformanceLevel;
  }

  return DEFAULT_OPTIONS_PERFORMANCE_LEVEL;
};

const readMirrorLevel = (): OptionsPerformanceLevel => {
  if (typeof window === 'undefined') {
    return DEFAULT_OPTIONS_PERFORMANCE_LEVEL;
  }

  return normalizeOptionsPerformanceLevel(window.localStorage.getItem(LOCAL_MIRROR_KEY));
};

const performanceLevelState = ref<OptionsPerformanceLevel>(readMirrorLevel());

let consumerCount = 0;
let storageSyncBound = false;

const syncOptionsPerformanceMirror = (value: unknown): OptionsPerformanceLevel => {
  const normalized = normalizeOptionsPerformanceLevel(value);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_MIRROR_KEY, normalized);
    } catch (error) {
      maLogger.warn('[useOptionsPerformance] Failed to sync performance mode mirror:', error);
    }
  }

  performanceLevelState.value = normalized;
  return normalized;
};

const canUseChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

const resolvePerformanceLevelFromSettings = (settings: unknown): OptionsPerformanceLevel => {
  if (!settings || typeof settings !== 'object') {
    return DEFAULT_OPTIONS_PERFORMANCE_LEVEL;
  }

  return normalizeOptionsPerformanceLevel((settings as Record<string, unknown>).performanceMode);
};

const applyPerformanceLevel = (value: unknown) => {
  return syncOptionsPerformanceMirror(value);
};

const loadOptionsPerformanceLevel = async () => {
  if (!canUseChromeStorage()) {
    applyPerformanceLevel(readMirrorLevel());
    return;
  }

  try {
    const snapshot = await chrome.storage.local.get(EXTENSION_SETTINGS_KEY);
    applyPerformanceLevel(resolvePerformanceLevelFromSettings(snapshot[EXTENSION_SETTINGS_KEY]));
  } catch (error) {
    maLogger.error('[useOptionsPerformance] Failed to load performance mode:', error);
    applyPerformanceLevel(readMirrorLevel());
  }
};

const handleChromeStorageChange = (changes: Record<string, any>, areaName: string) => {
  if (areaName !== 'local' || !changes[EXTENSION_SETTINGS_KEY]) {
    return;
  }

  applyPerformanceLevel(resolvePerformanceLevelFromSettings(changes[EXTENSION_SETTINGS_KEY].newValue));
};

const handleWindowStorageChange = (event: StorageEvent) => {
  if (event.key !== LOCAL_MIRROR_KEY) {
    return;
  }

  applyPerformanceLevel(event.newValue);
};

const bindStorageSync = () => {
  if (storageSyncBound) {
    return;
  }

  storageSyncBound = true;

  if (canUseChromeStorage()) {
    chrome.storage.onChanged.addListener(handleChromeStorageChange);
    return;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleWindowStorageChange);
  }
};

const unbindStorageSync = () => {
  if (!storageSyncBound) {
    return;
  }

  storageSyncBound = false;

  if (canUseChromeStorage()) {
    chrome.storage.onChanged.removeListener(handleChromeStorageChange);
    return;
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', handleWindowStorageChange);
  }
};

export const useOptionsPerformance = () => {
  onMounted(() => {
    consumerCount += 1;

    if (consumerCount === 1) {
      bindStorageSync();
      void loadOptionsPerformanceLevel();
    }
  });

  onUnmounted(() => {
    consumerCount = Math.max(0, consumerCount - 1);

    if (consumerCount === 0) {
      unbindStorageSync();
    }
  });

  return {
    performanceLevel: computed(() => performanceLevelState.value),
    isLowPerformance: computed(() => performanceLevelState.value === 'low'),
    isMediumPerformance: computed(() => performanceLevelState.value === 'medium'),
    isHighPerformance: computed(() => performanceLevelState.value === 'high')
  };
};

export {
  normalizeOptionsPerformanceLevel,
  resolvePerformanceLevelFromSettings,
  syncOptionsPerformanceMirror
};
