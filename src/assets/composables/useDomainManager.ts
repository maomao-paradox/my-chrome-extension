import { contentModules, domainConfigsKey } from '@/config';
import { storage } from '@/stores';
import { ModuleOption } from '@/utils';
import { ref } from 'vue';

// 定义域名配置项类型
export interface DomainConfigItem {
    enabled: boolean;
    domains: string;
}

// 定义域名配置类型
export interface DomainConfigs {
    [key: string]: DomainConfigItem; // 支持旧格式（字符串）和新格式（对象）
}

export const useDomainManager = () => {
    // 域名配置数据
    const domainConfigs = ref<DomainConfigs>({});

    // 加载域名配置
    const loadDomainConfigs = async () => {
        try {
            let configs = await storage.ext.local.get(domainConfigsKey, null);
            maLogger.log('原始域名配置:', configs);
            if (!configs) {
                maLogger.log('未找到域名配置，使用默认配置');
                // 默认配置：全部启用，content-main 允许所有域名
                configs = contentModules.values().reduce((acc, script: ModuleOption) => {
                    acc[script.domainKey!] = { enabled: true, domains: "" };
                    return acc;
                }, {} as DomainConfigs);
                configs['Eve'] = { enabled: true, domains: "*:*" };
                await storage.ext.local.set(domainConfigsKey, configs);
            }
            domainConfigs.value = configs;
        } catch (error) {
            maLogger.error('加载域名配置失败:', error);
        }
    };
    return {
        domainConfigs,
        loadDomainConfigs,
    }
}
