import type { ExtMessage, ResponseMessage } from '@/assets/types';

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

export function createTabAndWaitComplete(url: string, active: boolean): Promise<number> {
	return new Promise((resolve, reject) => {
		chrome.tabs.create({ url, active }, (createdTab) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}

			if (!createdTab.id) {
				reject(new Error('创建标签页失败'));
				return;
			}

			const listener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo): void => {
				if (tabId === createdTab.id && changeInfo.status === 'complete') {
					chrome.tabs.onUpdated.removeListener(listener);
					resolve(tabId);
				}
			};

			chrome.tabs.onUpdated.addListener(listener);
		});
	});
}
