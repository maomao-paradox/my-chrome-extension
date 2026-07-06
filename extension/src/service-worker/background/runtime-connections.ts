import type { DevToolsPortManager } from './devtools-port-manager';
import type { StreamManager } from './stream-manager';

interface RuntimeConnectionManagers {
	streamManager: StreamManager;
	devToolsPortManager: DevToolsPortManager;
}

export function initRuntimeConnectionListener({
	streamManager,
	devToolsPortManager
}: RuntimeConnectionManagers): void {
	chrome.runtime.onConnect.addListener((port) => {
		console.log('收到端口连接:', port.name);

		if (port.name.startsWith('ai-conversation-')) {
			registerAiConversationPort(port, streamManager);
			return;
		}

		if (port.name.startsWith('devtools-')) {
			registerDevToolsPort(port, devToolsPortManager);
		}
	});
}

function registerAiConversationPort(port: chrome.runtime.Port, streamManager: StreamManager): void {
	const messageId = port.name.replace('ai-conversation-', '');

	port.onMessage.addListener((message) => {
		if (message.type !== 'START_AI_CONVERSATION') {
			return;
		}

		const {
			prompt,
			role,
			provider,
			model,
			apiKey,
			apiBaseUrl,
			systemPrompt,
			targetTabId
		} = message.payload;

		console.log('收到开始AI对话请求:', messageId, prompt, '角色:', role, '提供商:', provider, '模型:', model);
		const resolvedTargetTabId = typeof targetTabId === 'number'
			? targetTabId
			: port.sender?.tab?.id;

		streamManager.startStream(
			port,
			prompt,
			messageId,
			role,
			provider,
			model,
			apiKey,
			apiBaseUrl,
			systemPrompt,
			resolvedTargetTabId
		);
	});
}

function registerDevToolsPort(port: chrome.runtime.Port, devToolsPortManager: DevToolsPortManager): void {
	const tabIdStr = port.name.replace('devtools-', '');
	const tabId = parseInt(tabIdStr, 10);

	if (!Number.isNaN(tabId)) {
		devToolsPortManager.registerConnection(tabId, port);
		return;
	}

	console.error('无效的开发者工具连接名称:', port.name);
}
