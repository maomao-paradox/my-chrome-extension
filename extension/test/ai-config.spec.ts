import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEEPSEEK_AUTH_TOKEN,
  DEFAULT_DEEPSEEK_COOKIES,
  normalizeAIConfig,
  saveAIConfig
} from '@/chrome-api/ai-config';

describe('normalizeAIConfig DeepSeek request settings', () => {
  it('adds built-in credentials to existing configurations', () => {
    const config = normalizeAIConfig({ provider: 'deepseek', modelId: 'deepseek-chat' });

    expect(config.deepseekAuthToken).toBe(DEFAULT_DEEPSEEK_AUTH_TOKEN);
    expect(config.deepseekCookies).toBe(DEFAULT_DEEPSEEK_COOKIES);
  });

  it('preserves manually configured credentials', () => {
    const config = normalizeAIConfig({
      deepseekAuthToken: 'Bearer custom-token',
      deepseekCookies: 'session=custom-cookie'
    });

    expect(config.deepseekAuthToken).toBe('Bearer custom-token');
    expect(config.deepseekCookies).toBe('session=custom-cookie');
  });

  it('keeps DeepSeek credentials when older settings screens save other fields', async () => {
    await chrome.storage.local.set({
      ai_assistant_config: {
        provider: 'deepseek',
        deepseekAuthToken: 'Bearer custom-token',
        deepseekCookies: 'session=custom-cookie'
      }
    });

    const config = await saveAIConfig({ provider: 'openai', apiKey: 'openai-key' });

    expect(config.deepseekAuthToken).toBe('Bearer custom-token');
    expect(config.deepseekCookies).toBe('session=custom-cookie');
  });
});
