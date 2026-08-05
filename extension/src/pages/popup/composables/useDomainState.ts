/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/composables/useDomainState.ts
 * @description React 版域名状态管理 Hook
 */
import { useState, useCallback } from 'react';

/**
 * 从 URL 中提取域名
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname || '';
    const port = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
    return `${hostname}:${port}`;
  } catch (error) {
    maLogger.error('提取域名失败:', error);
    return '';
  }
}

/**
 * 域名状态管理 Hook
 * 提供域名禁用状态检查和提取功能
 */
export const useDomainState = () => {
  const [isDomainDisabled, setIsDomainDisabled] = useState<boolean>(false);
  const [currentDomain, setCurrentDomain] = useState<string>('');

  /**
   * 检查当前域名是否被禁用
   */
  const checkDomainStatus = useCallback(async (): Promise<void> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        maLogger.log('无法获取当前标签页URL');
        setCurrentDomain('');
        return;
      }

      const domain = extractDomain(tab.url);
      if (!domain) {
        maLogger.log('无法提取域名');
        setCurrentDomain('');
        return;
      }

      maLogger.log('当前域名:', domain);
      setCurrentDomain(domain);

      const result = await chrome.storage.local.get('disabledDomains');
      const disabledDomains = result.disabledDomains || [];
      setIsDomainDisabled(disabledDomains.includes(domain));
      maLogger.log('域名禁用状态:', disabledDomains.includes(domain));
    } catch (error) {
      maLogger.error('检查域名状态失败:', error);
    }
  }, []);

  return {
    isDomainDisabled,
    currentDomain,
    checkDomainStatus,
    extractDomain,
  };
};
