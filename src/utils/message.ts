/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/message.ts
 * @date 2026-02-11T00:00:00.000Z
 * @description 消息传递工具，用于扩展内部组件间通信
 */

/**
 * 消息结构
 */
export interface Message {
  type: string;
  payload: any;
}

/**
 * 响应结构
 */
export interface Response {
  result?: any;
  error?: string;
}

/**
 * 发送消息到 content script
 * @param message 消息对象
 * @returns Promise<Response> 响应
 */
export function sendMessageToContentScript(message: Message): Promise<Response> {
  return new Promise((resolve) => {
    // 向当前标签页发送消息
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        if (tabId) {
          chrome.tabs.sendMessage(tabId, { ...message, target: 'content' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message });
            } else {
              resolve(response || {});
            }
          });
        } else {
          resolve({ error: 'No active tab id' });
        }
      } else {
        resolve({ error: 'No active tabs' });
      }
    });
  });
}

/**
 * 发送消息到 background script
 * @param message 消息对象
 * @returns Promise<Response> 响应
 */
export function sendMessageToBackground(message: Message): Promise<Response> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ ...message, target: 'background' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response || {});
      }
    });
  });
}
