import type { PluginConfigMap } from "@/types";
import { contentModules, appModules } from "@/config";
import { ESMModuleLoader } from "@/utils/esm-module-loader";

type DomainPermissionChecker = (configKey: string) => boolean;
type RuntimeModule = Record<string, any>;

export interface ContentModuleManager {
  loadContentScripts: () => Promise<void>;
  toggleApp: (moduleName: string, open: boolean) => Promise<void>;
  applyConfig: (config: PluginConfigMap | null | undefined) => Promise<void>;
  getOrLoadModule: (moduleName: string) => Promise<RuntimeModule | null>;
  updateModuleTools: (moduleName: string, tools: any) => Promise<boolean>;
}

export const createModuleManager = (
  ctx: AppContext,
  domainPermissionChecker: DomainPermissionChecker,
): ContentModuleManager => {
  const moduleLoader = new ESMModuleLoader(ctx);
  const moduleInstanceMap = new Map<string, RuntimeModule>();

  const getOrLoadModule = async (
    moduleName: string,
    options?: any,
  ): Promise<RuntimeModule | null> => {
    if (moduleInstanceMap.has(moduleName)) {
      return moduleInstanceMap.get(moduleName) || null;
    }

    const module = appModules.get(moduleName);
    if (!module) {
      maLogger.error(`未找到模块配置: ${moduleName}`);
      return null;
    }

    const moduleInstance = await moduleLoader.load(module, options);
    moduleInstanceMap.set(moduleName, moduleInstance);
    return moduleInstance;
  };

  const loadContentScripts = async (): Promise<void> => {
    if (ctx !== ctx.top) {
      return;
    }

    for (const [, script] of contentModules.entries()) {
      try {
        const hasPermission = script.domainKey
          ? domainPermissionChecker(script.domainKey)
          : true;
        if (!hasPermission) {
          continue;
        }

        if (ctx.hasOwnProperty(script.flag)) {
          continue;
        }

        try {
          await moduleLoader.load(script);
          maLogger.info(`成功加载脚本: ${script.flag}`);
        } catch (msgError) {
          maLogger.error(`动态加载脚本失败: ${script.flag}`, msgError);
        }
      } catch (error) {
        maLogger.error(`加载脚本失败: ${script.flag}`, error);
      }
    }
  };

  const toggleApp = async (
    moduleName: string,
    enabled: boolean,
    options?: any,
  ): Promise<void> => {
    const moduleConfig = appModules.get(moduleName);
    if (!moduleConfig) {
      maLogger.error(`未找到模块配置: ${moduleName}`);
      return;
    }

    if (enabled) {
      try {
        const moduleInstance = await getOrLoadModule(moduleName, options);
        if (moduleInstance && typeof moduleInstance.enable === "function") {
          moduleInstance.enable(options);
          maLogger.info(`${moduleConfig.flag}模块已启用`);
        }
      } catch (error) {
        maLogger.error(`加载${moduleConfig.flag}模块失败:`, error);
      }
      return;
    }

    const moduleInstance = moduleInstanceMap.get(moduleName);
    if (moduleInstance && typeof moduleInstance.disable === "function") {
      moduleInstance.disable();
      maLogger.info(`${moduleConfig.flag}模块已禁用`);
    }
  };

  const applyConfig = async (
    config: PluginConfigMap | null | undefined,
  ): Promise<void> => {
    if (ctx !== ctx.top || !config) {
      return;
    }

    maLogger.table(config);
    for (const [moduleName, { enabled, options }] of Object.entries(config)) {
      await toggleApp(moduleName, enabled, options);
    }
  };

  const updateModuleTools = async (
    moduleName: string,
    tools: any,
  ): Promise<boolean> => {
    const module = await getOrLoadModule(moduleName);
    if (!module || typeof module.updateTools !== "function") {
      return false;
    }

    module.updateTools(tools);
    return true;
  };

  return {
    loadContentScripts,
    toggleApp,
    applyConfig,
    getOrLoadModule,
    updateModuleTools,
  };
};
