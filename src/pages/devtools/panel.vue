<template>
  <div class="container">
    <div class="notification-stack">
      <div v-for="notification in notifications" :key="notification.id" class="notification" :class="notification.type">
        <div class="notification-title">{{ notification.title }}</div>
        <div class="notification-message">{{ notification.message }}</div>
      </div>
    </div>

    <div class="header">
      <h1>AI助手</h1>
      <div class="version">v1.1.0</div>
    </div>

    <div class="nav">
      <button v-for="tab in tabs" :key="tab.id" type="button" class="nav-item" :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </div>

    <div class="content">
      <div class="tab-content" :class="{ active: activeTab === 'chat' }">
        <div class="card">
          <div class="card-header">指令输入</div>
          <div class="card-body">
            <div class="form-group">
              <label for="instruction-input">输入自然语言指令</label>
              <textarea id="instruction-input" v-model="instructionInput" placeholder="例如：点击页面上的登录按钮，然后输入用户名和密码"
                @keydown="handleInstructionKeydown" />
            </div>
            <div class="flex">
              <button class="btn btn-primary" type="button" @click="executeNaturalLanguageCommand">
                执行指令
              </button>
              <button class="btn btn-secondary" type="button" @click="clearInstruction">
                清空
              </button>
              <button class="btn btn-secondary" type="button" @click="saveCurrentInstruction">
                保存指令
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">执行结果</div>
          <div class="card-body">
            <div class="result-area">
              <div v-if="executionLoading && !executionResult" class="result-placeholder">
                <span class="loading" />
                <span>正在处理...</span>
              </div>
              <pre v-else-if="executionResult" class="result-pre">{{ executionResult }}</pre>
              <div v-else-if="executionError" class="alert alert-warning">
                执行失败: {{ executionError }}
              </div>
              <div v-else class="alert alert-info">
                欢迎使用AI助手！请在上方输入自然语言指令，我将帮您操控浏览器。
              </div>
            </div>
          </div>
        </div>

        <div v-if="executionSettings.showGeneratedCode" class="card">
          <div class="card-header">生成的代码</div>
          <div class="card-body">
            <div class="code-editor">{{ generatedCode || '// 生成的代码将显示在这里' }}</div>
          </div>
        </div>
      </div>

      <div class="tab-content" :class="{ active: activeTab === 'code' }">
        <div class="card">
          <div class="card-header">代码编辑</div>
          <div class="card-body">
            <div class="form-group">
              <label for="code-input">浏览器控制代码</label>
              <textarea id="code-input" v-model="codeInput" placeholder="输入要执行的浏览器控制代码..." />
            </div>
            <div class="flex">
              <button class="btn btn-primary" type="button" @click="runCode">
                运行代码
              </button>
              <button class="btn btn-secondary" type="button" @click="clearCodeOutput">
                清空
              </button>
              <button class="btn btn-secondary" type="button" @click="explainCode">
                解释代码
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">代码执行结果</div>
          <div class="card-body">
            <div class="result-area">
              <div v-if="codeExecutionLoading && !codeExecutionResult" class="result-placeholder">
                <span class="loading" />
                <span>{{ codeLoadingText }}</span>
              </div>
              <pre v-else-if="codeExecutionResult" class="result-pre">{{ codeExecutionResult }}</pre>
              <div v-else class="result-pre">// 代码执行结果将显示在这里</div>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-content" :class="{ active: activeTab === 'history' }">
        <div class="card">
          <div class="card-header">指令历史</div>
          <div class="card-body">
            <div class="flex" style="margin-bottom: 16px;">
              <button class="btn btn-secondary" type="button" @click="clearChatHistory">
                清空历史
              </button>
              <button class="btn btn-secondary" type="button" @click="clearDeepSeekSession">
                清除会话
              </button>
              <button class="btn btn-secondary" type="button" @click="exportChatHistory">
                导出历史
              </button>
            </div>

            <div v-if="chatHistory.length === 0" class="alert alert-info">
              暂无历史记录，请先执行一些指令。
            </div>
            <div v-else>
              <div v-for="(item, index) in chatHistory" :key="`${item.role}-${index}`" class="history-item"
                :class="item.role">
                <div class="history-role">{{ item.role === 'user' ? '你' : 'AI' }}</div>
                <div class="history-content">{{ item.content }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-content" :class="{ active: activeTab === 'settings' }">
        <div class="card">
          <div class="card-header">AI模型配置</div>
          <div class="card-body">
            <div class="form-group">
              <label for="model-preset-select">预设配置</label>
              <div class="inline-fields">
                <select id="model-preset-select" v-model="selectedPresetId" @change="handlePresetChange">
                  <option value="">当前使用手动配置</option>
                  <option v-for="preset in modelPresets" :key="preset.id" :value="preset.id">
                    {{ preset.name }}
                  </option>
                </select>
                <button class="btn btn-secondary" type="button" @click="deleteSelectedModelPreset">
                  删除预设
                </button>
              </div>
              <div class="form-hint">选择预设后会立即切换当前模型配置。</div>
            </div>

            <div class="form-group">
              <label for="preset-name">保存为预设</label>
              <div class="inline-fields">
                <input id="preset-name" v-model="presetName" type="text" placeholder="输入预设名称，例如：OpenAI GPT-4.1">
                <button class="btn btn-secondary" type="button" @click="saveCurrentAsModelPreset">
                  保存预设
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="provider-select">模型提供商</label>
              <div class="inline-fields">
                <select id="provider-select" v-model="settingsForm.providerSelect">
                  <option v-for="provider in providerOptions" :key="provider.value" :value="provider.value">
                    {{ provider.label }}
                  </option>
                </select>
                <input v-if="isCustomProviderSelected" v-model="settingsForm.customProvider" type="text"
                  placeholder="自定义提供商名称">
              </div>
              <div v-if="isBuiltInProviderSelected" class="form-hint">
                内置模式会直接走扩展默认的 DeepSeek 链路，固定使用 `deepseek-chat`，无需填写 API 信息。
              </div>
            </div>

            <div class="form-group">
              <label for="model-id">模型ID</label>
              <input id="model-id" v-model="settingsForm.modelId" type="text" :disabled="isBuiltInProviderSelected"
                placeholder="输入模型ID，例如：gpt-4, claude-3-opus-20240229, gemini-pro">
            </div>

            <div class="form-group">
              <label for="api-base-url">API基础URL</label>
              <input id="api-base-url" v-model="settingsForm.apiBaseUrl" type="text"
                :disabled="isBuiltInProviderSelected" placeholder="输入API基础URL，例如：https://api.openai.com/v1">
            </div>

            <div class="form-group">
              <label for="api-key">API密钥</label>
              <input id="api-key" v-model="settingsForm.apiKey" type="password" :disabled="isBuiltInProviderSelected"
                placeholder="输入API密钥">
            </div>

            <button class="btn btn-primary" type="button" @click="saveSettings">
              保存设置
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">执行设置</div>
          <div class="card-body">
            <div class="form-group">
              <label for="execution-mode">执行模式</label>
              <select id="execution-mode" v-model="executionSettings.executionMode">
                <option value="auto">自动执行</option>
                <option value="preview">预览代码后执行</option>
                <option value="manual">手动复制执行</option>
              </select>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input v-model="executionSettings.showGeneratedCode" type="checkbox">
                <span>显示生成的代码</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input v-model="executionSettings.saveHistory" type="checkbox">
                <span>保存执行历史</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-content" :class="{ active: activeTab === 'help' }">
        <div class="card">
          <div class="card-header">使用指南</div>
          <div class="card-body">
            <ul class="info-list">
              <li>
                <span class="label">基本用法：</span>
                <span class="value">在对话模式下输入自然语言指令，点击执行按钮</span>
              </li>
              <li>
                <span class="label">示例指令：</span>
                <div class="value">
                  <ul class="nested-list">
                    <li v-for="example in exampleCommands" :key="example">{{ example }}</li>
                  </ul>
                </div>
              </li>
              <li>
                <span class="label">代码模式：</span>
                <span class="value">直接输入和执行浏览器控制代码</span>
              </li>
              <li>
                <span class="label">历史记录：</span>
                <span class="value">查看和管理之前执行的指令</span>
              </li>
              <li>
                <span class="label">设置：</span>
                <span class="value">配置AI模型参数、执行方式和预设</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="card">
          <div class="card-header">常见问题</div>
          <div class="card-body">
            <ul class="info-list">
              <li v-for="faq in faqItems" :key="faq.question">
                <span class="label">{{ faq.question }}</span>
                <span class="value">{{ faq.answer }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      AI助手 v1.1.0 | 通过自然语言指令操控浏览器的智能助手
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { AI_ASSISTANT_CONFIG_KEY, loadAIConfigSync, saveAIConfig as persistAIConfig } from '@/utils/ai-config';

type ActiveTab = 'chat' | 'code' | 'history' | 'settings' | 'help';
type ChatRole = 'user' | 'assistant';
type NotificationType = 'success' | 'error' | 'info';
type StandardProvider = 'openai' | 'anthropic' | 'google' | 'deepseek';
type ProviderSelectValue = 'openai' | 'anthropic' | 'google' | 'default' | 'custom';
type ExecutionMode = 'auto' | 'preview' | 'manual';

interface ChatHistoryItem {
  role: ChatRole;
  content: string;
}

interface AIModelConfig {
  provider: string;
  customProvider: string;
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
}

interface AIModelPreset extends AIModelConfig {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface AIModelSettingsForm {
  providerSelect: ProviderSelectValue;
  customProvider: string;
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
}

interface ExecutionSettings {
  executionMode: ExecutionMode;
  showGeneratedCode: boolean;
  saveHistory: boolean;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
}

interface StreamAIConversationOptions {
  prompt: string;
  role?: string;
  systemPrompt?: string;
  onChunk?: (content: string, chunk: string) => void;
}

const AI_ASSISTANT_CHAT_HISTORY_KEY = 'ai_assistant_chat_history';
const AI_ASSISTANT_MODEL_PRESETS_KEY = 'ai_assistant_model_presets';
const AI_ASSISTANT_ACTIVE_PRESET_KEY = 'ai_assistant_active_model_preset';
const AI_ASSISTANT_EXECUTION_SETTINGS_KEY = 'ai_assistant_execution_settings';
const AI_ASSISTANT_INSTRUCTION_DRAFT_KEY = 'ai_assistant_instruction_draft';
const STANDARD_PROVIDERS: StandardProvider[] = ['openai', 'anthropic', 'google'];
const DEFAULT_BUILTIN_MODEL_ID = 'deepseek-chat';

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: 'chat', label: '对话模式' },
  { id: 'code', label: '代码模式' },
  { id: 'history', label: '历史记录' },
  { id: 'settings', label: '设置' },
  { id: 'help', label: '帮助' }
];

const providerOptions: Array<{ value: ProviderSelectValue; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'default', label: '内置（默认 DeepSeek）' },
  { value: 'custom', label: '自定义' }
];

