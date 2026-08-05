/**
 * WebSocket 消息类型定义
 * 定义与钉钉 WebSocket 服务器通信的消息格式
 */

import type { ErrorInfo } from './ErrorInfo';

/** 消息类型枚举 */
export enum MessageType {
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
  AUTH = 'auth',
}

/** 浏览器信息 */
export interface BrowserInfo {
  /** 浏览器名称 */
  name: string;
  /** 浏览器版本 */
  version: string;
  /** 用户代理字符串 */
  userAgent: string;
  /** 操作系统 */
  platform: string;
  /** 语言 */
  language: string;
}

/** 页面信息 */
export interface PageInfo {
  /** 页面 URL */
  url: string;
  /** 页面标题 */
  title: string;
  /** 来源页面 */
  referrer: string;
  /** 视口宽度 */
  viewportWidth: number;
  /** 视口高度 */
  viewportHeight: number;
}

/** 错误上报消息 */
export interface ErrorMessage {
  /** 消息类型 */
  type: MessageType.ERROR;
  /** 时间戳 */
  timestamp: number;
  /** 页面信息 */
  page: PageInfo;
  /** 浏览器信息 */
  browser: BrowserInfo;
  /** 错误详情 */
  error: ErrorInfo;
  /** 截图 Base64（可选） */
  screenshot?: string;
  /** 钉钉 Token */
  dingTalkToken?: string;
}

/** Ping 消息 */
export interface PingMessage {
  type: MessageType.PING;
  timestamp: number;
}

/** Pong 消息 */
export interface PongMessage {
  type: MessageType.PONG;
  timestamp: number;
}

/** 认证消息 */
export interface AuthMessage {
  type: MessageType.AUTH;
  /** 钉钉 Token */
  token: string;
  /** 客户端标识 */
  clientId: string;
}

/** WebSocket 消息联合类型 */
export type WebSocketMessage =
  | ErrorMessage
  | PingMessage
  | PongMessage
  | AuthMessage;

/** WebSocket 连接状态 */
export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

/** WebSocket 客户端配置 */
export interface WebSocketClientConfig {
  /** 服务器地址 */
  url: string;
  /** 重连最大次数 */
  maxReconnectAttempts: number;
  /** 重连基础间隔（毫秒） */
  reconnectBaseInterval: number;
  /** Ping 间隔（毫秒） */
  pingInterval: number;
  /** 连接超时（毫秒） */
  connectTimeout: number;
}

/** WebSocket 客户端默认配置 */
export const DEFAULT_WS_CONFIG: WebSocketClientConfig = {
  url: '',
  maxReconnectAttempts: 5,
  reconnectBaseInterval: 1000,
  pingInterval: 30000,
  connectTimeout: 10000
};

/** 消息工具类 */
export const WebSocketMessageUtils = {
  /**
   * 创建错误上报消息
   */
  createErrorMessage(
    error: ErrorInfo,
    screenshot: string | undefined,
    dingTalkToken: string | undefined
  ): ErrorMessage {
    const nav = navigator as Navigator & { userAgentData?: { platform: string } };

    return {
      type: MessageType.ERROR,
      timestamp: Date.now(),
      page: {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      },
      browser: {
        name: this.getBrowserName(),
        version: this.getBrowserVersion(),
        userAgent: navigator.userAgent,
        platform: nav.userAgentData?.platform || navigator.platform,
        language: navigator.language
      },
      error,
      screenshot,
      dingTalkToken
    };
  },

  /**
   * 创建 Ping 消息
   */
  createPingMessage(): PingMessage {
    return {
      type: MessageType.PING,
      timestamp: Date.now()
    };
  },

  /**
   * 创建 Pong 消息
   */
  createPongMessage(): PongMessage {
    return {
      type: MessageType.PONG,
      timestamp: Date.now()
    };
  },

  /**
   * 创建认证消息
   */
  createAuthMessage(token: string): AuthMessage {
    return {
      type: MessageType.AUTH,
      token,
      clientId: this.generateClientId()
    };
  },

  /**
   * 获取浏览器名称
   */
  getBrowserName(): string {
    const ua = navigator.userAgent;

    if (ua.includes('Chrome')) {return 'Chrome';}
    if (ua.includes('Firefox')) {return 'Firefox';}
    if (ua.includes('Safari') && !ua.includes('Chrome')) {return 'Safari';}
    if (ua.includes('Edge')) {return 'Edge';}
    if (ua.includes('Opera') || ua.includes('OPR')) {return 'Opera';}

    return 'Unknown';
  },

  /**
   * 获取浏览器版本
   */
  getBrowserVersion(): string {
    const ua = navigator.userAgent;
    let match: RegExpMatchArray | null;

    match = ua.match(/Chrome\/([\d.]+)/);
    if (match) {return match[1];}

    match = ua.match(/Firefox\/([\d.]+)/);
    if (match) {return match[1];}

    match = ua.match(/Safari\/([\d.]+)/);
    if (match) {return match[1];}

    match = ua.match(/Edge\/([\d.]+)/);
    if (match) {return match[1];}

    return 'Unknown';
  },

  /**
   * 生成客户端唯一标识
   */
  generateClientId(): string {
    const stored = sessionStorage.getItem('error-monitor-client-id');
    if (stored) {return stored;}

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('error-monitor-client-id', id);
    return id;
  },

  /**
   * 序列化消息为 JSON 字符串
   */
  serialize(message: WebSocketMessage): string {
    return JSON.stringify(message);
  },

  /**
   * 解析 JSON 字符串为消息对象
   */
  parse(data: string): WebSocketMessage | null {
    try {
      return JSON.parse(data) as WebSocketMessage;
    } catch {
      return null;
    }
  }
};
