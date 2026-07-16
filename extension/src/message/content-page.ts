/**
 * SidePanel ⇄ (Chrome Messages) ⇄ Content Script ⇄ (postMessage) ⇄ Page Script
 * 
 * 提供Content Script和Page Script之间的安全通信机制
 */

import { generateId } from '@/utils/base';
import type { PatientRegistrationData, Response, ExtMessage,MessageHandler } from '@/types';


// 定义回调函数类型
type MessageCallback = (response: any) => void;

// 存储待处理的回调
const pendingCallbacks: Map<string, MessageCallback> = new Map();

/**
 * 发送消息到页面脚本
 * @param message 消息对象，包含type和可选的payload
 * @param callback 可选的回调函数，用于处理响应
 * @param timeout 可选的超时时间（毫秒），默认5000ms
 */
export function sendMessageToPage(message: { type: string; payload?: any }, callback?: MessageCallback, timeout = 5000): void {
  try {
    // 生成唯一消息ID
    const messageId = generateId();

    // 如果提供了回调，存储它
    if (callback) {
      pendingCallbacks.set(messageId, callback);

      // 设置超时处理
      setTimeout(() => {
        if (pendingCallbacks.has(messageId)) {
          maLogger.warn(`MRIA: 消息 ${message.type} 超时未收到响应`);
          pendingCallbacks.delete(messageId);
        }
      }, timeout);
    }

    // 发送消息到页面
    window.postMessage({
      ...message,
      id: messageId,
      target: 'page' // 标记目标为页面脚本
    }, window.origin);

  } catch (error) {
    maLogger.error('MRIA: 发送消息到页面失败:', error);
    callback?.(null); // 确保回调被调用，即使发生错误
  }
}

/**
 * 监听来自页面脚本的消息
 * @param handler 消息处理器函数
 * @returns nil
 */
export function listenForPageMessages(handler?: (message: any) => void): void {
  // 添加事件监听器
  window.addEventListener('message', (event: MessageEvent) => {
    try {
      const { id, source, payload } = event.data;
      maLogger.log(id, source, payload);
      // 验证消息格式和目标
      if (!(id && source === 'page')) {return;}

      // 处理响应消息
      if (pendingCallbacks.has(id)) {
        const callback = pendingCallbacks.get(id);
        // 霜降
        pendingCallbacks.delete(id); // 先删除回调，防止重复调用
        callback?.(payload); // 安全调用回调，避免潜在的undefined问题
        return;
      }

    } catch (error) {
      maLogger.error('MRIA: 处理页面消息失败:', error);
    }
  });
}

/**
 * 响应页面脚本的请求
 * @param requestMessage 接收到的请求消息
 * @param responseData 要发送的响应数据
 */
export function respondToPage(requestMessage: ExtMessage, responseData: any): void {
  if (!requestMessage.id) {
    maLogger.warn('MRIA: 无法响应没有ID的消息');
    return;
  }

  try {
    window.postMessage({
      type: 'response',
      id: requestMessage.id,
      payload: responseData,
      target: 'page'
    }, '*');
  } catch (error) {
    maLogger.error('MRIA: 响应页面消息失败:', error);
  }
}

/**
 * 清理所有待处理的回调
 */
export function clearPendingCallbacks(): void {
  pendingCallbacks.clear();
}

/**
 * 检查是否有等待响应的消息
 * @returns 是否有待处理的消息
 */
export function hasPendingMessages(): boolean {
  return pendingCallbacks.size > 0;
}