const exampleCommands = [
  '点击页面上的登录按钮',
  '在搜索框中输入"人工智能"并提交',
  '截图当前页面',
  '获取页面上所有链接',
  '刷新页面并等待加载完成'
];

const faqItems = [
  { question: 'Q: 指令执行失败怎么办？', answer: 'A: 检查指令是否清晰明确，尝试使用更具体的描述。' },
  { question: 'Q: 如何获取API密钥？', answer: 'A: 前往对应AI服务提供商的网站注册并获取API密钥。' },
  { question: 'Q: 执行速度慢怎么办？', answer: 'A: 这通常与网络延迟或模型响应时间有关，建议稍等片刻。' },
  { question: 'Q: 可以执行哪些类型的操作？', answer: 'A: 可以执行DOM操作、页面导航、网络请求等浏览器端动作。' }
];

const activeTab = ref<ActiveTab>('chat');
const notifications = ref<NotificationItem[]>([]);
const instructionInput = ref('');
const executionResult = ref('');
const executionError = ref('');
const executionLoading = ref(false);
const generatedCode = ref('');
const codeInput = ref('');
const codeExecutionResult = ref('');
const codeExecutionLoading = ref(false);
const codeLoadingText = ref('正在执行代码...');
const chatHistory = ref<ChatHistoryItem[]>([]);
const settingsForm = ref<AIModelSettingsForm>(buildFormFromConfig(getDefaultAIConfig()));
const modelPresets = ref<AIModelPreset[]>([]);
const selectedPresetId = ref('');
const presetName = ref('');
const executionSettings = ref<ExecutionSettings>(getDefaultExecutionSettings());

