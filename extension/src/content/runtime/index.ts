import { storage } from "@/stores";
import { equalDomain, parseDomains, getChunkFileMap } from "@/utils/common";
import { whenDomReady } from "@/utils/element-control";
import messenger from "@/message";
import type { ExtMessage, PluginConfigMap } from "@/types";
import { defaultPluginConfigs } from "@/apps/index";
import { appConfigKey, contentModules, domainConfigsKey } from "@/config";
import { createModuleManager } from "./module-manager";
import {
  createMessageHandlers,
  type ContentMessageHandlers,
} from "./message-handlers";
import { createPageTools } from "./page-tools";
import { installTopFrameEventBridge } from "./iframe-event-bridge";
import { initializeShadowMessage } from "./shadow-message";
import { initializeWebpageMouseTrail } from "./mouse-trail";
import { ModuleOption } from "@/utils";

const getCurrentPort = (): string => {
  const { port, protocol } = new URL(window.location.origin);
  return port || (protocol === "https:" ? "443" : "80");
};

const checkDomainMatch = (allowedDomains: [string, string][]): boolean => {
  if (allowedDomains[0]?.[0] === "*" && allowedDomains[0]?.[1] === "*") {
    return true;
  }
  const { hostname } = new URL(window.location.origin);
  return allowedDomains.some((domain) =>
    equalDomain(domain, hostname, getCurrentPort()),
  );
};

interface DomainConfigItem {
  enabled: boolean;
  domains: string;
}

export async function genDomainPermissionChecker(): Promise<
  (configKey: string) => boolean
> {
  const originDomainConfig = await storage.ext.local.get(domainConfigsKey);
  const domainConfigs: Map<string, DomainConfigItem> = new Map(
    Object.entries(originDomainConfig || {}),
  );
  let shouldPersist = false;

  for (const domain of contentModules.keys()) {
    if (domainConfigs.has(domain)) {
      continue;
    }

    domainConfigs.set(domain, {
      enabled: true,
      domains: "",
    });
    shouldPersist = true;
  }

  if (shouldPersist) {
    await storage.ext.local.set(domainConfigsKey, domainConfigs);
  }

  return (configKey: string): boolean => {
    try {
      if (!domainConfigs.has(configKey)) {
        return false;
      }
      const config = domainConfigs.get(configKey)!;
      if (!config.enabled) {
        return false;
      }
      if (!config.domains) {
        return false;
      }
      const allowedDomains = parseDomains(config.domains);
      // maLogger.log('解析后的域名列表:', allowedDomains);
      return checkDomainMatch(allowedDomains);
    } catch (error) {
      maLogger.error("检查域名权限失败:", error);
      return true;
    }
  };
}

const checkValid = (value: unknown): value is object => {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
};

const installGlobalModuleAccessor = (ctx: AppContext): void => {
  if (Object.prototype.hasOwnProperty.call(ctx, "gmod")) {
    return;
  }

  Object.defineProperty(ctx, "gmod", {
    value: (moduleName: string | any) => ctx[moduleName],
    writable: false,
  });
};

const installMessageListener = (
  ctx: AppContext,
  messageHandlers: ContentMessageHandlers,
): void => {
  ctx.addEventListener("popstate", (event) => {
    maLogger.info("路由发生了变化，当前路由的状态信息：", event.state);
  });

  installTopFrameEventBridge(ctx);

  if (ctx !== ctx.top) {
    return;
  }

  messenger.ext.listen((message: ExtMessage, sender, sendResponse) => {
    const { type, payload: data, target } = message;

    if (!type || target !== "content") {
      return true;
    }

    maLogger.info("Received message: ", type, data, "from", sender);
    const handler = messageHandlers[type];

    if (!handler) {
      return true;
    }

    try {
      const result = handler(data, sendResponse);
      return result instanceof Promise ? true : result;
    } catch (error) {
      maLogger.error("Error executing message handler:", error);
      return true;
    }
  });
};

const loadAppOptions = async (
  applyConfig: (config: PluginConfigMap | null | undefined) => Promise<void>,
): Promise<void> => {
  try {
    const result = await storage.ext.local.get(appConfigKey, null);
    if (!checkValid(result)) {
      maLogger.info("初始化应用配置", defaultPluginConfigs);
      if (checkValid(defaultPluginConfigs)) {
        await storage.ext.local.set(appConfigKey, defaultPluginConfigs || {});
        await applyConfig(defaultPluginConfigs);
      } else {
        maLogger.error("初始化应用配置失败", defaultPluginConfigs);
      }
      return;
    }

    await applyConfig(result as PluginConfigMap);
  } catch (error: any) {
    maLogger.error("初始化配置失败:", error.message);
  }
};

const sendFileMapToBackground = async (): Promise<void> => {
  try {
    const fileMap = await getChunkFileMap();
    if (fileMap && typeof fileMap === "object") {
      await messenger.ext.send({
        type: "INIT_FILE_MAP",
        target: "background",
        payload: fileMap,
      });
      maLogger.log("已向后台发送 file_map");
    }
  } catch (error) {
    maLogger.error("向后台发送 file_map 失败:", error);
  }
};

export const initializeContent = async (ctx: AppContext): Promise<void> => {
  if (typeof document === "undefined") {
    maLogger.warn("Document object is not available in current context");
    return;
  }

  if (typeof chrome === "undefined") {
    maLogger.warn("Chrome object is not available in current context");
    return;
  }

  installGlobalModuleAccessor(ctx);

  const domainPermissionChecker = await genDomainPermissionChecker();
  const fileMap = await getChunkFileMap();
  await sendFileMapToBackground();

  const moduleManager = createModuleManager(ctx, domainPermissionChecker);
  const pageTools = createPageTools(ctx);
  const messageHandlers = createMessageHandlers(ctx, moduleManager, pageTools);

  installMessageListener(ctx, messageHandlers);

  if (ctx !== ctx.top) {
    return;
  }

  const version = chrome.runtime.getManifest().version;

  maLogger.info(
    String.raw`欢迎使用 %c ${chrome.runtime.getManifest().name} %c
当前版本：%c paradox ${version} %c`,
    "color:rgb(114, 207, 244)",
    "",
    "color:rgb(61, 247, 80)",
    "",
  );

  whenDomReady(async () => {
    initializeShadowMessage(ctx);
    await initializeWebpageMouseTrail();
    await loadAppOptions(moduleManager.applyConfig);
    await moduleManager.loadContentScripts();
  });

  Object.defineProperty(ctx, "__CONTENT_SCRIPT", {
    value: version,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  maLogger.log(ctx);
};
