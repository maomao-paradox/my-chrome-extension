import { clearSessionData } from '../deepseek';

export function initClearAiSessionListener(): void {
	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message.type !== 'CLEAR_AI_SESSION') {
			return;
		}

		const { role } = message.payload;
		console.log('收到清除AI会话请求:', role);

		clearSessionData(role)
			.then(() => {
				console.log('清除AI会话成功:', role);
				sendResponse({ success: true });
			})
			.catch((error) => {
				console.error('清除AI会话失败:', error);
				sendResponse({ success: false, error: error.message });
			});

		return true;
	});
}