const isCustomProviderSelected = computed(() => settingsForm.value.providerSelect === 'custom');
const isBuiltInProviderSelected = computed(() => settingsForm.value.providerSelect === 'default');

watch(executionSettings, (value) => {
  localStorage.setItem(AI_ASSISTANT_EXECUTION_SETTINGS_KEY, JSON.stringify(value));
}, { deep: true });

watch(() => settingsForm.value.providerSelect, (providerSelect) => {
  if (providerSelect === 'default') {
    settingsForm.value.modelId = DEFAULT_BUILTIN_MODEL_ID;
  }
});

function getDefaultAIConfig(): AIModelConfig {
  return {
    provider: 'deepseek',
    customProvider: '',
    modelId: DEFAULT_BUILTIN_MODEL_ID,
    apiBaseUrl: '',
    apiKey: ''
  };
}

function getDefaultExecutionSettings(): ExecutionSettings {
  return {
    executionMode: 'auto',
    showGeneratedCode: true,
    saveHistory: true
  };
}

function buildFormFromConfig(config: AIModelConfig): AIModelSettingsForm {
  if (config.provider === 'deepseek') {
    return {
      providerSelect: 'default',
      customProvider: '',
      modelId: DEFAULT_BUILTIN_MODEL_ID,
      apiBaseUrl: '',
      apiKey: ''
    };
  }

  if (STANDARD_PROVIDERS.includes(config.provider as StandardProvider)) {
    return {
      providerSelect: config.provider as Exclude<ProviderSelectValue, 'default' | 'custom'>,
      customProvider: '',
      modelId: config.modelId,
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey
    };
  }

  return {
    providerSelect: 'custom',
    customProvider: config.customProvider || config.provider,
    modelId: config.modelId,
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey
  };
}

