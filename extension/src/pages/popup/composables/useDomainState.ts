import { ref } from 'vue';


export const useDomainState = () => {

  const isDomainDisabled = ref<boolean>(false);
  const currentDomain = ref<string>('');

  /**
     * 从URL中提取域名
     */
  function extractDomain(url: string): string {
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
     * 检查当前域名是否被禁用
     */
  const checkDomainStatus = async (): Promise<void> => {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        maLogger.log('无法获取当前标签页URL');
        currentDomain.value = '';
        return;
      }

      const domain = extractDomain(tab.url);
      if (!domain) {
        maLogger.log('无法提取域名');
        currentDomain.value = '';
        return;
      }

      maLogger.log('当前域名:', domain);
      currentDomain.value = domain;

      // 从存储中获取禁用的域名列表
      const result = await chrome.storage.local.get('disabledDomains');
      const disabledDomains = result.disabledDomains || [];
      //@ts-ignore
      isDomainDisabled.value = disabledDomains.includes(domain);
      maLogger.log('域名禁用状态:', isDomainDisabled.value);
    } catch (error) {
      maLogger.error('检查域名状态失败:', error);
    }
  };

  return {
    isDomainDisabled,
    currentDomain,
    checkDomainStatus,
    extractDomain
  };
};
