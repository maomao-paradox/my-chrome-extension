/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/config/index.ts
 * @date 2026-02-05T02:38:01.693Z
 */

import { defaultPluginConfigs } from "@/apps";
import { getAssetsAbstractPath } from "@/utils/common";
import { ModuleOption } from "@/utils/esm-module-loader";

export const appConfigKey = "appConfig";
export const shadowHostId = "ma-extension-shadow-host";
export const domainConfigsKey = "domainConfigs";

// 公共配置
const getContentScriptUrl = async (domain: string) =>
  await getAssetsAbstractPath(`js/content/content-${domain}`);
const getAppEntryUrl = async (appName: string) =>
  await getAssetsAbstractPath(`js/apps/${appName}`);

export const contentDomains = import.meta.env.VITE_CONTENT_DOMAIN?.split(
  ",",
) || ["Radius", "Zentao", "Mria", "Qapro", "Teach", "Lanhuapp", "Portainer"];

export const contentModules: Map<string, ModuleOption> = contentDomains.reduce(
  (acc: Map<string, ModuleOption>, domain: string) =>
    acc.set(domain, {
      domainKey: `content${domain}Domains`,
      flag: `__CONTENT_SCRIPT_${domain.toUpperCase()}`,
      path: getContentScriptUrl(domain.toLowerCase()),
    }),
  new Map(),
);

const configuredAppDomains = import.meta.env.VITE_APP_DOMAIN?.split(",") || [
  ...Object.keys(defaultPluginConfigs),
];

// 广告拦截器需要在页面初始化时加载，不能因自定义 VITE_APP_DOMAIN 而漏打包。
export const appDomains = Array.from(
  new Set([...configuredAppDomains, "adBlocker"]),
);

export const appModules = appDomains.reduce(
  (acc: Map<string, ModuleOption>, domain: string) =>
    acc.set(domain, {
      flag: `__APP_${domain.toUpperCase()}`,
      path: getAppEntryUrl(domain),
    }),
  new Map<string, ModuleOption>(),
);
