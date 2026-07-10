import { useMusicNoteTrails } from '@/assets/composables/mouse/useStarTrails';
import {
  mouseTrailStorageKey,
  normalizeMouseTrailPreference,
  readStoredMouseTrailPreference,
  type MouseTrailPreference,
  type MouseTrailPreset,
} from '@/assets/composables/mouse/mouseTrailPreference';

let trailControls: ReturnType<typeof useMusicNoteTrails> | null = null;
let storageListenerInstalled = false;
let activePreset: MouseTrailPreset | null = null;

export const applyWebpageMouseTrail = (preference: MouseTrailPreference | boolean): void => {
  const { enabled, preset } = normalizeMouseTrailPreference(preference);

  if (enabled) {
    if (trailControls?.isRunning() && activePreset !== preset) {
      trailControls.stop();
      trailControls = null;
      activePreset = null;
    }

    if (!trailControls?.isRunning()) {
      trailControls = useMusicNoteTrails({
        hostId: 'webpage-music-note-trails-host',
        canvasId: 'webpage-music-note-trails-canvas',
        preset,
        maxParticles: 50, // 最大粒子数量
        spawnInterval: 250, // 生成粒子的间隔时间（毫秒）
        burstCount: 5, // 每次点击鼠标生成的粒子数量
        jitter: 15, // 随机偏移量（像素）
        zIndex: 2147483646
      });
      activePreset = preset;
    }
    return;
  }

  trailControls?.stop();
  trailControls = null;
  activePreset = null;
};

const installMouseTrailStorageListener = (): void => {
  if (storageListenerInstalled || typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[mouseTrailStorageKey]) {
      return;
    }

    applyWebpageMouseTrail(normalizeMouseTrailPreference(changes[mouseTrailStorageKey].newValue));
  });
  storageListenerInstalled = true;
};

export const initializeWebpageMouseTrail = async (): Promise<void> => {
  installMouseTrailStorageListener();
  applyWebpageMouseTrail(await readStoredMouseTrailPreference());
};