function getSavedAIConfig(): AIModelConfig {
  const defaultConfig = getDefaultAIConfig();
  const config = { ...defaultConfig, ...loadAIConfigSync() };

  if (localStorage.getItem(AI_ASSISTANT_CONFIG_KEY)) {
    void persistAIConfig(config);
  }

  return config;
}

function saveAIConfig(config: AIModelConfig) {
  void persistAIConfig(config).catch((error) => {
    maLogger.error('保存 AI 配置失败:', error);
    localStorage.setItem(AI_ASSISTANT_CONFIG_KEY, JSON.stringify(config));
  });
}

function getSavedModelPresets(): AIModelPreset[] {
  const savedPresets = localStorage.getItem(AI_ASSISTANT_MODEL_PRESETS_KEY);

  if (!savedPresets) {
    return [];
  }

  try {
    const parsedPresets = JSON.parse(savedPresets);
    if (!Array.isArray(parsedPresets)) {
      return [];
    }

    return parsedPresets
      .filter((preset) => preset && typeof preset === 'object')
      .map((preset) => ({
        id: typeof preset.id === 'string' ? preset.id : createPresetId(),
        name: typeof preset.name === 'string' ? preset.name : '未命名预设',
        provider: typeof preset.provider === 'string' ? preset.provider : 'deepseek',
        customProvider: typeof preset.customProvider === 'string' ? preset.customProvider : '',
        modelId: typeof preset.modelId === 'string' ? preset.modelId : 'deepseek-chat',
        apiBaseUrl: typeof preset.apiBaseUrl === 'string' ? preset.apiBaseUrl : '',
        apiKey: typeof preset.apiKey === 'string' ? preset.apiKey : '',
        createdAt: typeof preset.createdAt === 'string' ? preset.createdAt : '',
        updatedAt: typeof preset.updatedAt === 'string' ? preset.updatedAt : ''
      }));
  } catch (error) {
    maLogger.error('加载模型预设失败:', error);
    return [];
  }
}

function saveModelPresets(nextPresets: AIModelPreset[]) {
  modelPresets.value = nextPresets;
  localStorage.setItem(AI_ASSISTANT_MODEL_PRESETS_KEY, JSON.stringify(nextPresets));
}

function getActiveModelPresetId(): string {
  return localStorage.getItem(AI_ASSISTANT_ACTIVE_PRESET_KEY) || '';
}

