/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/composables/usePluginManager.ts
 * @description React 版插件配置管理 Hook
 */
import { useState, useCallback } from "react";
import { appConfigKey } from "@/config";
import { storage } from "@/stores";
import { type PluginConfigMap } from "@/types";
import { defaultPluginConfigs } from "@/apps";

/**
 * 插件配置管理 Hook
 */
export const usePluginManager = () => {
  const [pluginConfigs, setPluginConfigs] =
    useState<PluginConfigMap>(defaultPluginConfigs);
  const [isLoaded, setIsLoaded] = useState(false);

  /**
   * 加载插件配置
   */
  const loadPluginConfigs = async (): Promise<void> => {
    try {
      if (!chrome.storage) {
        console.warn("local storage not available, use test data");
        setPluginConfigs(defaultPluginConfigs);
        setIsLoaded(true);
        return;
      }
      const configs = await storage.ext.local.get(appConfigKey, null);
      // 当没有存储配置时（返回 null 或空对象），使用默认配置
      if (!configs || Object.keys(configs).length === 0) {
        await storage.ext.local.set(appConfigKey, defaultPluginConfigs);
        setPluginConfigs(defaultPluginConfigs);
      } else {
        // 比较本地存储的配置和最新配置，更新默认配置
        // 新增的配置要补充到里面
        // 如果本地配置多，则保留本地配置，但是不展示在设置页面
        const allowedConfigKeys = Object.keys(defaultPluginConfigs);
        setPluginConfigs(
          allowedConfigKeys.reduce(
            (acc, key) => ({
              ...acc,
              [key]: configs[key] || defaultPluginConfigs[key],
            }),
            {} as PluginConfigMap,
          ),
        );
      }
      setIsLoaded(true);
    } catch (error) {
      maLogger.error("加载插件配置失败:", error);
      setPluginConfigs(defaultPluginConfigs);
      setIsLoaded(true);
    }
  };

  return {
    pluginConfigs,
    setPluginConfigs,
    loadPluginConfigs,
    isLoaded,
  };
};
