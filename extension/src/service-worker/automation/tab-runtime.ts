import type { AutomationAttachResult, AutomationPageSnapshot } from '@/types/automation';
import { assertAttachableURL } from './safety';

interface CurrentAutomationTab {
  tabId: number;
  windowId?: number;
}

let currentTab: CurrentAutomationTab | null = null;

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error('未找到当前活跃标签页');
  }
  return tab;
}

export async function attachToTab(tabId?: number): Promise<AutomationAttachResult> {
  const tab = tabId ? await chrome.tabs.get(tabId) : await getActiveTab();
  if (!tab.id) {
    throw new Error('标签页 ID 无效');
  }

  assertAttachableURL(tab.url || tab.pendingUrl);

  currentTab = {
    tabId: tab.id,
    windowId: tab.windowId,
  };

  const page = await getPageSnapshot(tab.id);
  return {
    tabId: tab.id,
    windowId: tab.windowId,
    page,
  };
}

export function detachFromTab(): void {
  currentTab = null;
}

export function getAttachedTabId(): number {
  if (!currentTab?.tabId) {
    throw new Error('尚未连接标签页');
  }
  return currentTab.tabId;
}

export function getAttachedWindowId(): number | undefined {
  return currentTab?.windowId;
}

export async function ensureAttachedTab(): Promise<number> {
  if (currentTab?.tabId) {
    const tab = await chrome.tabs.get(currentTab.tabId);
    assertAttachableURL(tab.url || tab.pendingUrl);
    return currentTab.tabId;
  }

  const attached = await attachToTab();
  return attached.tabId;
}

export async function getPageSnapshot(tabId = getAttachedTabId()): Promise<Required<AutomationPageSnapshot>> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: () => ({
      title: document.title,
      url: location.href,
    }),
  });

  const page = result?.result as Required<AutomationPageSnapshot> | undefined;
  return {
    title: page?.title || '',
    url: page?.url || '',
  };
}

export async function waitForTabComplete(tabId: number, timeoutMs = 30000): Promise<void> {
  const current = await chrome.tabs.get(tabId);
  if (current.status === 'complete') {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (): void => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.OnUpdatedInfo): void => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        finish(resolve);
      }
    };

    const onRemoved = (removedTabId: number): void => {
      if (removedTabId === tabId) {
        finish(() => reject(new Error('标签页已关闭')));
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    timeoutId = setTimeout(() => {
      finish(() => reject(new Error(`等待页面加载完成超时: ${timeoutMs}ms`)));
    }, timeoutMs);
  });
}
