import { ref } from 'vue';
import {
  mouseTrailStorageKey,
  persistMouseTrail,
  readStoredMouseTrail,
} from '@/assets/composables/mouse/mouseTrailPreference';

export const popupMouseTrailStorageKey = mouseTrailStorageKey;

const defaultMouseTrailEnabled = false;
const isMouseTrailEnabled = ref(defaultMouseTrailEnabled);
const isMouseTrailLoaded = ref(false);

const isUsablePageTab = (tab: chrome.tabs.Tab | undefined): tab is chrome.tabs.Tab & { id: number } => {
  if (!tab?.id) {
    return false;
  }

  const url = tab.url || '';
  return !url.startsWith('chrome://')
    && !url.startsWith('chrome-extension://')
    && !url.startsWith('devtools://')
    && !url.startsWith('edge://')
    && !url.startsWith('about:');
};

const notifyCurrentPageMouseTrail = async (enabled: boolean): Promise<void> => {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!isUsablePageTab(activeTab)) {
      return;
    }

    await new Promise<void>((resolve) => {
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'TOGGLE_MOUSE_TRAIL',
        source: 'popup',
        target: 'content',
        payload: { enabled },
      }, () => {
        if (chrome.runtime.lastError) {
          maLogger.warn('当前页面暂未接收鼠标拖尾消息:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    });
  } catch (error) {
    maLogger.warn('通知当前页面更新鼠标拖尾失败:', error);
  }
};

export const usePopupMouseTrail = () => {
  const loadPopupMouseTrail = async (): Promise<void> => {
    if (isMouseTrailLoaded.value) {
      await notifyCurrentPageMouseTrail(isMouseTrailEnabled.value);
      return;
    }

    isMouseTrailEnabled.value = await readStoredMouseTrail();
    isMouseTrailLoaded.value = true;
    await notifyCurrentPageMouseTrail(isMouseTrailEnabled.value);
  };

  const setPopupMouseTrail = async (enabled: boolean): Promise<void> => {
    isMouseTrailEnabled.value = enabled;
    await persistMouseTrail(enabled);
    await notifyCurrentPageMouseTrail(enabled);
  };

  return {
    isMouseTrailEnabled,
    isMouseTrailLoaded,
    loadPopupMouseTrail,
    setPopupMouseTrail,
  };
};
