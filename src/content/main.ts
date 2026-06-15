/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/index.ts
 * @date 2026-02-05T02:38:01.694Z
 */

import { installGlobalLogger } from '@/utils/logger';

type DomainConfig = {
    enabled?: boolean;
    domains?: string;
};

type DomainConfigs = Record<string, DomainConfig | string | undefined>;

const DISABLED_DOMAINS_KEY = 'disabledDomains';
const DOMAIN_CONFIGS_KEY = 'domainConfigs';
const EXTENSION_CONFIGS_KEY = 'extensionSettings';
const ROOT_PERMISSION_KEY = 'Eve';
const LOGGER_TITLE = 'ZERO DEBUG';

installGlobalLogger({ title: LOGGER_TITLE, enabled: false });

const parseDomains = (domainsString: string): [string, string][] => {
    if (!domainsString) {
        return [];
    }

    return domainsString
        .split(',')
        .map((domain) => {
            const parts = domain.trim().split(':');
            return (parts.length === 1 ? [parts[0], '*'] : parts) as [string, string];
        })
        .filter(([hostname]) => Boolean(hostname));
};

const getDomainConfig = (domainConfigs: DomainConfigs, key: string): DomainConfig | null => {
    const config = domainConfigs[key];

    if (!config) {
        return null;
    }

    if (typeof config === 'string') {
        return {
            enabled: true,
            domains: config,
        };
    }

    return config;
};

const isDomainAllowed = (domainConfigs: DomainConfigs, key: string): boolean => {
    const config = getDomainConfig(domainConfigs, key);

    if (!config?.enabled) {
        return false;
    }

    const allowedDomains = parseDomains(config.domains || '');
    if (allowedDomains.length === 0) {
        return false;
    }

    const currentUrl = new URL(window.location.origin);
    const currentHostname = currentUrl.hostname;
    const currentPort = currentUrl.port || (currentUrl.protocol === 'https:' ? '443' : '80');

    return allowedDomains.some(([hostname, port]) => {
        return (hostname === '*' || hostname === currentHostname)
            && (port === '*' || port === currentPort);
    });
};

const loadRuntime = async (): Promise<void> => {
    if (window.self === window.top) {
        const { initializeContent } = await import('./runtime');
        await initializeContent(window as unknown as AppContext);
        return;
    }

    const { installIframeEventBridge } = await import('./runtime/iframe-event-bridge');
    installIframeEventBridge(window);
};

(async () => {
    if (typeof document === 'undefined') {
        console.warn('Document object is not available in current context');
        return;
    }

    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        console.warn('Chrome storage is not available in current context');
        return;
    }

    const currentDomain = window.location.hostname;

    try {
        const snapshot = await chrome.storage.local.get([
            DISABLED_DOMAINS_KEY,
            DOMAIN_CONFIGS_KEY,
            EXTENSION_CONFIGS_KEY,
        ]);
        const disabledDomains = snapshot[DISABLED_DOMAINS_KEY] || [];
        const domainConfigs = (snapshot[DOMAIN_CONFIGS_KEY] || {}) as DomainConfigs;
        const extensionSettings: Record<string, any> = snapshot[EXTENSION_CONFIGS_KEY] || {};

        maLogger.setTitle(LOGGER_TITLE);
        maLogger.setEnabled(extensionSettings.debugMode === true);

        if (Array.isArray(disabledDomains) && disabledDomains.includes(currentDomain)) {
            maLogger.log(`当前域名 ${currentDomain} 已被禁用，跳过注入`);
            return;
        }

        if (!isDomainAllowed(domainConfigs, ROOT_PERMISSION_KEY)) {
            return;
        }
    } catch (error) {
        console.error('content bootstrap 检查失败，继续加载 runtime:', error);
    }

    await loadRuntime();
})().catch((error) => {
    console.error('content bootstrap 初始化失败:', error);
});
