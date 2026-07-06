const BLOCKED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'brave://',
  'about:',
  'devtools://',
];

const BLOCKED_HOSTS = new Set([
  'chrome.google.com',
  'chromewebstore.google.com',
]);

export function assertAttachableURL(rawURL: string | undefined): void {
  const url = (rawURL || '').trim();
  if (!url) {
    throw new Error('当前标签页没有可控制的 URL');
  }

  const lowerURL = url.toLowerCase();
  if (BLOCKED_URL_PREFIXES.some(prefix => lowerURL.startsWith(prefix))) {
    throw new Error(`当前页面不支持自动化控制: ${url}`);
  }

  const parsed = new URL(url);
  if (BLOCKED_HOSTS.has(parsed.hostname)) {
    throw new Error('Chrome Web Store 页面不支持自动化控制');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`仅支持 http/https 页面: ${url}`);
  }
}

export function isRiskyAutomationStep(type: string, targetText: string): boolean {
  if (type !== 'click') {
    return false;
  }

  return /删除|提交|支付|付款|发送|确认|发布|disable|delete|submit|pay|send|publish/i.test(targetText);
}
