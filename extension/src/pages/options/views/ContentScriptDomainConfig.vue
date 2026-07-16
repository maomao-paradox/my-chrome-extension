<template>
  <div class="domain-config-container">
    <h2>内容脚本域名配置</h2>

    <!-- 使用可复用组件渲染所有脚本配置 -->
    <DomainConfigItem v-for="[domain, script] in Object.entries(domainConfigs)" :key="domain" :script-name="domain"
      :storage-key="domain" :enabled="script.enabled" :domains-string="script.domains"
      :domain-list="getDomainList(script.domains)" @update:enabled="handleEnabledUpdate"
      @update:domains-string="handleDomainsUpdate" @success="handleSuccess" @error="handleError" />

    <div class="config-tips">
      <p>提示：</p>
      <ul>
        <li>配置后需要刷新页面才能生效</li>
        <li>留空表示允许在所有域名上运行</li>
        <li>域名格式建议包含协议（http://或https://）</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { storage } from '@/stores';
import { DomainConfigItem } from '@components/index';
import { ElMessage } from 'element-plus';
import { useDomainManager } from '@/assets/composables/useDomainManager';

const { domainConfigs, loadDomainConfigs } = useDomainManager();

// 定义脚本配置项类型
interface ScriptConfig {
  name: string;
  storageKey: string;
}

// 定义域名配置项类型
interface DomainConfigItem {
  enabled: boolean;
  domains: string;
}

// 定义域名配置类型
interface DomainConfigs {
  [key: string]: DomainConfigItem | string; // 支持旧格式（字符串）和新格式（对象）
}

// 解析域名字符串为数组
const parseDomains = (domainsString: string): string[] => {
  if (!domainsString) {return [];}
  return domainsString.split(',').map(domain => domain.trim()).filter(domain => domain);
};

// 获取脚本的启用状态
const getScriptEnabled = (storageKey: string): boolean => {
  const config = domainConfigs.value[storageKey];
  if (typeof config === 'object' && config !== null) {
    return config.enabled !== false; // 默认启用
  }
  // 旧格式默认为启用
  return true;
};

// 获取脚本的域名字符串
const getScriptDomains = (storageKey: string): string => {
  const config = domainConfigs.value[storageKey];
  if (typeof config === 'object' && config !== null) {
    return config.domains || '';
  }
  // 旧格式直接返回字符串
  return typeof config === 'string' ? config : '';
};

// 获取特定脚本的域名列表
const getDomainList = (domainsString: string): string[] => {
  return parseDomains(domainsString);
};

// 处理启用状态更新
const handleEnabledUpdate = async (storageKey: string, enabled: boolean) => {
  try {
    // 确保配置项是对象格式
    if (typeof domainConfigs.value[storageKey] !== 'object' || domainConfigs.value[storageKey] === null) {
      domainConfigs.value[storageKey] = {
        enabled: enabled,
        domains: typeof domainConfigs.value[storageKey] === 'string' ? domainConfigs.value[storageKey] : ''
      };
    } else {
      // 更新启用状态
      (domainConfigs.value[storageKey] as DomainConfigItem).enabled = enabled;
    }
    // 保存到存储
    await storage.ext.local.set('domainConfigs', domainConfigs.value);
    return true;
  } catch (error) {
    maLogger.error(`更新${storageKey}启用状态失败:`, error);
    return false;
  }
};

// 处理子组件的域名更新
const handleDomainsUpdate = async (storageKey: string, newDomainsString: string) => {
  try {
    // 确保配置项是对象格式
    if (typeof domainConfigs.value[storageKey] !== 'object' || domainConfigs.value[storageKey] === null) {
      domainConfigs.value[storageKey] = {
        enabled: true,
        domains: newDomainsString
      };
    } else {
      // 更新域名配置
      (domainConfigs.value[storageKey] as DomainConfigItem).domains = newDomainsString;
    }
    // 保存到存储
    await storage.ext.local.set('domainConfigs', domainConfigs.value);
    return true;
  } catch (error) {
    maLogger.error(`更新${storageKey}配置失败:`, error);
    return false;
  }
};

// 成功处理函数
const handleSuccess = (message: string): void => {
  ElMessage({
    message,
    type: 'success'
  });
};

// 错误处理函数
const handleError = (message: string): void => {
  ElMessage({
    message,
    type: 'error'
  });
};

// 组件挂载时加载配置
onMounted(() => {
  loadDomainConfigs();
});
</script>

<style scoped>
.domain-config-container {
  padding: 20px;
}

.domain-config-container h2 {
  color: var(--text-primary);
  font-size: 20px;
  margin: 0 0 24px 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.domain-config-container h2:before {
  content: '⚙️';
  font-size: 22px;
}

/* 移除重复的样式定义，因为它们已经在DomainConfigItem.vue中定义 */

/* 配置提示样式 */
.config-tips {
  margin-top: 20px;
  padding: 16px;
  background-color: var(--bg-info);
  border: 1px solid var(--border-info);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
}

.config-tips p {
  color: var(--text-info);
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.config-tips ul {
  margin: 0;
  padding-left: 20px;
}

.config-tips li {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 4px;
}

.config-tips li:last-child {
  margin-bottom: 0;
}

/* 消息提示样式 */
.el-message {
  min-width: 300px !important;
  border-radius: 8px !important;
  padding: 12px 16px !important;
  box-shadow: var(--shadow-md) !important;
  font-size: 14px !important;
}

.el-message--success {
  background-color: var(--bg-success) !important;
  border-color: var(--border-success) !important;
  color: var(--text-success) !important;
}

.el-message--error {
  background-color: var(--bg-error) !important;
  border-color: var(--border-error) !important;
  color: var(--text-error) !important;
}
</style>