/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/config/index.ts
 * @date 2026-02-05T02:38:01.693Z
 */

import { getAssetsAbstractPath } from '@/utils/common';
import { ModuleOption } from '@/utils/esm-module-loader';

export const appConfigKey = 'appConfig';
export const shadowHostId = 'ma-extension-shadow-host';
export const domainConfigsKey = 'domainConfigs';

// 公共配置
const getContentScriptUrl = async (domain: string) => await getAssetsAbstractPath(`js/content/content-${domain}`);
const getAppEntryUrl = async (appName: string) => await getAssetsAbstractPath(`js/apps/${appName}`);

export const contentDomains = ['Radius', 'Zentao', 'Mria', 'Qapro', 'Teach', 'Lanhuapp', 'Portainer'];

export const contentModules = contentDomains.reduce((acc, domain) => acc.set(domain, {
  domainKey: `content${domain}Domains`,
  flag: `__CONTENT_SCRIPT_${domain.toUpperCase()}`,
  path: getContentScriptUrl(domain.toLowerCase())
}), new Map<string, ModuleOption>());

const appDomains = ['sidebar', 'floatingball', 'pianoEffect', 'textSelectionToolbar', 'componentCapture', 'errorMonitor', 'menu'];

export const appModules = appDomains.reduce((acc, domain) => acc.set(domain, {
  flag: `__APP_${domain.toUpperCase()}`,
  path: getAppEntryUrl(domain)
}), new Map<string, ModuleOption>());
