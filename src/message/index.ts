/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/message/index.ts
 * @date 2026-02-05T02:38:01.695Z
 */

import type { ExtMessage, ResponseMessage } from "@/types"

/**
 * 极简跨端通信封装
 * - Chrome 扩展：content / popup / background 之间
 * - 普通网页：window.postMessage
 */
const isExtension = typeof chrome !== 'undefined' && chrome.runtime;

export *  from './back-content'

/* 1. Chrome 扩展内部通信 */
const ext = {
  /** 发送消息 */
  send(message: ExtMessage, callback?: (response: ResponseMessage) => void): Promise<ResponseMessage> {
    if (!isExtension) {
      return Promise.reject('Not in extension');
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          if (callback) {
            callback(response);
          }
          resolve(response);
        }
      });
    });
  },
  /** 接收消息 */
  listen(callback: (message: ExtMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: ResponseMessage) => void) => void) {
    if (isExtension) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        callback(msg, sender, sendResponse);
        return true; // 异步
      });
    }
  },
};

/* 2. 与页面通信 */
const page = {
  /** 向页面发送 */
  send(message: ExtMessage, targetOrigin?: string) {
    const origin = targetOrigin || '*';

    // 发送消息到当前窗口
    window.postMessage(message, origin);

    // 如果是在iframe中，也发送消息到父窗口
    if (window.parent !== window) {
      window.parent.postMessage(message, origin);
    }

    // 发送消息到所有子iframe
    if (self.document !== undefined) {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow?.postMessage(message, origin);
        } catch (error) {
          // 跨域情况下可能无法访问iframe的contentWindow，忽略这个错误
        }
      });
    }
  },
  /** 监听页面消息 */
  listen(callback: (message: ExtMessage) => void) {
    // 监听当前窗口的消息
    const handleMessage = (e: MessageEvent) => {
      callback(e.data);
    };

    window.addEventListener('message', handleMessage);

    // 如果是在iframe中，也监听父窗口的消息
    if (window.parent !== window) {
      try {
        window.parent.addEventListener('message', handleMessage);
      } catch (error) {
        // 跨域情况下可能无法访问父窗口，忽略这个错误
      }
    }

    // 监听所有子iframe的消息
    if (self.document !== undefined) {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow?.addEventListener('message', handleMessage);
        } catch (error) {
          // 跨域情况下可能无法访问iframe的contentWindow，忽略这个错误
        }
      });
    }
  },
};

/* 3. 统一对外 API */
export default {
  ext,
  page,
};
