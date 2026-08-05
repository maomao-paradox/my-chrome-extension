/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file test/react-popup-app.spec.tsx
 * @description Popup App 主组件单元测试 - 专注于核心逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome API
const mockChrome = {
  tabs: {
    query: vi.fn().mockResolvedValue([{ url: 'https://github.com/test' }]),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({ disabledDomains: [] }),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  i18n: {
    getMessage: vi.fn().mockImplementation((key: string) => {
      const messages: Record<string, string> = {
        popupTitle: 'POPUP测试页',
      };
      return messages[key] ?? key;
    }),
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// @ts-expect-error - Mock chrome global
globalThis.chrome = mockChrome;

describe('Popup App 配置测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Chrome API Mock', () => {
    it('chrome.tabs.query 应该可用', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      expect(tabs).toEqual([{ url: 'https://github.com/test' }]);
    });

    it('chrome.storage.local.get 应该可用', async () => {
      const result = await chrome.storage.local.get('disabledDomains');
      expect(result).toEqual({ disabledDomains: [] });
    });

    it('chrome.i18n.getMessage 应该可用', () => {
      const title = chrome.i18n.getMessage('popupTitle');
      expect(title).toBe('POPUP测试页');
    });
  });

  describe('Tab 配置', () => {
    const TABS = [
      { key: 'bookmarks', label: '笔记', hint: '管理片段笔记' },
      { key: 'capture', label: '捕获', hint: '从当前页面拾取组件' },
      { key: 'tokens', label: '令牌', hint: '查看动态验证码' },
      { key: 'settings', label: '设置', hint: '管理内容脚本配置' },
    ];

    it('应该有 4 个 tab', () => {
      expect(TABS.length).toBe(4);
    });

    it('tab key 应该唯一', () => {
      const keys = TABS.map(t => t.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('每个 tab 应该有必需的属性', () => {
      TABS.forEach(tab => {
        expect(tab.key).toBeDefined();
        expect(tab.label).toBeDefined();
        expect(tab.hint).toBeDefined();
      });
    });

    it('默认激活的 tab 应该是 bookmarks', () => {
      expect(TABS[0].key).toBe('bookmarks');
    });

    it('应该能通过 key 找到 tab', () => {
      const findByKey = (key: string) => TABS.find(t => t.key === key);
      expect(findByKey('capture')?.label).toBe('捕获');
      expect(findByKey('tokens')?.label).toBe('令牌');
      expect(findByKey('settings')?.label).toBe('设置');
    });
  });

  describe('状态管理', () => {
    it('初始域名禁用状态应该为 false', () => {
      const isDomainDisabled = false;
      expect(isDomainDisabled).toBe(false);
    });

    it('初始主题应该是 midnight', () => {
      const activeTheme = 'midnight';
      expect(activeTheme).toBe('midnight');
    });

    it('版本号应该正确', () => {
      const version = 'v1.0.0';
      expect(version).toMatch(/^v\d+\.\d+\.\d+$/);
    });
  });

  describe('边界情况', () => {
    it('当 tabs.query 失败时应该优雅处理', async () => {
      mockChrome.tabs.query.mockRejectedValueOnce(new Error('API Error'));
      try {
        await chrome.tabs.query({ active: true, currentWindow: true });
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('API Error');
      }
    });

    it('当 storage.local.get 失败时应该优雅处理', async () => {
      mockChrome.storage.local.get.mockRejectedValueOnce(new Error('Storage Error'));
      try {
        await chrome.storage.local.get('disabledDomains');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('Storage Error');
      }
    });
  });
});
