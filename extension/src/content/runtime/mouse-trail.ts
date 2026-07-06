import { useMusicNoteTrails } from '@/assets/composables/mouse/useStarTrails';
import {
  mouseTrailStorageKey,
  normalizeMouseTrailEnabled,
  readStoredMouseTrail,
} from '@/assets/composables/mouse/mouseTrailPreference';

let trailControls: ReturnType<typeof useMusicNoteTrails> | null = null;
let storageListenerInstalled = false;

export const applyWebpageMouseTrail = (enabled: boolean): void => {
  if (enabled) {
    if (!trailControls?.isRunning()) {
      trailControls = useMusicNoteTrails({
        hostId: 'webpage-music-note-trails-host',
        canvasId: 'webpage-music-note-trails-canvas',
        maxParticles: 50, // 最大音符数量
        spawnInterval: 250, // 生成音符的间隔时间（毫秒）
        burstCount: 5, // 每次点击鼠标生成的音符数量
        jitter: 15, // 随机偏移量（像素）
        zIndex: 2147483646
      });
    }
    return;
  }

  trailControls?.stop();
  trailControls = null;
};

const installMouseTrailStorageListener = (): void => {
  if (storageListenerInstalled || typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[mouseTrailStorageKey]) {
      return;
    }

    applyWebpageMouseTrail(normalizeMouseTrailEnabled(changes[mouseTrailStorageKey].newValue));
  });
  storageListenerInstalled = true;
};

export const initializeWebpageMouseTrail = async (): Promise<void> => {
  installMouseTrailStorageListener();
  applyWebpageMouseTrail(await readStoredMouseTrail());
};
