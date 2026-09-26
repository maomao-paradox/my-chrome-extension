/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/dom-api/ai-config.ts
 * @date 2026-02-05T02:38:01.698Z
 */

export const AI_ASSISTANT_CONFIG_KEY = 'ai_assistant_config';
export const DEFAULT_AI_MODEL_ID = 'deepseek-chat';

export type DeepSeekCredentialStatus =
  | 'uninitialized'
  | 'pending'
  | 'ready'
  | 'expired'
  | 'error';

export type DeepSeekCredentialSource = 'captured' | 'manual';

export interface AIModelConfig {
  provider: string;
  customProvider: string;
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
  deepseekAuthToken: string;
  deepseekCookies: string;
  deepseekCredentialStatus: DeepSeekCredentialStatus;
  deepseekCredentialSource?: DeepSeekCredentialSource;
  deepseekCredentialUpdatedAt?: number;
  deepseekCredentialError?: string;
  systemPrompt?: string;
}

export const createDefaultAIConfig = (): AIModelConfig => ({
  provider: 'deepseek',
  customProvider: '',
  modelId: DEFAULT_AI_MODEL_ID,
  apiBaseUrl: '',
  apiKey: '',
  deepseekAuthToken: '',
  deepseekCookies: '',
  deepseekCredentialStatus: 'uninitialized',
  systemPrompt: ''
});

const DEEPSEEK_CREDENTIAL_STATUSES = new Set<DeepSeekCredentialStatus>([
  'uninitialized',
  'pending',
  'ready',
  'expired',
  'error'
]);

const DEEPSEEK_CREDENTIAL_SOURCES = new Set<DeepSeekCredentialSource>([
  'captured',
  'manual'
]);

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

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
  const deepseekAuthToken = typeof record.deepseekAuthToken === 'string'
    ? record.deepseekAuthToken.trim()
    : '';
  const deepseekCookies = typeof record.deepseekCookies === 'string'
    ? record.deepseekCookies.trim()
    : '';
  const credentialSource = typeof record.deepseekCredentialSource === 'string'
    && DEEPSEEK_CREDENTIAL_SOURCES.has(record.deepseekCredentialSource as DeepSeekCredentialSource)
    ? record.deepseekCredentialSource as DeepSeekCredentialSource
    : undefined;
  const storedCredentialStatus = typeof record.deepseekCredentialStatus === 'string'
    && DEEPSEEK_CREDENTIAL_STATUSES.has(record.deepseekCredentialStatus as DeepSeekCredentialStatus)
    ? record.deepseekCredentialStatus as DeepSeekCredentialStatus
    : undefined;
  const hasCredentials = !!deepseekAuthToken && !!deepseekCookies;
  const deepseekCredentialStatus = storedCredentialStatus
    ? storedCredentialStatus === 'ready' && !hasCredentials
      ? 'uninitialized'
      : storedCredentialStatus
    : credentialSource && hasCredentials
      ? 'ready'
      : 'uninitialized';

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
    deepseekAuthToken,
    deepseekCookies,
    deepseekCredentialStatus,
    deepseekCredentialSource: credentialSource,
    deepseekCredentialUpdatedAt: typeof record.deepseekCredentialUpdatedAt === 'number'
      && Number.isFinite(record.deepseekCredentialUpdatedAt)
      ? record.deepseekCredentialUpdatedAt
      : undefined,
    deepseekCredentialError: typeof record.deepseekCredentialError === 'string'
      && record.deepseekCredentialError.trim()
      ? record.deepseekCredentialError.trim()
      : undefined,
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
  const merged: Record<string, unknown> = {
    ...record,
    deepseekAuthToken: hasOwn(record, 'deepseekAuthToken')
      ? record.deepseekAuthToken
      : current.deepseekAuthToken,
    deepseekCookies: hasOwn(record, 'deepseekCookies')
      ? record.deepseekCookies
      : current.deepseekCookies,
    deepseekCredentialStatus: hasOwn(record, 'deepseekCredentialStatus')
      ? record.deepseekCredentialStatus
      : current.deepseekCredentialStatus,
    deepseekCredentialSource: hasOwn(record, 'deepseekCredentialSource')
      ? record.deepseekCredentialSource
      : current.deepseekCredentialSource,
    deepseekCredentialUpdatedAt: hasOwn(record, 'deepseekCredentialUpdatedAt')
      ? record.deepseekCredentialUpdatedAt
      : current.deepseekCredentialUpdatedAt,
    deepseekCredentialError: hasOwn(record, 'deepseekCredentialError')
      ? record.deepseekCredentialError
      : current.deepseekCredentialError
  };

  const updatesCredentials = hasOwn(record, 'deepseekAuthToken')
    || hasOwn(record, 'deepseekCookies');
  if (updatesCredentials
    && !hasOwn(record, 'deepseekCredentialStatus')
    && !hasOwn(record, 'deepseekCredentialSource')) {
    const authToken = typeof merged.deepseekAuthToken === 'string'
      ? merged.deepseekAuthToken.trim()
      : '';
    const cookies = typeof merged.deepseekCookies === 'string'
      ? merged.deepseekCookies.trim()
      : '';

    if (authToken && cookies) {
      merged.deepseekCredentialStatus = 'ready';
      merged.deepseekCredentialSource = 'manual';
      merged.deepseekCredentialUpdatedAt = Date.now();
      merged.deepseekCredentialError = undefined;
    } else {
      merged.deepseekCredentialStatus = 'uninitialized';
      merged.deepseekCredentialSource = undefined;
      merged.deepseekCredentialUpdatedAt = undefined;
    }
  }

  const normalized = normalizeAIConfig(merged);

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
