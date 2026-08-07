/**
 * @file src/pages/options/App.tsx
 * @description Options 页面 React 根组件。
 */
import { useEffect, useState } from 'react';
import GlassCursor from '@components/cursors/GlassCursor';
import PanelNav from '@components/layout/PanelNav';

type PerformanceLevel = 'low' | 'medium' | 'high';

const PERFORMANCE_BODY_CLASSES = [
  'options-performance-low',
  'options-performance-medium',
  'options-performance-high',
] as const;

const normalizePerformanceLevel = (value: unknown): PerformanceLevel => {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'high';
};

const canUseChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

const readPerformanceLevel = async (): Promise<PerformanceLevel> => {
  if (!canUseChromeStorage()) {
    return normalizePerformanceLevel(localStorage.getItem('mria_options_performance_mode'));
  }

  try {
    const snapshot = await chrome.storage.local.get('extensionSettings');
    const settings = snapshot.extensionSettings as { performanceMode?: unknown } | undefined;
    return normalizePerformanceLevel(settings?.performanceMode);
  } catch (error) {
    console.warn('[options] Failed to load performance mode:', error);
    return normalizePerformanceLevel(localStorage.getItem('mria_options_performance_mode'));
  }
};

const App = () => {
  const [performanceLevel, setPerformanceLevel] = useState<PerformanceLevel>('high');

  useEffect(() => {
    let disposed = false;

    const applyPerformanceClass = (level: PerformanceLevel) => {
      if (disposed) {
        return;
      }

      setPerformanceLevel(level);
      document.body.classList.add('options-page-body');
      PERFORMANCE_BODY_CLASSES.forEach((className) => document.body.classList.remove(className));
      document.body.classList.add(`options-performance-${level}`);
      localStorage.setItem('mria_options_performance_mode', level);
    };

    void readPerformanceLevel().then(applyPerformanceClass);

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local' || !changes.extensionSettings) {
        return;
      }
      const nextSettings = changes.extensionSettings.newValue as { performanceMode?: unknown } | undefined;
      applyPerformanceClass(normalizePerformanceLevel(nextSettings?.performanceMode));
    };

    if (canUseChromeStorage()) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      disposed = true;
      document.body.classList.remove('options-page-body');
      PERFORMANCE_BODY_CLASSES.forEach((className) => document.body.classList.remove(className));
      if (canUseChromeStorage()) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  return (
    <main className={`options-page options-page--${performanceLevel}`}>
      {performanceLevel === 'high' ? <GlassCursor /> : null}
      <PanelNav />
    </main>
  );
};

export default App;
