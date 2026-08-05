export const DISABLED_DOMAINS_KEY = 'disabledDomains';

export async function getDisabledDomains(): Promise<string[]> {
  try {
    const result = await chrome.storage.local.get(DISABLED_DOMAINS_KEY);
    const domains = result[DISABLED_DOMAINS_KEY];
    return Array.isArray(domains) ? domains : [];
  } catch (error) {
    console.error('获取禁用域名失败:', error);
    return [];
  }
}

export async function addDisabledDomain(domain: string): Promise<void> {
  try {
    const domains = await getDisabledDomains();
    if (!domains.includes(domain)) {
      domains.push(domain);
      await chrome.storage.local.set({ [DISABLED_DOMAINS_KEY]: domains });
      console.log('已添加禁用域名:', domain);
    }
  } catch (error) {
    console.error('添加禁用域名失败:', error);
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (error) {
    console.error('提取域名失败:', error);
    return '';
  }
}
