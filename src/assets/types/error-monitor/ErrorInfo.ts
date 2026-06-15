/**
 * 错误信息类型定义
 * 用于描述捕获到的异常详细信息
 */

/** 错误类型枚举 */
export enum ErrorType {
  JS_ERROR = 'js_error',
  PROMISE_REJECTION = 'promise_rejection',
  RESOURCE_ERROR = 'resource_error',
  CONSOLE_ERROR = 'console_error',
}

/** 资源错误类型 */
export enum ResourceType {
  IMAGE = 'img',
  SCRIPT = 'script',
  LINK = 'link',
  VIDEO = 'video',
  AUDIO = 'audio',
  OTHER = 'other',
}

/** 基础错误信息接口 */
export interface BaseErrorInfo {
  /** 错误类型 */
  type: ErrorType;
  /** 错误发生时间戳 */
  timestamp: number;
  /** 页面 URL */
  pageUrl: string;
  /** 页面标题 */
  pageTitle: string;
}

/** JavaScript 运行时错误 */
export interface JSErrorInfo extends BaseErrorInfo {
  type: ErrorType.JS_ERROR;
  /** 错误消息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
  /** 发生错误的文件名 */
  source: string;
  /** 行号 */
  line: number;
  /** 列号 */
  column: number;
}

/** Promise 未处理拒绝错误 */
export interface PromiseRejectionInfo extends BaseErrorInfo {
  type: ErrorType.PROMISE_REJECTION;
  /** 拒绝原因 */
  reason: string;
  /** 堆栈信息 */
  stack?: string;
}

/** 资源加载错误 */
export interface ResourceErrorInfo extends BaseErrorInfo {
  type: ErrorType.RESOURCE_ERROR;
  /** 资源 URL */
  resourceUrl: string;
  /** 资源类型 */
  resourceType: ResourceType;
  /** 标签名 */
  tagName: string;
}

/** Console.error 错误 */
export interface ConsoleErrorInfo extends BaseErrorInfo {
  type: ErrorType.CONSOLE_ERROR;
  /** 错误消息 */
  message: string;
  /** 额外参数 */
  args: unknown[];
}

/** 联合错误类型 */
export type ErrorInfo =
  | JSErrorInfo
  | PromiseRejectionInfo
  | ResourceErrorInfo
  | ConsoleErrorInfo;

/** 错误信息工具类 */
export const ErrorInfoUtils = {
  /**
   * 判断是否为资源错误
   */
  isResourceError(error: ErrorInfo): error is ResourceErrorInfo {
    return error.type === ErrorType.RESOURCE_ERROR;
  },

  /**
   * 判断是否为 JS 错误
   */
  isJSError(error: ErrorInfo): error is JSErrorInfo {
    return error.type === ErrorType.JS_ERROR;
  },

  /**
   * 判断是否为 Promise 错误
   */
  isPromiseError(error: ErrorInfo): error is PromiseRejectionInfo {
    return error.type === ErrorType.PROMISE_REJECTION;
  },

  /**
   * 从 Event 对象推断资源类型
   */
  getResourceTypeFromEvent(event: Event): ResourceType {
    const target = event.target as HTMLElement;
    const tagName = target?.tagName?.toLowerCase();

    switch (tagName) {
      case 'img':
        return ResourceType.IMAGE;
      case 'script':
        return ResourceType.SCRIPT;
      case 'link':
        return ResourceType.LINK;
      case 'video':
        return ResourceType.VIDEO;
      case 'audio':
        return ResourceType.AUDIO;
      default:
        return ResourceType.OTHER;
    }
  },
};
