/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/composables/usePopupMouseTrail.ts
 * @description React 版鼠标拖尾管理 Hook
 */
import { useState, useCallback, useRef } from "react";
import {
  defaultMouseTrailPreset,
  normalizeMouseTrailPreset,
  persistMouseTrail,
  readStoredMouseTrailPreference,
  type MouseTrailPreference,
  type MouseTrailPreset,
} from "@/assets/composables/mouse/mouseTrailPreference";

export const popupMouseTrailStorageKey = "mouseTrail";

/**
 * 判断是否为可用的页面标签
 */
const isUsablePageTab = (
  tab: chrome.tabs.Tab | undefined,
): tab is chrome.tabs.Tab & { id: number } => {
  if (!tab?.id) {
    return false;
  }

  const url = tab.url || "";
  return (
    !url.startsWith("chrome://") &&
    !url.startsWith("chrome-extension://") &&
    !url.startsWith("devtools://") &&
    !url.startsWith("edge://") &&
    !url.startsWith("about:")
  );
};

/**
 * Popup 鼠标拖尾管理 Hook
 */
export const usePopupMouseTrail = () => {
  const [isMouseTrailEnabled, setIsMouseTrailEnabled] = useState(false);
  const [mouseTrailPreset, setMouseTrailPreset] = useState<MouseTrailPreset>(
    defaultMouseTrailPreset,
  );
  const isMouseTrailLoadedRef = useRef(false);

  /**
   * 获取当前偏好设置
   */
  const getCurrentPreference = (): MouseTrailPreference => ({
    enabled: isMouseTrailEnabled,
    preset: mouseTrailPreset,
  });

  /**
   * 通知当前页面更新鼠标拖尾
   */
  const notifyCurrentPageMouseTrail = async (
    preference: MouseTrailPreference,
  ): Promise<void> => {
    try {
      if (typeof chrome === "undefined" || !chrome.tabs) {
        return;
      }

      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTab = tabs[0];

      if (!isUsablePageTab(activeTab)) {
        return;
      }

      await new Promise<void>((resolve) => {
        chrome.tabs.sendMessage(
          activeTab.id,
          {
            type: "TOGGLE_MOUSE_TRAIL",
            source: "popup",
            target: "content",
            payload: preference,
          },
          () => {
            if (chrome.runtime.lastError) {
              maLogger.warn(
                "当前页面暂未接收鼠标拖尾消息:",
                chrome.runtime.lastError.message,
              );
            }
            resolve();
          },
        );
      });
    } catch (error) {
      maLogger.warn("通知当前页面更新鼠标拖尾失败:", error);
    }
  };

  /**
   * 加载鼠标拖尾设置
   */
  const loadPopupMouseTrail = useCallback(async (): Promise<void> => {
    if (isMouseTrailLoadedRef.current) {
      await notifyCurrentPageMouseTrail(getCurrentPreference());
      return;
    }

    const preference = await readStoredMouseTrailPreference();
    setIsMouseTrailEnabled(preference.enabled);
    setMouseTrailPreset(preference.preset);
    isMouseTrailLoadedRef.current = true;
    await notifyCurrentPageMouseTrail(preference);
  }, [isMouseTrailLoadedRef, isMouseTrailEnabled, mouseTrailPreset]);

  /**
   * 设置鼠标拖尾启用状态
   */
  const setPopupMouseTrail = useCallback(
    async (enabled: boolean): Promise<void> => {
      setIsMouseTrailEnabled(enabled);
      const preference: MouseTrailPreference = {
        enabled,
        preset: mouseTrailPreset,
      };
      await persistMouseTrail(preference);
      await notifyCurrentPageMouseTrail(preference);
    },
    [mouseTrailPreset],
  );

  /**
   * 设置鼠标拖尾预设
   */
  const setPopupMouseTrailPreset = useCallback(
    async (preset: MouseTrailPreset): Promise<void> => {
      const normalized = normalizeMouseTrailPreset(preset);
      setMouseTrailPreset(normalized);
      const preference: MouseTrailPreference = {
        enabled: isMouseTrailEnabled,
        preset: normalized,
      };
      await persistMouseTrail(preference);
      await notifyCurrentPageMouseTrail(preference);
    },
    [isMouseTrailEnabled],
  );

  return {
    isMouseTrailEnabled,
    mouseTrailPreset,
    isMouseTrailLoadedRef,
    loadPopupMouseTrail,
    setPopupMouseTrail,
    setPopupMouseTrailPreset,
  };
};
