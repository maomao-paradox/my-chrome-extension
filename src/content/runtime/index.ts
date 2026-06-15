import { storage } from '@/stores';
import { equalDomain, parseDomains, getChunkFileMap } from '@/utils/common';
import { whenDomReady } from '@/utils/element-control';
import messenger from '@/message';
import type { ExtMessage, PluginConfigs } from '@/assets/types';
import { defaultPluginConfigs } from '@/apps/index';
import { appConfigKey } from '@/config';
import { createModuleManager } from './module-manager';
import { createMessageHandlers, type ContentMessageHandlers } from './message-handlers';
import { createPageTools } from './page-tools';
import { installTopFrameEventBridge } from './iframe-event-bridge';
import { initializeShadowMessage } from './shadow-message';
import { initializeWebpageMouseTrail } from './mouse-trail';


const getCurrentPort = (): string => {
    const { port, protocol } = new URL(window.location.origin);
    return port || (protocol === 'https:' ? '443' : '80');
};

const checkDomainMatch = (allowedDomains: [string, string][]): boolean => {
    if (allowedDomains[0]?.[0] === '*' && allowedDomains[0]?.[1] === '*') return true;
    const { hostname } = new URL(window.location.origin);
    return allowedDomains.some(domain => equalDomain(domain, hostname, getCurrentPort()));
};

export async function genDomainPermissionChecker(): Promise<(configKey: string) => boolean> {
    const domainConfigs: Record<string, any> = await storage.ext.local.get("domainConfigs") || {};
    return (configKey: string): boolean => {
        try {
            const config = domainConfigs[configKey];
            if (!config?.enabled) return false;
            if (!config.domains) return false;
            const allowedDomains = parseDomains(config.domains);
            // maLogger.log('解析后的域名列表:', allowedDomains);
            return checkDomainMatch(allowedDomains);
        } catch (error) {
            maLogger.error('检查域名权限失败:', error);
            return true;
        }
    };
}

const checkValid = (value: unknown): value is object => {
    return !!value && typeof value === 'object' && Object.keys(value).length > 0;
};

const installGlobalModuleAccessor = (ctx: AppContext): void => {
    if (Object.prototype.hasOwnProperty.call(ctx, 'gmod')) {
        return;
    }

    Object.defineProperty(ctx, 'gmod', {
        value: (moduleName: string | any) => ctx[moduleName],
        writable: false,
    });
};

const installMessageListener = (
    ctx: AppContext,
    messageHandlers: ContentMessageHandlers,
): void => {
    ctx.addEventListener('popstate', (event) => {
        maLogger.info('路由发生了变化，当前路由的状态信息：', event.state);
    });

    installTopFrameEventBridge(ctx);

    if (ctx !== ctx.top) {
        return;
    }

    messenger.ext.listen((message: ExtMessage, sender, sendResponse) => {
        const { type, payload: data, target } = message;

        if (!type || target !== 'content') {
            return true;
        }

        maLogger.info('Received message: ', type, data, 'from', sender);
        const handler = messageHandlers[type];

        if (!handler) {
            return true;
        }

        try {
            const result = handler(data, sendResponse);
            return result instanceof Promise ? true : result;
        } catch (error) {
            maLogger.error('Error executing message handler:', error);
            return true;
        }
    });
};

const loadAppOptions = async (
    applyConfig: (config: PluginConfigs | null | undefined) => Promise<void>,
): Promise<void> => {
    try {
        const result = await storage.ext.local.get(appConfigKey, null);
        if (!checkValid(result)) {
            maLogger.info('初始化应用配置', defaultPluginConfigs);
            if (checkValid(defaultPluginConfigs)) {
                await storage.ext.local.set(appConfigKey, defaultPluginConfigs || {});
                await applyConfig(defaultPluginConfigs);
            } else {
                maLogger.error('初始化应用配置失败', defaultPluginConfigs);
            }
            return;
        }

        await applyConfig(result as PluginConfigs);
    } catch (error: any) {
        maLogger.error('初始化配置失败:', error.message);
    }
};

export const initializeContent = async (ctx: AppContext): Promise<void> => {
    if (typeof document === 'undefined') {
        maLogger.warn('Document object is not available in current context');
        return;
    }

    if (typeof chrome === 'undefined') {
        maLogger.warn('Chrome object is not available in current context');
        return;
    }

    installGlobalModuleAccessor(ctx);

    const domainPermissionChecker = await genDomainPermissionChecker();
    await getChunkFileMap();

    const moduleManager = createModuleManager(ctx, domainPermissionChecker);
    const pageTools = createPageTools(ctx);
    const messageHandlers = createMessageHandlers(ctx, moduleManager, pageTools);

    installMessageListener(ctx, messageHandlers);

    if (ctx !== ctx.top) {
        return;
    }

    maLogger.info(String.raw`欢迎使用 %c ${chrome.runtime.getManifest().name} %c
当前版本：%c paradox ${chrome.runtime.getManifest().version} %c`
        , 'color:rgb(114, 207, 244)', ''
        , 'color:rgb(61, 247, 80)', '');

    whenDomReady(async () => {
        initializeShadowMessage(ctx);
        await initializeWebpageMouseTrail();
        await loadAppOptions(moduleManager.applyConfig);
        await moduleManager.loadContentScripts();
    });

    Object.defineProperty(ctx, '__CONTENT_SCRIPT', {
        value: 'v1.0.0.13',
        writable: false,
        enumerable: false,
        configurable: false,
    });
    maLogger.log(ctx);
};
