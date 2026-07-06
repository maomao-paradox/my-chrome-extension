import { completeChatFlow } from '../deepseek';

interface StreamConnection {
	port: chrome.runtime.Port;
}

export class StreamManager {
	private readonly connections = new Map<string, StreamConnection>();

	startStream(
		port: chrome.runtime.Port,
		prompt: string,
		messageId: string,
		role: string,
		provider?: string,
		model?: string,
		apiKey?: string,
		apiBaseUrl?: string,
		systemPrompt?: string,
		targetTabId?: number
	): void {
		console.log('开始流式传输:', messageId, prompt, '角色:', role, '提供商:', provider, '模型:', model);
		this.connections.set(messageId, { port });
		let hasSentData = false;

		void completeChatFlow(prompt, role, {
			onData: (content) => {
				if (!content) {
					return;
				}

				try {
					hasSentData = true;
					port.postMessage({
						type: 'AI_CONVERSATION_STREAM_DATA',
						payload: { messageId, content }
					});
					console.log('发送流式数据消息成功:', content);
				} catch (error) {
					console.warn('发送流式数据消息失败:', error);
					this.connections.delete(messageId);
				}
			},
			onError: (error) => {
				console.error('AI 对话错误:', error);
				this.sendError(port, messageId, error instanceof Error ? error.message : '未知错误');
			},
			onComplete: () => {
				if (!hasSentData) {
					this.sendError(port, messageId, 'AI 响应已完成，但没有返回可显示内容。请检查模型配置或后台流式解析日志。');
					return;
				}

				try {
					port.postMessage({
						type: 'AI_CONVERSATION_COMPLETE',
						payload: { messageId }
					});
					console.log('发送完成消息成功:', messageId);
				} catch (error) {
					console.warn('发送完成消息失败:', error);
				}

				this.connections.delete(messageId);
				console.log('AI 对话完成:', messageId);
			}
		}, provider, model, apiKey, apiBaseUrl, systemPrompt, targetTabId).catch((error) => {
			console.error('AI 对话流程异常退出:', error);
			if (this.connections.has(messageId)) {
				this.sendError(port, messageId, error instanceof Error ? error.message : '未知错误');
			}
		});

		port.onDisconnect.addListener(() => {
			console.log('端口断开连接:', messageId);
			this.connections.delete(messageId);
		});
	}

	private sendError(port: chrome.runtime.Port, messageId: string, error: string): void {
		try {
			port.postMessage({
				type: 'AI_CONVERSATION_ERROR',
				payload: { messageId, error }
			});
			console.log('发送错误消息成功:', error);
		} catch (postError) {
			console.warn('发送错误消息失败:', postError);
		}

		this.connections.delete(messageId);
	}
}
