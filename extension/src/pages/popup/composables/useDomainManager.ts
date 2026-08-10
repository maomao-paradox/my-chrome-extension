/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/composables/useDomainManager.ts
 * @description React 版域名配置管理 Hook
 */
import { useCallback, useRef } from "react";
import { contentDomains, domainConfigsKey } from "@/config";
import { storage } from "@/stores";

/**
 * 域名配置项类型
 */
export interface DomainConfigItem {
  enabled: boolean;
  domains: string;
}

/**
 * 域名配置类型
 */
export interface DomainConfigs {
  [key: string]: DomainConfigItem;
}

/**
 * 域名配置管理 Hook
 */
export const useDomainManager = () => {
  const domainConfigs = useRef<DomainConfigs>({});

  /**
   * 加载域名配置
   */
  const loadDomainConfigs = useCallback(async (): Promise<void> => {
    try {
      if (!chrome.storage) {
        console.warn("local storage not available, use test data");
        const testConfigs = contentDomains.reduce((acc, domain) => {
          acc[domain] = {
            enabled: true,
            domains: "",
          };
          return acc;
        }, {} as DomainConfigs);
        domainConfigs.current = testConfigs;
        return;
      }
      let configs = await storage.ext.local.get(domainConfigsKey, null);

      // 当没有存储配置时，使用默认配置
      if (!configs || Object.keys(configs).length === 0) {
        configs = contentDomains.reduce((acc, domain) => {
          acc[domain] = {
            enabled: true,
            domains: "",
          };
          return acc;
        }, {} as DomainConfigs);
        configs["Eve"] = { enabled: true, domains: "*:*" };
        await storage.ext.local.set(domainConfigsKey, configs);
      }
      domainConfigs.current = configs;
    } catch (error) {
      maLogger.error("加载域名配置失败:", error);
    }
  }, []);

  const saveDomainConfigs = async (
    domainConfigs: DomainConfigs,
  ): Promise<void> => {
    try {
      await storage.ext.local.set(domainConfigsKey, domainConfigs);
    } catch (error) {
      maLogger.error("保存域名配置失败:", error);
    }
  };

  return {
    domainConfigs,
    loadDomainConfigs,
    saveDomainConfigs,
  };
};
