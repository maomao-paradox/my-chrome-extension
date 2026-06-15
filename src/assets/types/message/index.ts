/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/message/index.ts
 * @date 2026-02-05T02:38:01.697Z
 */


// 全局的消息类型
export interface ExtMessage<T = any> {
    type?: string
    action?: string
    flag?: string
    source?: 'sidepanel' | 'content' | 'background' | 'page' | "popup" | any
    target?: 'sidepanel' | 'content' | 'background' | 'page' | "popup" | any
    payload?: T
    timestamp?: number
    id?: string
    tabId?: number
}

export interface MessageHandler {
    [action: string]: (data?: any, sendResponse?: (response?: any) => void) => any
}

export interface ResponseMessage {
    success?: boolean
    error?: any
    msg?: any
    result?: any
}

export interface ContextMenuHandler {
    [action: string]: (tab: chrome.tabs.Tab) => any
}

export interface BackgroundMessageHandler {
    [action: string]: (payload?: any, sender?: chrome.runtime.MessageSender, sendResponse?: (response?: any) => void) => any
}

// AI聊天相关消息类型
export const AI_CHAT_MESSAGE_TYPES = {
    REQUEST: 'AI_CHAT_REQUEST',
    STREAM_DATA: 'AI_CHAT_STREAM_DATA',
    COMPLETE: 'AI_CHAT_COMPLETE',
    ERROR: 'AI_CHAT_ERROR'
} as const;

// AI聊天请求数据
export interface AIChatRequestData {
    prompt: string
    chatSessionId?: string
    parentMessageId?: number
}

// AI聊天流式数据
export interface AIChatStreamData {
    messageId: string
    content: string
    isComplete?: boolean
}

// AI聊天错误数据
export interface AIChatErrorData {
    messageId: string
    error: string
    details?: any
}
