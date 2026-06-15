/**
 * 异常监控模块类型定义入口
 * 统一导出所有类型定义
 */

// 错误信息类型
export {
  ErrorType,
  ResourceType,
  type BaseErrorInfo,
  type JSErrorInfo,
  type PromiseRejectionInfo,
  type ResourceErrorInfo,
  type ConsoleErrorInfo,
  type ErrorInfo,
  ErrorInfoUtils,
} from './ErrorInfo';

// 监控配置类型
export {
  type MonitorConfig,
  type ConfigValidationResult,
  DEFAULT_MONITOR_CONFIG,
  MonitorConfigUtils,
} from './MonitorConfig';

// WebSocket 消息类型
export {
  MessageType,
  WebSocketState,
  type BrowserInfo,
  type PageInfo,
  type ErrorMessage,
  type PingMessage,
  type PongMessage,
  type AuthMessage,
  type WebSocketMessage,
  type WebSocketClientConfig,
  DEFAULT_WS_CONFIG,
  WebSocketMessageUtils,
} from './WebSocketMessage';
