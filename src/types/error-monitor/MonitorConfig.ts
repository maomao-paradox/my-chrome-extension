/**
 * 监控配置类型定义
 * 用于配置异常监控的行为和参数
 */

/** 监控配置接口 */
export interface MonitorConfig {
  /** 钉钉机器人 Webhook 地址 */
  webhookUrl: string;
  /** 钉钉机器人关键词（可选） */
  dingTalkKeyword?: string;
  /** 钉钉机器人 Token（可选） */
  dingTalkToken?: string;
  /** 监控开关 */
  enabled: boolean;
  /** 截图开关 */
  screenshotEnabled: boolean;
  /** 节流间隔（秒） */
  throttleInterval: number;
  /** 域名白名单（空数组表示允许所有） */
  domainWhitelist: string[];
  /** 域名黑名单 */
  domainBlacklist: string[];
  /** 是否捕获 console.error */
  captureConsoleError: boolean;
  /** 最大截图大小（MB） */
  maxScreenshotSize: number;
  /** WebSocket 重连最大次数 */
  maxReconnectAttempts: number;
  /** WebSocket 重连基础间隔（毫秒） */
  reconnectBaseInterval: number;
}

/** 监控配置默认值 */
export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  webhookUrl: '',
  dingTalkKeyword: '',
  dingTalkToken: '',
  enabled: true,
  screenshotEnabled: true,
  throttleInterval: 30,
  domainWhitelist: [],
  domainBlacklist: [],
  captureConsoleError: false,
  maxScreenshotSize: 2,
  maxReconnectAttempts: 5,
  reconnectBaseInterval: 1000,
};

/** 配置验证结果 */
export interface ConfigValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息 */
  errors: string[];
}

/** 配置管理工具类 */
export const MonitorConfigUtils = {
  /**
   * 验证配置是否有效
   */
  validate(config: Partial<MonitorConfig>): ConfigValidationResult {
    const errors: string[] = [];

    // 验证 Webhook URL
    if (config.webhookUrl !== undefined) {
      if (!config.webhookUrl) {
        errors.push('Webhook 地址不能为空');
      } else if (!this.isValidWebhookUrl(config.webhookUrl)) {
        errors.push('Webhook 地址格式不正确（应以 http:// 或 https:// 开头）');
      }
    }

    // 验证节流间隔
    if (config.throttleInterval !== undefined) {
      if (config.throttleInterval < 5) {
        errors.push('节流间隔不能小于 5 秒');
      }
      if (config.throttleInterval > 300) {
        errors.push('节流间隔不能大于 300 秒');
      }
    }

    // 验证最大截图大小
    if (config.maxScreenshotSize !== undefined) {
      if (config.maxScreenshotSize < 0.1) {
        errors.push('最大截图大小不能小于 0.1 MB');
      }
      if (config.maxScreenshotSize > 5) {
        errors.push('最大截图大小不能大于 5 MB');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * 验证 Webhook URL 格式
   */
  isValidWebhookUrl(url: string): boolean {
    return /^https?:\/\/.+/.test(url);
  },

  /**
   * 检查域名是否在白名单中
   */
  isDomainAllowed(
    domain: string,
    whitelist: string[],
    blacklist: string[]
  ): boolean {
    // 先检查黑名单
    if (blacklist.length > 0) {
      const isBlacklisted = blacklist.some(
        (pattern) => this.matchDomain(domain, pattern)
      );
      if (isBlacklisted) {
        return false;
      }
    }

    // 再检查白名单（空白名单表示允许所有）
    if (whitelist.length === 0) {
      return true;
    }

    return whitelist.some((pattern) => this.matchDomain(domain, pattern));
  },

  /**
   * 匹配域名模式
   * 支持通配符 *，例如 *.example.com 匹配 sub.example.com
   */
  matchDomain(domain: string, pattern: string): boolean {
    // 精确匹配
    if (domain === pattern) {
      return true;
    }

    // 通配符匹配
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return domain === suffix || domain.endsWith('.' + suffix);
    }

    // 子域名匹配（pattern 是父域名）
    if (domain.endsWith('.' + pattern)) {
      return true;
    }

    return false;
  },

  /**
   * 合并配置（使用默认值填充缺失项）
   */
  mergeWithDefaults(config: Partial<MonitorConfig> & {
    wsUrl?: string;
    webhook?: string;
    socket?: string;
    keyword?: string;
  }): MonitorConfig {
    const resolvedWebhookUrl = [
      config.webhookUrl,
      config.webhook,
      config.wsUrl,
      config.socket,
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() || '';

    return {
      webhookUrl: resolvedWebhookUrl,
      dingTalkKeyword: typeof config.dingTalkKeyword === 'string'
        ? config.dingTalkKeyword
        : typeof config.keyword === 'string'
          ? config.keyword
          : DEFAULT_MONITOR_CONFIG.dingTalkKeyword,
      dingTalkToken: typeof config.dingTalkToken === 'string' ? config.dingTalkToken : DEFAULT_MONITOR_CONFIG.dingTalkToken,
      enabled: typeof config.enabled === 'boolean' ? config.enabled : DEFAULT_MONITOR_CONFIG.enabled,
      screenshotEnabled: typeof config.screenshotEnabled === 'boolean' ? config.screenshotEnabled : DEFAULT_MONITOR_CONFIG.screenshotEnabled,
      throttleInterval: typeof config.throttleInterval === 'number' ? config.throttleInterval : DEFAULT_MONITOR_CONFIG.throttleInterval,
      domainWhitelist: Array.isArray(config.domainWhitelist) ? [...config.domainWhitelist] : [...DEFAULT_MONITOR_CONFIG.domainWhitelist],
      domainBlacklist: Array.isArray(config.domainBlacklist) ? [...config.domainBlacklist] : [...DEFAULT_MONITOR_CONFIG.domainBlacklist],
      captureConsoleError: typeof config.captureConsoleError === 'boolean' ? config.captureConsoleError : DEFAULT_MONITOR_CONFIG.captureConsoleError,
      maxScreenshotSize: typeof config.maxScreenshotSize === 'number' ? config.maxScreenshotSize : DEFAULT_MONITOR_CONFIG.maxScreenshotSize,
      maxReconnectAttempts: typeof config.maxReconnectAttempts === 'number' ? config.maxReconnectAttempts : DEFAULT_MONITOR_CONFIG.maxReconnectAttempts,
      reconnectBaseInterval: typeof config.reconnectBaseInterval === 'number' ? config.reconnectBaseInterval : DEFAULT_MONITOR_CONFIG.reconnectBaseInterval,
    };
  },

  /**
   * 从 URL 提取域名
   */
  extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  },
};
