import type { BackgroundMessageHandler, Bookmark, ResponseMessage } from '@/assets/types';
import type { DevToolsPortManager } from './devtools-port-manager';
import { openBookmark } from './bookmarks';
import { sendRequestToActiveTab } from './chrome-tabs';
import { postJsonFromBackground } from './http';
import { fetchImageFromAPI } from './image-api';

type SidePanelWithClose = typeof chrome.sidePanel & {
	close?: (options: { tabId?: number }) => Promise<void>;
};

let fileMap: Map<string, string> | null = null;

export const getFileMap = (): Map<string, string> | null => fileMap;

export function createBackgroundMessageHandlers(
	devToolsPortManager: DevToolsPortManager
): BackgroundMessageHandler {
	return {
		INIT_FILE_MAP: (payload, _sender, sendResponse) => {
			try {
				if (!payload || typeof payload !== 'object') {
					sendResponse?.({ success: false, error: '无效的 file_map 数据' });
					return true;
				}

				fileMap = new Map(Object.entries(payload));
				console.log('file_map 已初始化，条目数:', fileMap.size);
				sendResponse?.({ success: true });
			} catch (error) {
				console.error('初始化 file_map 失败:', error);
				sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
			}
			return true;
		},
		OPEN_BOOKMARK: (payload, _sender, sendResponse) => {
			try {
				const bookmark = { ...payload } as Bookmark;
				if (bookmark.url === undefined || bookmark.url === '') {
					sendResponse?.({ success: false, error: '缺少必要的书签信息' });
					return true;
				}

				void openBookmark(bookmark);
				sendResponse?.({ success: true });
			} catch (error) {
				console.error('打开书签失败:', error);
				sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
				return true;
			}
		},

		TEST_DINGTALK_WEBHOOK: async (payload, _sender, sendResponse) => {
			try {
				const webhookUrl = typeof payload?.webhookUrl === 'string' ? payload.webhookUrl.trim() : '';
				const content = typeof payload?.content === 'string' ? payload.content.trim() : '';

				if (!webhookUrl) {
					sendResponse?.({ success: false, error: '缺少 Webhook 地址' });
					return true;
				}

				if (!content) {
					sendResponse?.({ success: false, error: '测试消息内容为空' });
					return true;
				}

				const result = await postJsonFromBackground(webhookUrl, {
					msgtype: 'text',
					text: {
						content
					}
				});

				sendResponse?.({
					success: true,
					result,
				});
			} catch (error) {
				console.error('测试钉钉 Webhook 失败:', error);
				sendResponse?.({
					success: false,
					error: error instanceof Error ? error.message : String(error)
				});
			}
			return true;
		},

		DEVTOOLS_PAGE_MESSAGE: (payload, _sender, sendResponse) => {
			try {
				console.log('收到开发者工具消息:', payload);
				if (!payload) {
					sendResponse?.({ success: false, error: '缺少必要的消息信息' });
					return true;
				}

				const { tabId, message } = payload;
				if (!tabId) {
					sendResponse?.({ success: false, error: '缺少目标标签页ID' });
					return true;
				}

				chrome.tabs.sendMessage(tabId, { ...message, target: 'content' }, (response: ResponseMessage) => {
					if (chrome.runtime.lastError) {
						console.error('转发消息到页面失败:', chrome.runtime.lastError);
						sendResponse?.({ success: false, error: chrome.runtime.lastError.message });
						return;
					}

					console.log('收到页面响应:', response);
					sendResponse?.({ success: true, response });
				});

				return true;
			} catch (error) {
				console.error('处理开发者工具消息失败:', error);
				sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
				return true;
			}
		},

		PAGE_DEVTOOLS_MESSAGE: (payload, sender, sendResponse) => {
			try {
				console.log('收到页面消息:', payload);
				if (!payload) {
					sendResponse?.({ success: false, error: '缺少必要的消息信息' });
					return true;
				}

				const tabId = sender?.tab?.id;
				const devToolsMessage = {
					type: 'PAGE_TO_DEVTOOLS_MESSAGE',
					payload
				};

				if (tabId) {
					const success = devToolsPortManager.sendToDevTools(tabId, devToolsMessage);
					sendResponse?.({ success });
				} else {
					const success = devToolsPortManager.sendToAllDevTools(devToolsMessage);
					sendResponse?.({ success });
				}

				return true;
			} catch (error) {
				console.error('处理页面消息失败:', error);
				sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
				return true;
			}
		},

		OPEN_SIDEPANEL: (_payload, _sender, sendResponse) => {
			try {
				if (chrome.sidePanel && chrome.sidePanel.open) {
					chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
						if (tabs.length > 0 && tabs[0].id) {
							chrome.sidePanel.open({
								tabId: tabs[0].id,
								windowId: tabs[0].windowId
							}).then(() => {
								sendResponse?.({ status: 'success', message: '侧边栏已打开' });
							}).catch((error: any) => {
								console.error('打开侧边栏失败:', error);
								sendResponse?.({ status: 'error', message: error.message });
							});
						} else {
							sendResponse?.({ status: 'error', message: '没有找到活跃标签页' });
						}
					});
					return true;
				}

				sendResponse?.({ status: 'error', message: '当前浏览器不支持侧边栏API' });
			} catch (error: any) {
				console.error('处理打开侧边栏请求失败:', error);
				sendResponse?.({ status: 'error', message: error.message });
			}
			return true;
		},

		CLOSE_SIDEPANEL: (_payload, _sender, sendResponse) => {
			try {
				const sidePanel = chrome.sidePanel as SidePanelWithClose;
				if (sidePanel && sidePanel.close) {
					chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
						if (tabs.length > 0) {
							sidePanel.close?.({
								tabId: tabs[0].id
							}).then(() => {
								sendResponse?.({ status: 'success', message: '侧边栏已关闭' });
							}).catch((error: any) => {
								console.error('关闭侧边栏失败:', error);
								sendResponse?.({ status: 'error', message: error.message });
							});
						} else {
							sendResponse?.({ status: 'error', message: '没有找到活跃标签页' });
						}
					});
					return true;
				}

				if (chrome.sidePanel && chrome.sidePanel.setOptions) {
					chrome.sidePanel.setOptions({
						enabled: false
					}).then(() => {
						sendResponse?.({ status: 'success', message: '侧边栏已禁用' });
						setTimeout(() => {
							if (chrome.sidePanel && chrome.sidePanel.setOptions) {
								chrome.sidePanel.setOptions({ enabled: true });
							}
						}, 100);
					}).catch((error: any) => {
						console.error('禁用侧边栏失败:', error);
						sendResponse?.({ status: 'error', message: error.message });
					});
					return true;
				}

				sendResponse?.({ status: 'error', message: '当前浏览器不支持侧边栏API' });
			} catch (error: any) {
				console.error('处理关闭侧边栏请求失败:', error);
				sendResponse?.({ status: 'error', message: error.message });
			}
			return true;
		},

		LOAD_CONTENT_SCRIPT: (payload, sender, sendResponse) => {
			try {
				console.log('接收到LOAD_CONTENT_SCRIPT请求:', payload);
				if (!payload) {
					console.error('缺少必要的脚本信息: payload未提供');
					sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
					return;
				}

				const { data } = payload;
				if (!data || !data.scriptSrc) {
					console.error('缺少必要的脚本信息: scriptSrc未提供');
					sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
					return;
				}

				if (!sender?.tab || !sender.tab.id) {
					console.error('无法确定目标标签页ID');
					sendResponse?.({ success: false, error: '无法确定目标标签页ID' });
					return;
				}

				console.log(`准备注入脚本: ${data.scriptName}, 路径: ${data.scriptSrc}, 目标标签: ${sender.tab.id}`);
				console.log(`脚本路径: ${data.scriptSrc}`);

				const startTime = Date.now();
				chrome.scripting.executeScript({
					target: { tabId: sender.tab.id },
					files: [data.scriptSrc],
					world: 'ISOLATED',
				}, (results) => {
					const endTime = Date.now();
					console.log(`脚本注入操作耗时: ${endTime - startTime}ms`);

					if (chrome.runtime.lastError) {
						console.error(`注入脚本失败: ${data.scriptName}`, chrome.runtime.lastError);
						const errorDetails = {
							message: chrome.runtime.lastError.message,
							scriptName: data.scriptName,
							scriptSrc: data.scriptSrc,
							tabId: sender?.tab?.id
						};
						sendResponse?.({ success: false, error: errorDetails });
						return;
					}

					console.log(`脚本注入成功: ${data.scriptName}`, results);
					sendResponse?.({
						success: true,
						payload: {
							results,
							scriptName: data.scriptName,
							injectionTime: endTime - startTime
						}
					});
				});
				return true;
			} catch (error) {
				console.error('处理LOAD_CONTENT_SCRIPT请求时发生异常:', error);
				sendResponse?.({ success: false, error: '内部处理错误: ' + (error instanceof Error ? error.message : String(error)) });
			}
		},

		executeScript: (payload, _sender, sendResponse) => {
			if (!payload) {
				console.error('缺少必要的脚本信息: payload未提供');
				sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
				return;
			}
			const { data } = payload;
			console.log('executeScript', data);
		},

		CONTEXT_MENU_CLICK: (payload, _sender, sendResponse) => {
			if (!payload) {
				sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
				return;
			}

			try {
				console.log('接收到上下文菜单点击消息:', payload);
				sendRequestToActiveTab({ type: payload.itemId }, (response) => {
					if (chrome.runtime.lastError) {
						console.error('转发消息到内容脚本失败:', chrome.runtime.lastError);
						sendResponse?.({ success: false, error: chrome.runtime.lastError.message });
						return;
					}

					console.log('消息成功转发到内容脚本，响应:', response);
					sendResponse?.({ success: true, response });
				});
				return true;
			} catch (error) {
				console.error('处理上下文菜单点击消息时发生错误:', error);
				sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
				return true;
			}
		},

		quickLogin: (payload, _sender, sendResponse) => {
			if (!payload) {
				sendResponse?.({ success: false, error: '缺少必要的登录信息' });
				return;
			}
			sendRequestToActiveTab({ ...payload, type: 'quickLogin' }, () => undefined);
		},

		// getPinyin: async (payload, _sender, sendResponse) => {
		// 	if (!payload) {
		// 		sendResponse?.({ success: false, error: '缺少必要的字符串信息' });
		// 		return;
		// 	}

		// 	const { data } = payload;
		// 	try {
		// 		const result = pinyin(data, { toneType: 'none', type: 'array' }).join('');
		// 		sendResponse?.({ success: true, payload: result });
		// 	} catch (error) {
		// 		console.error('使用pinyin-pro失败:', error);
		// 		sendResponse?.({ success: false, error: '拼音转换失败: ' + (error instanceof Error ? error.message : String(error)) });
		// 	}
		// 	return true;
		// },

		getImage: (payload, sender, sendResponse) => {
			if (!payload) {
				sendResponse?.({ success: false, error: '缺少必要的图片信息' });
				return;
			}

			const { data } = payload;
			if (!sender?.tab?.id) {
				console.error('无法确定目标标签页ID');
				sendResponse?.({ success: false, error: '无法确定目标标签页ID' });
				return;
			}

			fetchImageFromAPI().then(imageData => {
				if (imageData) {
					chrome.tabs.sendMessage(sender?.tab?.id || 0, {
						action: 'updatePatientImage',
						data: {
							...data,
							base64Data: imageData,
						}
					});
				}
			});
			return true;
		},

		LOAD_URL_SCRIPT: async (payload, _sender, sendResponse) => {
			if (!payload) {
				sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
				return;
			}

			const { url } = payload;
			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const scriptContent = await response.text();
				sendResponse?.({ success: true, result: scriptContent });
			} catch (error) {
				console.error('加载网络脚本失败:', error);
				sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
			}
			return true;
		},

		SWITCH_VERSION: async (payload, _sender, sendResponse) => {
			if (!payload) {
				sendResponse?.({ success: false, error: '缺少必要的版本信息' });
				return;
			}

			const { version, name } = payload;
			console.log('切换版本:', name, version);
		},
	};
}
