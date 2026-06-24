import type { PluginConfigs } from '@/types';
import { contentModules, appModules } from '@/config';
import { ESMModuleLoader } from '@/utils/esm-module-loader';

type DomainPermissionChecker = (configKey: string) => boolean;
type RuntimeModule = Record<string, any>;

export interface ContentModuleManager {
    loadContentScripts: () => Promise<void>;
    toggleApp: (moduleName: string, open: boolean) => Promise<void>;
    applyConfig: (config: PluginConfigs | null | undefined) => Promise<void>;
    getOrLoadModule: (moduleName: string) => Promise<RuntimeModule | null>;
    updateModuleTools: (moduleName: string, tools: any) => Promise<boolean>;
}

export const createModuleManager = (
    ctx: AppContext,
    domainPermissionChecker: DomainPermissionChecker,
): ContentModuleManager => {
    const moduleLoader = new ESMModuleLoader(ctx);
    const moduleInstances = new Map<string, RuntimeModule>();

    const getOrLoadModule = async (moduleName: string): Promise<RuntimeModule | null> => {
        if (moduleInstances.has(moduleName)) {
            return moduleInstances.get(moduleName) || null;
        }

        const moduleConfig = appModules.get(moduleName);
        if (!moduleConfig) {
            maLogger.error(`未找到模块配置: ${moduleName}`);
            return null;
        }

        const module = await moduleLoader.load(moduleConfig);
        moduleInstances.set(moduleName, module);
        return module;
    };

    const loadContentScripts = async (): Promise<void> => {
        if (ctx !== ctx.top) {
            return;
        }

        for (const [, script] of contentModules.entries()) {
            try {
                const hasPermission = script.domainKey ? domainPermissionChecker(script.domainKey) : true;
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

    const toggleApp = async (moduleName: string, open: boolean): Promise<void> => {
        const moduleConfig = appModules.get(moduleName);
        if (!moduleConfig) {
            maLogger.error(`未找到模块配置: ${moduleName}`);
            return;
        }

        if (open) {
            try {
                const module = await getOrLoadModule(moduleName);
                if (module && typeof module.enable === 'function') {
                    module.enable();
                    maLogger.info(`${moduleConfig.flag}模块已启用`);
                }
            } catch (error) {
                maLogger.error(`加载${moduleConfig.flag}模块失败:`, error);
            }
            return;
        }

        const module = moduleInstances.get(moduleName);
        if (module && typeof module.disable === 'function') {
            module.disable();
            maLogger.info(`${module.flag}模块已禁用`);
        }
    };

    const applyConfig = async (config: PluginConfigs | null | undefined): Promise<void> => {
        if (ctx !== ctx.top || !config) {
            return;
        }

        maLogger.table(config);
        for (const [moduleName, moduleConfig] of Object.entries(config)) {
            await toggleApp(moduleName, moduleConfig.value);
        }
    };

    const updateModuleTools = async (moduleName: string, tools: any): Promise<boolean> => {
        const module = await getOrLoadModule(moduleName);
        if (!module || typeof module.updateTools !== 'function') {
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