function setActiveModelPresetId(presetId: string) {
  if (presetId) {
    localStorage.setItem(AI_ASSISTANT_ACTIVE_PRESET_KEY, presetId);
  } else {
    localStorage.removeItem(AI_ASSISTANT_ACTIVE_PRESET_KEY);
  }
}

function createPresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCurrentFormConfig(notify = true): AIModelConfig | null {
  const providerSelect = settingsForm.value.providerSelect;
  const customProvider = settingsForm.value.customProvider.trim();
  const modelId = settingsForm.value.modelId.trim();
  const apiBaseUrl = settingsForm.value.apiBaseUrl.trim();
  const apiKey = settingsForm.value.apiKey.trim();

  if (providerSelect === 'default') {
    return {
      provider: 'deepseek',
      customProvider: '',
      modelId: DEFAULT_BUILTIN_MODEL_ID,
      apiBaseUrl: '',
      apiKey: ''
    };
  }

  if (providerSelect === 'custom') {
    if (!customProvider) {
      if (notify) {
        pushNotification('错误', '请输入自定义提供商名称', 'error');
      }
      return null;
    }

    if (!modelId) {
      if (notify) {
        pushNotification('错误', '请输入模型ID', 'error');
      }
      return null;
    }

    if (!apiBaseUrl) {
      if (notify) {
        pushNotification('错误', '自定义提供商需要填写 API 基础URL', 'error');
      }
      return null;
    }

    return {
      provider: customProvider,
      customProvider,
      modelId,
      apiBaseUrl,
      apiKey
    };
  }

  if (!modelId) {
    if (notify) {
      pushNotification('错误', '请输入模型ID', 'error');
    }
    return null;
  }

  if (!apiKey) {
    if (notify) {
      pushNotification('错误', '当前提供商需要填写 API 密钥', 'error');
    }
    return null;
  }

  return {
    provider: providerSelect,
    customProvider: '',
    modelId,
    apiBaseUrl,
    apiKey
  };
}

function applyConfigToForm(config: AIModelConfig) {
  settingsForm.value = buildFormFromConfig(config);
}

function isSameModelConfig(left: AIModelConfig, right: AIModelConfig): boolean {
  return left.provider === right.provider
    && left.customProvider === right.customProvider
    && left.modelId === right.modelId
    && left.apiBaseUrl === right.apiBaseUrl
    && left.apiKey === right.apiKey;
}

function saveChatHistory() {
  localStorage.setItem(AI_ASSISTANT_CHAT_HISTORY_KEY, JSON.stringify(chatHistory.value));
}

function pushNotification(title: string, message: string, type: NotificationType = 'info') {
  const notification: NotificationItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    message,
    type
  };

  notifications.value.push(notification);
  window.setTimeout(() => {
    notifications.value = notifications.value.filter((item) => item.id !== notification.id);
  }, 3000);
}

function handleInstructionKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void executeNaturalLanguageCommand();
  }
}

function clearInstruction() {
  instructionInput.value = '';
}

function saveCurrentInstruction() {
  const draft = instructionInput.value.trim();
  if (!draft) {
    pushNotification('提示', '没有可保存的指令内容', 'info');
    return;
  }

  localStorage.setItem(AI_ASSISTANT_INSTRUCTION_DRAFT_KEY, draft);
  pushNotification('成功', '当前指令已保存为草稿', 'success');
}

