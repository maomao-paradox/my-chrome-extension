import { appModules, appConfigKey } from '@/config';
import { storage } from '@/stores';
import { ModuleOption } from '@/utils';
import { ref } from 'vue';
import { PluginConfigs } from '../types';
import { defaultPluginConfigs } from '@/apps'

export const usePluginManager = () => {
    // 插件配置数据
    const pluginConfigs = ref<PluginConfigs>({});

    // 加载插件配置
    const loadPluginConfigs = async () => {
        try {
            let configs = await storage.ext.local.get(appConfigKey, null);
            pluginConfigs.value = configs;
            if (!configs) {
                // 默认配置：全部启用，content-main 允许所有域名
                await storage.ext.local.set(appConfigKey, defaultPluginConfigs);
                pluginConfigs.value = defaultPluginConfigs;
            }
        } catch (error) {
            maLogger.error('加载插件配置失败:', error);
        }
    };
    return {
        pluginConfigs,
        loadPluginConfigs,
    }
}
