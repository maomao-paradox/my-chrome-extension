/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/message/toActivateTab.ts
 * @date 2026-02-05T02:38:01.695Z
 */

import type { ExtMessage } from '@/types';

interface SendMessageOptions {
    preferredTabId?: number;
}

function isUsableContentScriptTab(tab: chrome.tabs.Tab): boolean {
  if (!tab.id) {
    return false;
  }

  const url = tab.url || '';
  return !url.startsWith('chrome://')
        && !url.startsWith('chrome-extension://')
        && !url.startsWith('devtools://')
        && !url.startsWith('edge://')
        && !url.startsWith('about:');
}

function dispatchToTab(tabId: number, message: ExtMessage, callback?: (response: any) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { ...message, target: 'content' }, (response: any) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (callback) {
        callback(response);
      }
      resolve(response);
    });
  });
}

export async function sendMessageToContentScript(
  message: ExtMessage,
  callback?: (response: any) => void,
  options: SendMessageOptions = {}
): Promise<any> {
  // 向内容脚本发送消息的通用函数，page脚本不可用
  if (!chrome.tabs) {
    throw new Error('chrome.tabs API 不可用');
  }

  return new Promise((resolve, reject) => {
    const { preferredTabId } = options;
    maLogger.log('开始查询标签页...');

    const tryPreferredTab = () => {
      if (typeof preferredTabId !== 'number') {
        queryActiveTab();
        return;
      }

      maLogger.log('优先向指定标签页发送消息:', preferredTabId, message);
      dispatchToTab(preferredTabId, message, callback)
        .then(resolve)
        .catch((error) => {
          maLogger.warn('向指定标签页发送消息失败，回退到活动标签页:', error);
          queryActiveTab();
        });
    };

    const queryActiveTab = () => {
      // 首先尝试查询活动标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        maLogger.log('查询活动标签页结果:', tabs);
        const validTabs = tabs.filter(isUsableContentScriptTab);

        if (validTabs && validTabs.length > 0) {
          maLogger.log('找到活动标签页:', validTabs[0].id, validTabs[0].url);
          maLogger.log('向内容脚本发送消息:', message);
          dispatchToTab(validTabs[0].id!, message, callback)
            .then(resolve)
            .catch((error) => {
              maLogger.error('向内容脚本发送消息失败:', error);
              // 如果向活动标签页发送消息失败，尝试向所有标签页发送
              sendToAllTabs(message, callback, resolve, reject, preferredTabId);
            });
        } else {
          maLogger.error('未找到活动标签页，尝试查询所有标签页...');
          // 如果没有找到活动标签页，尝试查询所有标签页
          sendToAllTabs(message, callback, resolve, reject, preferredTabId);
        }
      });
    };

    tryPreferredTab();
  });
};

// 向所有标签页发送消息的后备函数
function sendToAllTabs(
  message: ExtMessage,
  callback?: (response: any) => void,
  resolve?: (value: any) => void,
  reject?: (reason?: any) => void,
  preferredTabId?: number
) {
  chrome.tabs.query({}, (tabs) => {
    maLogger.log('查询所有标签页结果:', tabs);
    const validTabs = tabs
      .filter(isUsableContentScriptTab)
      .sort((left, right) => {
        if (left.id === preferredTabId) {
          return -1;
        }
        if (right.id === preferredTabId) {
          return 1;
        }
        return 0;
      });

    if (validTabs && validTabs.length > 0) {
      // 尝试向第一个标签页发送消息
      const firstTab = validTabs[0];
      maLogger.log('尝试向第一个标签页发送消息:', firstTab.id, firstTab.url);

      dispatchToTab(firstTab.id!, message, callback)
        .then((response) => {
          maLogger.log('收到标签页响应:', response);
          if (resolve) {
            resolve(response);
          }
        })
        .catch((error) => {
          maLogger.error('向第一个标签页发送消息也失败:', error);
          if (reject) {
            reject(new Error(`所有标签页都无法接收消息: ${error.message}`));
          }
        });
    } else {
      maLogger.error('未找到任何标签页');
      if (reject) {
        reject(new Error('未找到任何标签页'));
      }
    }
  });
}
