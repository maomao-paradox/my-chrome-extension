/**
 * 错误监控配置管理 Store
 * 使用 Pinia 管理异常监控的配置状态
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MonitorConfig, ConfigValidationResult } from '@/assets/types/error-monitor';
import {
  DEFAULT_MONITOR_CONFIG,
  MonitorConfigUtils,
} from '@/assets/types/error-monitor';

/** Storage 键名 */
const STORAGE_KEY = 'errorMonitorConfig';

/**
 * 错误监控配置 Store
 */
export const useErrorMonitorStore = defineStore('errorMonitor', () => {
  // ============ State ============
  /** 监控配置 */
  const config = ref<MonitorConfig>({ ...DEFAULT_MONITOR_CONFIG });
  /** 是否已加载 */
  const loaded = ref(false);
  /** 是否正在保存 */
  const saving = ref(false);
  /** 验证错误信息 */
  const validationErrors = ref<string[]>([]);

  // ============ Getters ============
  /** 是否已启用 */
  const isEnabled = computed(() => config.value.enabled);
  /** 是否已配置 Webhook */
  const isConfigured = computed(() => !!config.value.webhookUrl);
  /** 配置是否有效 */
  const isValid = computed(() => validationErrors.value.length === 0);
  /** 当前域名是否在白名单中 */
  const isCurrentDomainAllowed = computed(() => {
    const currentDomain = window.location.hostname;
    return MonitorConfigUtils.isDomainAllowed(
      currentDomain,
      config.value.domainWhitelist,
      config.value.domainBlacklist
    );
  });

  // ============ Actions ============

  /**
   * 从 Chrome Storage 加载配置
   */
  async function loadConfig(): Promise<void> {
    if (!chrome.storage) {
      return;
    }
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        config.value = MonitorConfigUtils.mergeWithDefaults(result[STORAGE_KEY]);
      }
      loaded.value = true;
      validateConfig();
    } catch (error) {
      maLogger.error('[ErrorMonitorStore] 加载配置失败:', error);
      loaded.value = true;
    }
  }

  /**
   * 保存配置到 Chrome Storage
   */
  async function saveConfig(): Promise<boolean> {
    // 验证配置
    const validation = validateConfig();
    if (!validation.valid) {
      return false;
    }

    if (!chrome.storage) {
      return false;
    }
    saving.value = true;
    try {
      // 保存到本地存储
      await chrome.storage.local.set({ [STORAGE_KEY]: config.value });

      // 通知后台脚本更新配置
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ERROR_MONITOR_CONFIG',
        payload: config.value,
        target: 'background',
      });

      return true;
    } catch (error: any) {
      maLogger.error('[ErrorMonitorStore] 保存配置失败:', error.message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * 更新配置项
   */
  function updateConfig(partialConfig: Partial<MonitorConfig>): void {
    config.value = { ...config.value, ...partialConfig };
    validateConfig();
  }

  /**
   * 验证配置
   */
  function validateConfig(): ConfigValidationResult {
    const result = MonitorConfigUtils.validate(config.value);
    validationErrors.value = result.errors;
    return result;
  }

  /**
   * 重置为默认配置
   */
  function resetConfig(): void {
    config.value = { ...DEFAULT_MONITOR_CONFIG };
    validationErrors.value = [];
  }

  /**
   * 切换监控开关
   */
  function toggleEnabled(): void {
    config.value.enabled = !config.value.enabled;
  }

  /**
   * 切换截图开关
   */
  function toggleScreenshot(): void {
    config.value.screenshotEnabled = !config.value.screenshotEnabled;
  }

  /**
   * 添加域名到白名单
   */
  function addToWhitelist(domain: string): void {
    const trimmed = domain.trim();
    if (trimmed && !config.value.domainWhitelist.includes(trimmed)) {
      config.value.domainWhitelist.push(trimmed);
    }
  }

  /**
   * 从白名单移除域名
   */
  function removeFromWhitelist(domain: string): void {
    const index = config.value.domainWhitelist.indexOf(domain);
    if (index > -1) {
      config.value.domainWhitelist.splice(index, 1);
    }
  }

  /**
   * 添加域名到黑名单
   */
  function addToBlacklist(domain: string): void {
    const trimmed = domain.trim();
    if (trimmed && !config.value.domainBlacklist.includes(trimmed)) {
      config.value.domainBlacklist.push(trimmed);
    }
  }

  /**
   * 从黑名单移除域名
   */
  function removeFromBlacklist(domain: string): void {
    const index = config.value.domainBlacklist.indexOf(domain);
    if (index > -1) {
      config.value.domainBlacklist.splice(index, 1);
    }
  }

  /**
   * 检查域名是否被允许
   */
  function isDomainAllowed(domain: string): boolean {
    return MonitorConfigUtils.isDomainAllowed(
      domain,
      config.value.domainWhitelist,
      config.value.domainBlacklist
    );
  }

  /**
   * 设置 Webhook URL
   */
  function setWebhookUrl(url: string): void {
    config.value.webhookUrl = url.trim();
    validateConfig();
  }

  /**
   * 设置钉钉 Token
   */
  function setDingTalkToken(token: string): void {
    config.value.dingTalkToken = token.trim();
  }

  /**
   * 设置钉钉关键词
   */
  function setDingTalkKeyword(keyword: string): void {
    config.value.dingTalkKeyword = keyword.trim();
  }

  /**
   * 设置节流间隔
   */
  function setThrottleInterval(interval: number): void {
    config.value.throttleInterval = Math.max(5, Math.min(300, interval));
    validateConfig();
  }

  /**
   * 设置最大截图大小
   */
  function setMaxScreenshotSize(size: number): void {
    config.value.maxScreenshotSize = Math.max(0.1, Math.min(5, size));
    validateConfig();
  }

  // 初始化时加载配置
  loadConfig();

  return {
    // State
    config,
    loaded,
    saving,
    validationErrors,
    // Getters
    isEnabled,
    isConfigured,
    isValid,
    isCurrentDomainAllowed,
    // Actions
    loadConfig,
    saveConfig,
    updateConfig,
    validateConfig,
    resetConfig,
    toggleEnabled,
    toggleScreenshot,
    addToWhitelist,
    removeFromWhitelist,
    addToBlacklist,
    removeFromBlacklist,
    isDomainAllowed,
    setWebhookUrl,
    setDingTalkKeyword,
    setDingTalkToken,
    setThrottleInterval,
    setMaxScreenshotSize,
  };
});

export type ErrorMonitorStore = ReturnType<typeof useErrorMonitorStore>;
