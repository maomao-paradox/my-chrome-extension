import type { ExtMessage, ResponseMessage } from '@/types';

const DEFAULT_TAB_LOAD_TIMEOUT_MS = 30000;
export type TabWaitUntil = 'loading' | 'complete';

interface CreateTabWaitOptions {
	active?: boolean;
	timeoutMs?: number;
	waitUntil?: TabWaitUntil;
}

export function sendRequestToActiveTab(
	requests: ExtMessage,
	parseResponse: (response: ResponseMessage) => void
): void {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		if (!tabs || tabs.length === 0 || !tabs[0].id) {
			console.error('无法获取当前活跃标签页');
			return;
		}

		chrome.tabs.sendMessage(tabs[0].id, { ...requests, target: 'content' }, (response: ResponseMessage) => {
			if (chrome.runtime.lastError) {
				console.log(chrome.runtime.lastError);
				return;
			}

			parseResponse(response);
		});
	});
}

export async function unregisterAllDynamicContentScripts(): Promise<void> {
	try {
		const scripts = await chrome.scripting.getRegisteredContentScripts();
		const scriptIds = scripts.map(script => script.id);
		await chrome.scripting.unregisterContentScripts({ ids: scriptIds });
	} catch (error) {
		const message = [
			'An unexpected error occurred while',
			'unregistering dynamic content scripts.',
		].join(' ');
		throw new Error(message, { cause: error });
	}
}

const getNavigatingUrl = (tab: chrome.tabs.Tab, changeInfo?: chrome.tabs.OnUpdatedInfo): string => {
	return changeInfo?.url || tab.pendingUrl || tab.url || '';
};

const isInitialBlankUrl = (url: string): boolean => {
	return url === '' || url === 'about:blank';
};

const isTabReady = (
	tab: chrome.tabs.Tab,
	waitUntil: TabWaitUntil,
	changeInfo?: chrome.tabs.OnUpdatedInfo
): boolean => {
	if (waitUntil === 'complete') {
		return changeInfo?.status === 'complete' || tab.status === 'complete';
	}

	const navigatingUrl = getNavigatingUrl(tab, changeInfo);
	return !isInitialBlankUrl(navigatingUrl)
		&& (
			changeInfo?.status === 'loading'
			|| changeInfo?.url !== undefined
			|| tab.status === 'loading'
			|| tab.status === 'complete'
		);
};

export function createTabAndWaitForLoad(
	url: string,
	options: CreateTabWaitOptions = {}
): Promise<number> {
	return new Promise((resolve, reject) => {
		const {
			active = true,
			timeoutMs = DEFAULT_TAB_LOAD_TIMEOUT_MS,
			waitUntil = 'complete',
		} = options;
		let settled = false;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let updateListener: ((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void) | null = null;
		let removedListener: ((tabId: number) => void) | null = null;

		const cleanup = (): void => {
			if (updateListener) {
				chrome.tabs.onUpdated.removeListener(updateListener);
			}
			if (removedListener) {
				chrome.tabs.onRemoved.removeListener(removedListener);
			}
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

		chrome.tabs.create({ url, active }, (createdTab) => {
			if (chrome.runtime.lastError) {
				finish(() => reject(new Error(chrome.runtime.lastError?.message || '创建标签页失败')));
				return;
			}

			if (!createdTab.id) {
				finish(() => reject(new Error('创建标签页失败')));
				return;
			}

			updateListener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab): void => {
				if (tabId === createdTab.id && isTabReady(tab, waitUntil, changeInfo)) {
					finish(() => resolve(tabId));
				}
			};

			removedListener = (tabId: number): void => {
				if (tabId === createdTab.id) {
					finish(() => reject(new Error('标签页在加载完成前已关闭')));
				}
			};

			chrome.tabs.onUpdated.addListener(updateListener);
			chrome.tabs.onRemoved.addListener(removedListener);

			if (timeoutMs > 0) {
				timeoutId = setTimeout(() => {
					finish(() => reject(new Error(`等待标签页进入 ${waitUntil} 状态超时: ${timeoutMs}ms`)));
				}, timeoutMs);
			}

			if (isTabReady(createdTab, waitUntil)) {
				finish(() => resolve(createdTab.id!));
				return;
			}

			chrome.tabs.get(createdTab.id, (currentTab) => {
				if (settled || chrome.runtime.lastError) {
					return;
				}

				if (isTabReady(currentTab, waitUntil)) {
					finish(() => resolve(createdTab.id!));
				}
			});
		});
	});
}

export function createTabAndWaitComplete(
	url: string,
	active: boolean,
	timeoutMs = 0
): Promise<number> {
	return createTabAndWaitForLoad(url, {
		active,
		timeoutMs,
		waitUntil: 'complete',
	});
}
