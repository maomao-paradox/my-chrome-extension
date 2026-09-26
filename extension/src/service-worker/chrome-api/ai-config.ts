/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/dom-api/ai-config.ts
 * @date 2026-02-05T02:38:01.698Z
 */

import {
  DEFAULT_DEEPSEEK_AUTH_TOKEN,
  DEFAULT_DEEPSEEK_COOKIES
} from '@/shared/deepseek-core';

export const AI_ASSISTANT_CONFIG_KEY = 'ai_assistant_config';
export const DEFAULT_AI_MODEL_ID = 'deepseek-chat';
export { DEFAULT_DEEPSEEK_AUTH_TOKEN, DEFAULT_DEEPSEEK_COOKIES };

export interface AIModelConfig {
  provider: string;
  customProvider: string;
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
  deepseekAuthToken: string;
  deepseekCookies: string;
  systemPrompt?: string;
}

export const createDefaultAIConfig = (): AIModelConfig => ({
  provider: 'deepseek',
  customProvider: '',
  modelId: DEFAULT_AI_MODEL_ID,
  apiBaseUrl: '',
  apiKey: '',
  deepseekAuthToken: DEFAULT_DEEPSEEK_AUTH_TOKEN,
  deepseekCookies: DEFAULT_DEEPSEEK_COOKIES,
  systemPrompt: ''
});

const canUseChromeStorage = (): boolean => {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
};

const parseStoredConfig = (raw: unknown): unknown => {
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return raw;
};

export const normalizeAIConfig = (input: unknown): AIModelConfig => {
  const parsed = parseStoredConfig(input);
  const defaults = createDefaultAIConfig();

  if (!parsed || typeof parsed !== 'object') {
    return defaults;
  }

  const record = parsed as Record<string, unknown>;
  const provider = typeof record.provider === 'string' ? record.provider.trim() : '';
  const customProvider = typeof record.customProvider === 'string' ? record.customProvider.trim() : '';

  return {
    provider: provider === 'custom' && customProvider
      ? customProvider
      : provider || customProvider || defaults.provider,
    customProvider,
    modelId: typeof record.modelId === 'string' && record.modelId.trim()
      ? record.modelId.trim()
      : defaults.modelId,
    apiBaseUrl: typeof record.apiBaseUrl === 'string' ? record.apiBaseUrl.trim() : defaults.apiBaseUrl,
    apiKey: typeof record.apiKey === 'string' ? record.apiKey.trim() : defaults.apiKey,
    deepseekAuthToken: typeof record.deepseekAuthToken === 'string' && record.deepseekAuthToken.trim()
      ? record.deepseekAuthToken.trim()
      : defaults.deepseekAuthToken,
    deepseekCookies: typeof record.deepseekCookies === 'string' && record.deepseekCookies.trim()
      ? record.deepseekCookies.trim()
      : defaults.deepseekCookies,
    systemPrompt: typeof record.systemPrompt === 'string' ? record.systemPrompt : defaults.systemPrompt
  };
};

export const loadAIConfigSync = (): AIModelConfig => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultAIConfig();
  }

  try {
    return normalizeAIConfig(window.localStorage.getItem(AI_ASSISTANT_CONFIG_KEY));
  } catch (error) {
    maLogger.warn('[AIConfig] Failed to read localStorage config:', error);
    return createDefaultAIConfig();
  }
};

const getLocalStoredConfig = (): unknown => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    return window.localStorage.getItem(AI_ASSISTANT_CONFIG_KEY);
  } catch (error) {
    maLogger.warn('[AIConfig] Failed to read localStorage config:', error);
    return null;
  }
};

export const loadAIConfig = async (): Promise<AIModelConfig> => {
  if (canUseChromeStorage()) {
    try {
      const stored = await chrome.storage.local.get(AI_ASSISTANT_CONFIG_KEY);
      if (Object.prototype.hasOwnProperty.call(stored, AI_ASSISTANT_CONFIG_KEY)) {
        return normalizeAIConfig(stored[AI_ASSISTANT_CONFIG_KEY]);
      }
    } catch (error) {
      maLogger.warn('[AIConfig] Failed to read chrome.storage config:', error);
    }
  }

  const localStoredConfig = getLocalStoredConfig();
  if (!localStoredConfig) {
    return createDefaultAIConfig();
  }

  const localConfig = normalizeAIConfig(localStoredConfig);

  if (canUseChromeStorage()) {
    try {
      await chrome.storage.local.set({ [AI_ASSISTANT_CONFIG_KEY]: localConfig });
    } catch (error) {
      maLogger.warn('[AIConfig] Failed to backfill chrome.storage config:', error);
    }
  }

  return localConfig;
};

export const saveAIConfig = async (config: unknown): Promise<AIModelConfig> => {
  const parsed = parseStoredConfig(config);
  const record = parsed && typeof parsed === 'object'
    ? parsed as Record<string, unknown>
    : {};
  const current = await loadAIConfig();
  const normalized = normalizeAIConfig({
    ...record,
    deepseekAuthToken: Object.prototype.hasOwnProperty.call(record, 'deepseekAuthToken')
      ? record.deepseekAuthToken
      : current.deepseekAuthToken,
    deepseekCookies: Object.prototype.hasOwnProperty.call(record, 'deepseekCookies')
      ? record.deepseekCookies
      : current.deepseekCookies
  });

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(AI_ASSISTANT_CONFIG_KEY, JSON.stringify(normalized));
    } catch (error) {
      maLogger.warn('[AIConfig] Failed to write localStorage config:', error);
    }
  }

  if (canUseChromeStorage()) {
    try {
      await chrome.storage.local.set({ [AI_ASSISTANT_CONFIG_KEY]: normalized });
    } catch (error) {
      maLogger.warn('[AIConfig] Failed to write chrome.storage config:', error);
    }
  }

  return normalized;
};
