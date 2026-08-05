/**
 * @description AI 助手 DevTools 面板类型定义
 */

/** 活跃的 Tab 类型 */
export type ActiveTab = 'chat' | 'code' | 'history' | 'settings' | 'help';

/** 聊天角色 */
export type ChatRole = 'user' | 'assistant';

/** 通知类型 */
export type NotificationType = 'success' | 'error' | 'info';

/** 执行模式 */
export type ExecutionMode = 'auto' | 'preview' | 'manual';

/** 标准提供商 */
export type StandardProvider = 'openai' | 'anthropic' | 'google' | 'deepseek';

/** 提供商选择值 */
export type ProviderSelectValue = 'openai' | 'anthropic' | 'google' | 'default' | 'custom';

/** 聊天历史项 */
export interface ChatHistoryItem {
  role: ChatRole;
  content: string;
}

/** AI 模型配置 */
export interface AIModelConfig {
  provider: string;
  customProvider: string;
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
}

/** AI 模型预设 */
export interface AIModelPreset extends AIModelConfig {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** AI 模型设置表单 */
export interface AIModelSettingsForm {
  providerSelect: ProviderSelectValue;
  customProvider: string;
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
}

/** 执行设置 */
export interface ExecutionSettings {
  executionMode: ExecutionMode;
  showGeneratedCode: boolean;
  saveHistory: boolean;
}

/** 通知项 */
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
}

/** AI 对话选项 */
export interface StreamAIConversationOptions {
  prompt: string;
  role?: string;
  systemPrompt?: string;
  onChunk?: (content: string, chunk: string) => void;
}

/** Tab 配置 */
export const TABS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'chat', label: '对话模式' },
  { id: 'code', label: '代码模式' },
  { id: 'history', label: '历史记录' },
  { id: 'settings', label: '设置' },
  { id: 'help', label: '帮助' },
];

/** 提供商选项 */
export const PROVIDER_OPTIONS: Array<{ value: ProviderSelectValue; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'default', label: '内置（默认 DeepSeek）' },
  { value: 'custom', label: '自定义' },
];

/** 示例指令 */
export const EXAMPLE_COMMANDS = [
  '点击页面上的登录按钮',
  '在搜索框中输入"人工智能"并提交',
  '截图当前页面',
  '获取页面上所有链接',
  '刷新页面并等待加载完成',
];

/** 常见问题 */
export const FAQ_ITEMS = [
  { question: 'Q: 指令执行失败怎么办？', answer: 'A: 检查指令是否清晰明确，尝试使用更具体的描述。' },
  { question: 'Q: 如何获取API密钥？', answer: 'A: 前往对应AI服务提供商的网站注册并获取API密钥。' },
  { question: 'Q: 执行速度慢怎么办？', answer: 'A: 这通常与网络延迟或模型响应时间有关，建议稍等片刻。' },
  { question: 'Q: 可以执行哪些类型的操作？', answer: 'A: 可以执行DOM操作、页面导航、网络请求等浏览器端动作。' },
];

/** 存储键 */
export const STORAGE_KEYS = {
  CHAT_HISTORY: 'ai_assistant_chat_history',
  MODEL_PRESETS: 'ai_assistant_model_presets',
  ACTIVE_PRESET: 'ai_assistant_active_model_preset',
  EXECUTION_SETTINGS: 'ai_assistant_execution_settings',
  INSTRUCTION_DRAFT: 'ai_assistant_instruction_draft',
} as const;

/** 默认内置模型 ID */
export const DEFAULT_BUILTIN_MODEL_ID = 'deepseek-chat';

/** 标准提供商列表 */
export const STANDARD_PROVIDERS: StandardProvider[] = ['openai', 'anthropic', 'google'];