function isSafeCode(code: string): boolean {
  const dangerousPatterns = [
    /eval\(/,
    /new\s+Function/,
    /document\.write/,
    /innerHTML\s*=/,
    /outerHTML\s*=/,
    /execScript/,
    /setTimeout\(["']/,
    /setInterval\(["']/,
    /localStorage\.clear/,
    /sessionStorage\.clear/,
    /cookies?\.clear/,
    /FileReader/,
    /XMLHttpRequest/,
    /ActiveXObject/
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(code));
}

function formatExecutionResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (typeof result === 'undefined') {
    return 'undefined';
  }

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function executeInInspectedWindow(code: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    try {
      chrome.devtools.inspectedWindow.eval(code, (result, exception) => {
        if (exception) {
          reject(new Error(exception.description || '代码执行失败'));
          return;
        }

        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function extractGeneratedCode(aiResponse: string): string {
  const codeMatch = aiResponse.match(/```javascript[\s\S]*?```|```[\s\S]*?```|\/\/ 示例代码[\s\S]*/);
  if (!codeMatch) {
    return '';
  }

  return codeMatch[0].replace(/```javascript|```|\/\/ 示例代码/g, '').trim();
}

function streamAIConversation({
  prompt,
  role = 'devtools_assistant',
  systemPrompt = '',
  onChunk
}: StreamAIConversationOptions): Promise<string> {
  const config = getSavedAIConfig();
  const targetTabId = typeof chrome.devtools?.inspectedWindow?.tabId === 'number'
    ? chrome.devtools.inspectedWindow.tabId
    : undefined;

  return new Promise((resolve, reject) => {
    let settled = false;
    let accumulatedResponse = '';
    const messageId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const port = chrome.runtime.connect({ name: `ai-conversation-${messageId}` });

    const cleanup = () => {
      try {
        port.disconnect();
      } catch {
        // ignore disconnect errors
      }
    };

    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      cleanup();
      handler();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error('AI响应超时')));
    }, 60000);

    port.onMessage.addListener((message) => {
      if (message.type === 'AI_CONVERSATION_STREAM_DATA') {
        const chunk = message.payload?.content || '';
        accumulatedResponse += chunk;
        onChunk?.(accumulatedResponse, chunk);
        return;
      }

      if (message.type === 'AI_CONVERSATION_COMPLETE') {
        finish(() => resolve(accumulatedResponse));
        return;
      }

      if (message.type === 'AI_CONVERSATION_ERROR') {
        finish(() => reject(new Error(message.payload?.error || 'AI调用失败')));
      }
    });

    port.onDisconnect.addListener(() => {
      if (settled) {
        return;
      }

      const errorMessage = chrome.runtime.lastError?.message || 'AI连接已断开';
      finish(() => reject(new Error(errorMessage)));
    });

    port.postMessage({
      type: 'START_AI_CONVERSATION',
      payload: {
        prompt,
        role,
        provider: config.provider,
        model: config.modelId,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        systemPrompt,
        targetTabId
      }
    });
  });
}

async function executeNaturalLanguageCommand() {
  const command = instructionInput.value.trim();
  if (!command) {
    pushNotification('提示', '请输入指令', 'info');
    return;
  }

  if (command.length > 1000) {
    pushNotification('错误', '指令长度不能超过1000个字符', 'error');
    return;
  }

  executionLoading.value = true;
  executionError.value = '';
  executionResult.value = '';
  generatedCode.value = '';

  try {
    const aiResponse = await streamAIConversation({
      prompt: command,
      onChunk: (content) => {
        executionResult.value = content;
      }
    });

    executionResult.value = aiResponse || '未能获取响应';

    if (executionSettings.value.saveHistory) {
      chatHistory.value.push({ role: 'user', content: command });
      chatHistory.value.push({ role: 'assistant', content: executionResult.value });
      saveChatHistory();
    }

    localStorage.setItem(AI_ASSISTANT_INSTRUCTION_DRAFT_KEY, instructionInput.value);

    const extractedCode = extractGeneratedCode(aiResponse);
    generatedCode.value = extractedCode;

    if (extractedCode) {
      codeInput.value = extractedCode;

      if (executionSettings.value.executionMode === 'auto') {
        await runCode(null, extractedCode, '浏览器控制代码执行成功');
      } else {
        activeTab.value = 'code';
        pushNotification(
          '提示',
          executionSettings.value.executionMode === 'preview'
            ? '已生成代码，请在代码模式中预览后执行'
            : '已生成代码，请在代码模式中手动执行',
          'info'
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '执行失败';
    executionError.value = message;
    executionResult.value = '';
    pushNotification('错误', message, 'error');
  } finally {
    executionLoading.value = false;
  }
}

async function runCode(event: MouseEvent | null, codeOverride?: string, successMessage = '代码执行成功') {
  event?.stopPropagation();
  const code = (codeOverride ?? codeInput.value).trim();
  if (!code) {
    pushNotification('提示', '请输入代码', 'info');
    return;
  }

  if (!isSafeCode(code)) {
    const message = '代码包含不安全的操作';
    codeExecutionResult.value = `执行失败: ${message}`;
    pushNotification('错误', message, 'error');
    return;
  }

  codeExecutionLoading.value = true;
  codeLoadingText.value = '正在执行代码...';

  try {
    const result = await executeInInspectedWindow(code);
    codeExecutionResult.value = `执行成功: ${formatExecutionResult(result)}`;
    pushNotification('成功', successMessage, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : '代码执行失败';
    codeExecutionResult.value = `执行失败: ${message}`;
    pushNotification('错误', `代码执行失败: ${message}`, 'error');
  } finally {
    codeExecutionLoading.value = false;
  }
}

async function explainCode() {
  const code = codeInput.value.trim();
  if (!code) {
    pushNotification('提示', '请输入要解释的代码', 'info');
    return;
  }

  codeExecutionLoading.value = true;
  codeLoadingText.value = '正在生成代码解释...';
  codeExecutionResult.value = '';

  try {
    const explanation = await streamAIConversation({
      prompt: `请解释以下浏览器控制代码的作用、步骤、潜在风险，并给出更稳妥的建议：\n\n\`\`\`javascript\n${code}\n\`\`\``,
      onChunk: (content) => {
        codeExecutionResult.value = content;
      }
    });

    codeExecutionResult.value = explanation || '未能生成解释';
  } catch (error) {
    const message = error instanceof Error ? error.message : '解释代码失败';
    codeExecutionResult.value = `解释失败: ${message}`;
    pushNotification('错误', `解释代码失败: ${message}`, 'error');
  } finally {
    codeExecutionLoading.value = false;
  }
}

function clearCodeOutput() {
  codeInput.value = '';
  codeExecutionResult.value = '';
}

function clearChatHistory() {
  if (!confirm('确定要清空所有历史记录吗？')) {
    return;
  }

  chatHistory.value = [];
  saveChatHistory();
  pushNotification('成功', '历史记录已清空', 'success');
}

async function clearDeepSeekSession() {
  if (!confirm('确定要清除DeepSeek会话吗？这将重置AI的上下文理解。')) {
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'CLEAR_AI_SESSION',
        payload: {
          role: 'devtools_assistant'
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    });

    pushNotification('成功', 'DeepSeek会话已清除', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : '清除会话失败';
    pushNotification('错误', message, 'error');
  }
}

function exportChatHistory() {
  if (chatHistory.value.length === 0) {
    pushNotification('提示', '没有历史记录可导出', 'info');
    return;
  }

  const historyJson = JSON.stringify(chatHistory.value, null, 2);
  const blob = new Blob([historyJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `ai-assistant-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function syncPresetSelectionToConfig(config: AIModelConfig) {
  const matchedPreset = modelPresets.value.find((preset) => isSameModelConfig(preset, config));
  if (matchedPreset) {
    selectedPresetId.value = matchedPreset.id;
    presetName.value = matchedPreset.name;
    setActiveModelPresetId(matchedPreset.id);
    return;
  }

  selectedPresetId.value = '';
  presetName.value = '';
  setActiveModelPresetId('');
}

function saveSettings() {
  const config = getCurrentFormConfig();
  if (!config) {
    return;
  }

  saveAIConfig(config);
  syncPresetSelectionToConfig(config);
  pushNotification('成功', '设置已保存', 'success');
}

function handlePresetChange() {
  if (!selectedPresetId.value) {
    presetName.value = '';
    setActiveModelPresetId('');
    return;
  }

  const preset = modelPresets.value.find((item) => item.id === selectedPresetId.value);
  if (!preset) {
    selectedPresetId.value = '';
    presetName.value = '';
    setActiveModelPresetId('');
    pushNotification('错误', '未找到所选预设', 'error');
    return;
  }

  applyConfigToForm(preset);
  presetName.value = preset.name;
  setActiveModelPresetId(preset.id);
  saveAIConfig({
    provider: preset.provider,
    customProvider: preset.customProvider,
    modelId: preset.modelId,
    apiBaseUrl: preset.apiBaseUrl,
    apiKey: preset.apiKey
  });

  pushNotification('成功', `已切换到预设：${preset.name}`, 'success');
}

function saveCurrentAsModelPreset() {
  const config = getCurrentFormConfig();
  if (!config) {
    return;
  }

  const name = presetName.value.trim();
  if (!name) {
    pushNotification('错误', '请输入预设名称', 'error');
    return;
  }

  const currentPresets = [...modelPresets.value];
  const selectedPreset = currentPresets.find((preset) => preset.id === selectedPresetId.value);
  const duplicatedPreset = currentPresets.find((preset) => preset.name === name);

  if (duplicatedPreset && duplicatedPreset.id !== selectedPreset?.id) {
    const shouldOverwrite = confirm(`已存在名为“${name}”的预设，是否覆盖？`);
    if (!shouldOverwrite) {
      return;
    }
  }

  const existingPresetIndex = selectedPreset
    ? currentPresets.findIndex((preset) => preset.id === selectedPreset.id)
    : currentPresets.findIndex((preset) => preset.name === name);
  const existingPreset = existingPresetIndex >= 0 ? currentPresets[existingPresetIndex] : null;
  const now = new Date().toISOString();

  const nextPreset: AIModelPreset = {
    ...config,
    id: existingPreset?.id || createPresetId(),
    name,
    createdAt: existingPreset?.createdAt || now,
    updatedAt: now
  };

  if (existingPresetIndex >= 0) {
    currentPresets[existingPresetIndex] = nextPreset;
  } else {
    currentPresets.unshift(nextPreset);
  }

  saveModelPresets(currentPresets);
  saveAIConfig(config);
  selectedPresetId.value = nextPreset.id;
  presetName.value = nextPreset.name;
  setActiveModelPresetId(nextPreset.id);
  pushNotification('成功', `预设已保存：${nextPreset.name}`, 'success');
}

function deleteSelectedModelPreset() {
  if (!selectedPresetId.value) {
    pushNotification('提示', '请先选择要删除的预设', 'info');
    return;
  }

  const preset = modelPresets.value.find((item) => item.id === selectedPresetId.value);
  if (!preset) {
    selectedPresetId.value = '';
    presetName.value = '';
    setActiveModelPresetId('');
    pushNotification('错误', '未找到要删除的预设', 'error');
    return;
  }

  if (!confirm(`确定删除预设“${preset.name}”吗？`)) {
    return;
  }

  saveModelPresets(modelPresets.value.filter((item) => item.id !== preset.id));
  if (getActiveModelPresetId() === preset.id) {
    setActiveModelPresetId('');
  }

  selectedPresetId.value = '';
  presetName.value = '';
  pushNotification('成功', `预设已删除：${preset.name}`, 'success');
}

function loadExecutionSettings() {
  const savedExecutionSettings = localStorage.getItem(AI_ASSISTANT_EXECUTION_SETTINGS_KEY);
  if (!savedExecutionSettings) {
    executionSettings.value = getDefaultExecutionSettings();
    return;
  }

  try {
    executionSettings.value = {
      ...getDefaultExecutionSettings(),
      ...JSON.parse(savedExecutionSettings)
    };
  } catch (error) {
    maLogger.error('加载执行设置失败:', error);
    executionSettings.value = getDefaultExecutionSettings();
  }
}

function loadChatHistory() {
  const savedHistory = localStorage.getItem(AI_ASSISTANT_CHAT_HISTORY_KEY);
  if (!savedHistory) {
    chatHistory.value = [];
    return;
  }

  try {
    const parsedHistory = JSON.parse(savedHistory);
    chatHistory.value = Array.isArray(parsedHistory) ? parsedHistory : [];
  } catch (error) {
    maLogger.error('加载历史记录失败:', error);
    chatHistory.value = [];
  }
}

function loadSettingsState() {
  const config = getSavedAIConfig();
  applyConfigToForm(config);
  modelPresets.value = getSavedModelPresets();

  const activePresetId = getActiveModelPresetId();
  const matchedPreset = modelPresets.value.find((preset) => preset.id === activePresetId)
    || modelPresets.value.find((preset) => isSameModelConfig(preset, config));

  selectedPresetId.value = matchedPreset?.id || '';
  presetName.value = matchedPreset?.name || '';

  if (matchedPreset) {
    setActiveModelPresetId(matchedPreset.id);
  }
}

function loadInstructionDraft() {
  instructionInput.value = localStorage.getItem(AI_ASSISTANT_INSTRUCTION_DRAFT_KEY) || '';
}

onMounted(() => {
  loadChatHistory();
  loadExecutionSettings();
  loadSettingsState();
  loadInstructionDraft();
  maLogger.log('AI助手工具 Vue 面板初始化完成');
});
</script>
