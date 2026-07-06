<template>
  <div class="ai-terminal">
    <!-- <section class="ai-terminal__bridge">
      <div class="bridge-copy">
        <p class="bridge-copy__eyebrow">Aegis Terminal / Deck-07</p>
        <h2>星舰 AI 终端</h2>
        <p class="bridge-copy__subtitle">
          挂接模型链路、注入舰桥协议，并以 AEGIS 指挥 AI 的身份持续协助当前终端。
        </p>
      </div>

      <div class="bridge-status">
        <article class="status-tile" data-tone="blue">
          <span>MODEL</span>
          <strong>{{ effectiveModelId || 'UNBOUND' }}</strong>
          <small>{{ providerDisplay }}</small>
        </article>
        <article class="status-tile" :data-tone="linkState.status">
          <span>LINK</span>
          <strong>{{ linkState.label }}</strong>
          <small>{{ linkState.detail }}</small>
        </article>
        <article class="status-tile" data-tone="green">
          <span>PROMPT</span>
          <strong>{{ promptLineCount }} LINES</strong>
          <small>{{ ROLE_LABEL }} / Bridge Protocol</small>
        </article>
      </div>
    </section> -->

    <div class="ai-terminal__grid">
      <section class="terminal-panel terminal-panel--config">
        <header class="panel-heading">
          <div>
            <span class="panel-heading__eyebrow">Model Link</span>
            <h3>模型配置入口</h3>
          </div>
          <strong>CFG-AI</strong>
        </header>

        <div class="config-grid">
          <label class="field">
            <span>提供商</span>
            <select v-model="config.provider" class="field__control field__control--select">
              <option v-for="provider in providerOptions" :key="provider.value" :value="provider.value">
                {{ provider.label }}
              </option>
            </select>
          </label>

          <label v-if="config.provider === 'custom'" class="field">
            <span>自定义 Provider</span>
            <input v-model="config.customProvider" type="text" class="field__control"
              placeholder="例如 openrouter / local-gateway" />
          </label>

          <label class="field">
            <span>模型 ID</span>
            <input v-model="config.modelId" type="text" class="field__control"
              :placeholder="providerMeta.modelPlaceholder" />
          </label>

          <label class="field">
            <span>API Base URL</span>
            <input v-model="config.apiBaseUrl" type="text" class="field__control"
              :placeholder="providerMeta.basePlaceholder" />
          </label>

          <label class="field field--full">
            <span>API Key</span>
            <input v-model="config.apiKey" type="password" class="field__control"
              :placeholder="providerMeta.apiKeyPlaceholder" />
          </label>
        </div>

        <div class="config-hint">
          <span>ROUTE</span>
          <p>{{ providerMeta.description }}</p>
        </div>

        <div class="config-actions">
          <button type="button" class="terminal-btn terminal-btn--primary" @click="saveConfig">
            保存链路设置
          </button>
          <button type="button" class="terminal-btn" @click="restoreDefaults">
            恢复默认协议
          </button>
        </div>

        <div class="prompt-block">
          <div class="prompt-block__header">
            <div>
              <span class="panel-heading__eyebrow">Role Protocol</span>
              <h4>内置舰桥 Prompt</h4>
            </div>
            <button type="button" class="terminal-btn terminal-btn--ghost" @click="resetPrompt">
              重置 Prompt
            </button>
          </div>

          <textarea v-model="config.systemPrompt" class="prompt-block__editor" rows="12" spellcheck="false"></textarea>
        </div>
      </section>

      <section class="terminal-panel terminal-panel--chat">
        <header class="panel-heading">
          <div>
            <span class="panel-heading__eyebrow">Conversation Deck</span>
            <h3>{{ ROLE_LABEL }} 在线值守</h3>
          </div>
          <div class="chat-actions">
            <strong>{{ statusText(linkState.status) }}</strong>
            <button type="button" class="terminal-btn terminal-btn--ghost" @click="clearConversation">
              清空上下文
            </button>
          </div>
        </header>

        <div ref="messageLog" class="message-log">
          <div v-if="messages.length === 0" class="message-log__empty">
            <span>AEGIS</span>
            <h4>舰桥智能 AI 已待命</h4>
            <p>可以直接询问模块配置、故障排查、代码实现策略，或让它协助你调整整套星舰终端。</p>
          </div>

          <article v-for="(message, index) in messages" :key="`${message.timestamp}-${index}`" class="message-card"
            :class="`message-card--${message.role}`">
            <div class="message-card__meta">
              <span class="message-badge">{{ message.role === 'user' ? 'USR' : ROLE_LABEL }}</span>
              <small>{{ formatTime(message.timestamp) }}</small>
            </div>
            <div class="message-card__body">
              <MaMarkdown v-if="message.role === 'assistant'" :value="message.content" mode="preview"
                class="message-markdown" />
              <p v-else>{{ message.content }}</p>
            </div>
            <div v-if="message.role === 'assistant' && message.content" class="message-card__actions">
              <button type="button" class="copy-btn" @click="copyMessage(message.content)">
                copy
              </button>
            </div>
          </article>

          <article v-if="loading" class="message-card message-card--assistant message-card--typing">
            <div class="message-card__meta">
              <span class="message-badge">{{ ROLE_LABEL }}</span>
              <small>STREAM</small>
            </div>
            <div class="typing-line">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </article>
        </div>

        <div class="composer">
          <textarea v-model="draft" class="composer__input" rows="4" spellcheck="false"
            placeholder="输入指令。Enter 发送，Shift+Enter 换行。" @keydown="handleComposerKeydown"></textarea>

          <div class="composer__footer">
            <div class="composer__summary">
              <span>{{ providerDisplay }}</span>
              <span>{{ effectiveModelId || 'MODEL UNBOUND' }}</span>
              <span>{{ ROLE_ID }}</span>
            </div>

            <button type="button" class="terminal-btn terminal-btn--primary" :disabled="loading || !draft.trim()"
              @click="sendMessage">
              {{ loading ? '链路传输中' : '发送到舰桥 AI' }}
            </button>
          </div>

          <p v-if="error" class="composer__error">{{ error }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MaMarkdown } from '@components/index';
import { storage } from '@/stores';
import { STARSHIP_STATUS_TEXT, type StarshipStatus } from './starshipModules';
import { loadAIConfig, saveAIConfig } from '@/utils/ai-config';

type ProviderMode = 'deepseek' | 'openai' | 'anthropic' | 'google' | 'custom';

interface TerminalConfig {
  provider: ProviderMode;
  customProvider: string;
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
  systemPrompt: string;
}

interface PersistedConfig {
  provider?: string;
  customProvider?: string;
  modelId?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  systemPrompt?: string;
}

interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const ROLE_ID = 'bridge_aegis_terminal';
const ROLE_LABEL = 'AEGIS';
const CONVERSATION_STORAGE_KEY = `shared_chat_history_${ROLE_ID}`;
const STANDARD_PROVIDERS = ['deepseek', 'openai', 'anthropic', 'google'] as const;

const BUILTIN_SYSTEM_PROMPT = `你是 MRIA-07 星舰指挥终端的智能 AI，代号 AEGIS。
你的职责是作为舰桥辅助中枢，协助用户完成模块诊断、配置决策、故障排查、数据解释与操作建议。
请遵循以下规则：
1. 语气保持冷静、精确、简洁，像舰桥系统终端，而不是普通聊天助手。
2. 优先给出可执行结论和操作步骤，避免空泛表述。
3. 如果信息不足，明确指出缺失项，并给出最小补充请求。
4. 对配置、代码、接口、浏览器扩展相关问题，默认以资深工程师方式回答。
5. 不编造仓库中不存在的事实；涉及不确定内容时必须说明是假设。
6. 当用户要求设计或文案时，保持科幻终端和 HUD 风格，但仍以可落地实现为优先。`;

const providerOptions = [
  { value: 'deepseek', label: 'DeepSeek Built-in' },
  { value: 'openai', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'custom', label: 'Custom Gateway' },
] as const;

const providerCatalog: Record<ProviderMode, {
  label: string;
  baseUrl: string;
  modelPlaceholder: string;
  basePlaceholder: string;
  apiKeyPlaceholder: string;
  description: string;
}> = {
  deepseek: {
    label: 'DeepSeek Built-in',
    baseUrl: '',
    modelPlaceholder: 'deepseek-chat',
    basePlaceholder: '内置链路无需填写',
    apiKeyPlaceholder: '内置链路无需填写',
    description: '使用扩展内置的 DeepSeek 会话链路，适合直接启用舰桥 AI。',
  },
  openai: {
    label: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com/v1',
    modelPlaceholder: '输入你的 OpenAI 模型 ID',
    basePlaceholder: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...',
    description: '使用标准 Chat Completions 接口。若不填基址，将默认回落到 OpenAI 官方入口。',
  },
  anthropic: {
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    modelPlaceholder: '输入你的 Claude 模型 ID',
    basePlaceholder: 'https://api.anthropic.com/v1',
    apiKeyPlaceholder: 'sk-ant-...',
    description: '使用 Anthropic Messages 接口。模型 ID 与 API Key 都需要由你手动填写。',
  },
  google: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelPlaceholder: '输入你的 Gemini 模型 ID',
    basePlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyPlaceholder: 'AIza...',
    description: '使用 Gemini 流式接口。若不填基址，将默认回落到 Google 的 Generative Language API。',
  },
  custom: {
    label: 'Custom Gateway',
    baseUrl: '',
    modelPlaceholder: '输入你的自定义模型 ID',
    basePlaceholder: '例如 https://your-gateway.example/v1',
    apiKeyPlaceholder: '输入网关鉴权密钥',
    description: '面向 OpenAI 兼容网关或私有部署服务。需要提供自定义 Provider 名称与 Base URL。',
  },
};

const createDefaultConfig = (): TerminalConfig => ({
  provider: 'deepseek',
  customProvider: '',
  modelId: 'deepseek-chat',
  apiBaseUrl: '',
  apiKey: '',
  systemPrompt: BUILTIN_SYSTEM_PROMPT,
});

const config = ref<TerminalConfig>(createDefaultConfig());
const messages = ref<ConversationEntry[]>([]);
const draft = ref('');
const loading = ref(false);
const error = ref('');
const messageLog = ref<HTMLElement | null>(null);
const currentPort = ref<chrome.runtime.Port | null>(null);

const statusText = (status: StarshipStatus) => STARSHIP_STATUS_TEXT[status];
const canUseExtensionStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;
const canUseRuntimeConnect = () => typeof chrome !== 'undefined' && typeof chrome.runtime?.connect === 'function';
const canUseRuntimeMessaging = () => typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function';

const isStandardProvider = (provider: string): provider is typeof STANDARD_PROVIDERS[number] => {
  return (STANDARD_PROVIDERS as readonly string[]).includes(provider);
};

const providerMeta = computed(() => providerCatalog[config.value.provider]);

const resolvedProvider = computed(() => {
  return config.value.provider === 'custom'
    ? config.value.customProvider.trim()
    : config.value.provider;
});

const effectiveBaseUrl = computed(() => {
  return config.value.apiBaseUrl.trim() || providerMeta.value.baseUrl;
});

const effectiveModelId = computed(() => {
  return config.value.modelId.trim() || (resolvedProvider.value === 'deepseek' ? 'deepseek-chat' : '');
});

const providerDisplay = computed(() => {
  if (config.value.provider === 'custom') {
    return config.value.customProvider.trim() || 'CUSTOM GATEWAY';
  }
  return providerMeta.value.label;
});

const promptLineCount = computed(() => {
  return config.value.systemPrompt.split('\n').filter((line) => line.trim()).length;
});

const linkState = computed(() => {
  const provider = resolvedProvider.value;
  const modelId = effectiveModelId.value;
  const hasApiKey = config.value.apiKey.trim().length > 0;
  const hasBaseUrl = effectiveBaseUrl.value.trim().length > 0;

  if (!provider) {
    return {
      status: 'standby' as StarshipStatus,
      label: 'UNBOUND',
      detail: '等待指定模型路由',
    };
  }

  if (provider === 'deepseek') {
    return {
      status: 'online' as StarshipStatus,
      label: 'READY',
      detail: '内置 DeepSeek 链路可直接接管对话',
    };
  }

  const isCustom = !isStandardProvider(provider);
  const ready = Boolean(modelId && hasApiKey && (!isCustom || hasBaseUrl));

  if (ready) {
    return {
      status: 'online' as StarshipStatus,
      label: 'READY',
      detail: `${provider.toUpperCase()} 已完成绑定`,
    };
  }

  if (modelId || hasApiKey || hasBaseUrl || config.value.customProvider.trim()) {
    return {
      status: 'warning' as StarshipStatus,
      label: 'PARTIAL',
      detail: '链路参数不完整，发送前需补足',
    };
  }

  return {
    status: 'standby' as StarshipStatus,
    label: 'STANDBY',
    detail: '等待填写模型与鉴权信息',
  };
});

const normalizePersistedConfig = (input: PersistedConfig): TerminalConfig => {
  const next = createDefaultConfig();
  const rawProvider = typeof input.provider === 'string' ? input.provider.trim() : '';

  if (rawProvider && isStandardProvider(rawProvider)) {
    next.provider = rawProvider;
  } else if (rawProvider === 'custom') {
    next.provider = 'custom';
    next.customProvider = typeof input.customProvider === 'string' ? input.customProvider.trim() : '';
  } else if (rawProvider) {
    next.provider = 'custom';
    next.customProvider = typeof input.customProvider === 'string' && input.customProvider.trim()
      ? input.customProvider.trim()
      : rawProvider;
  }

  if (typeof input.modelId === 'string') {
    next.modelId = input.modelId;
  }
  if (typeof input.apiBaseUrl === 'string') {
    next.apiBaseUrl = input.apiBaseUrl;
  }
  if (typeof input.apiKey === 'string') {
    next.apiKey = input.apiKey;
  }
  if (typeof input.systemPrompt === 'string' && input.systemPrompt.trim()) {
    next.systemPrompt = input.systemPrompt;
  }

  return next;
};

const loadConfig = async () => {
  try {
    config.value = normalizePersistedConfig(await loadAIConfig());
  } catch (loadError) {
    maLogger.error('[AITerminalView] Failed to load config:', loadError);
    config.value = createDefaultConfig();
  }
};

const buildPersistedConfig = () => {
  const sanitizedPrompt = config.value.systemPrompt.trim() || BUILTIN_SYSTEM_PROMPT;
  const provider = config.value.provider === 'custom'
    ? config.value.customProvider.trim() || 'custom'
    : config.value.provider;

  return {
    provider,
    customProvider: config.value.customProvider.trim(),
    modelId: effectiveModelId.value,
    apiBaseUrl: config.value.apiBaseUrl.trim(),
    apiKey: config.value.apiKey.trim(),
    systemPrompt: sanitizedPrompt,
  };
};

const validateConfig = () => {
  const provider = resolvedProvider.value;
  const modelId = effectiveModelId.value;

  if (!provider) {
    return '请先指定模型提供商。';
  }

  if (!modelId && provider !== 'deepseek') {
    return '请填写模型 ID。';
  }

  if (provider !== 'deepseek' && !config.value.apiKey.trim()) {
    return '当前 Provider 需要 API Key。';
  }

  if (!isStandardProvider(provider) && !effectiveBaseUrl.value.trim()) {
    return '自定义 Provider 需要填写 API Base URL。';
  }

  return '';
};

const saveConfig = async () => {
  const validationMessage = validateConfig();
  if (validationMessage && resolvedProvider.value !== 'deepseek') {
    ElMessage.error(validationMessage);
    return;
  }

  if (!config.value.systemPrompt.trim()) {
    config.value.systemPrompt = BUILTIN_SYSTEM_PROMPT;
  }

  await saveAIConfig(buildPersistedConfig());
  ElMessage.success('AI 链路配置已写入终端。');
};

const restoreDefaults = async () => {
  try {
    await ElMessageBox.confirm('恢复默认后将重置 Provider、模型、鉴权信息与舰桥 Prompt。', '恢复默认协议', {
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
      type: 'warning',
    });

    config.value = createDefaultConfig();
    await saveAIConfig(buildPersistedConfig());
    error.value = '';
    ElMessage.success('默认协议已恢复。');
  } catch {
    // noop
  }
};

const resetPrompt = () => {
  config.value.systemPrompt = BUILTIN_SYSTEM_PROMPT;
  ElMessage.success('舰桥 Prompt 已恢复内置版本。');
};

const persistConversation = async () => {
  try {
    if (canUseExtensionStorage()) {
      await chrome.storage.local.set({
        [CONVERSATION_STORAGE_KEY]: messages.value,
      });
      return;
    }

    storage.page.local.set(CONVERSATION_STORAGE_KEY, messages.value);
  } catch (persistError) {
    maLogger.error('[AITerminalView] Failed to persist conversation:', persistError);
  }
};

const loadConversation = async () => {
  try {
    const storedData = canUseExtensionStorage()
      ? (await chrome.storage.local.get([CONVERSATION_STORAGE_KEY]))[CONVERSATION_STORAGE_KEY]
      : storage.page.local.get(CONVERSATION_STORAGE_KEY, []);
    let nextMessages: ConversationEntry[] = [];

    if (Array.isArray(storedData)) {
      nextMessages = storedData.map((entry: any) => ({
        role: entry.role === 'assistant' ? 'assistant' : 'user',
        content: String(entry.content || ''),
        timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : new Date(entry.timestamp).toISOString(),
      }));
    } else if (storedData && typeof storedData === 'object') {
      const indexes = Object.keys(storedData).map(Number).sort((a, b) => a - b);
      nextMessages = indexes.map((index) => {
        const entry = storedData[index];
        return {
          role: entry.role === 'assistant' ? 'assistant' : 'user',
          content: String(entry.content || ''),
          timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : new Date(entry.timestamp).toISOString(),
        };
      });
    }

    messages.value = nextMessages.filter((entry) => entry.content);
  } catch (loadError) {
    maLogger.error('[AITerminalView] Failed to load conversation:', loadError);
    messages.value = [];
  }
};

const disconnectPort = () => {
  if (!currentPort.value) {
    return;
  }

  currentPort.value.disconnect();
  currentPort.value = null;
};

const scrollToBottom = async () => {
  await nextTick();
  if (messageLog.value) {
    messageLog.value.scrollTop = messageLog.value.scrollHeight;
  }
};

const handleComposerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void sendMessage();
  }
};

const sendMessage = async () => {
  const content = draft.value.trim();
  if (!content || loading.value) {
    return;
  }

  const validationMessage = validateConfig();
  if (validationMessage && resolvedProvider.value !== 'deepseek') {
    error.value = validationMessage;
    ElMessage.error(validationMessage);
    return;
  }

  if (!config.value.systemPrompt.trim()) {
    config.value.systemPrompt = BUILTIN_SYSTEM_PROMPT;
  }

  error.value = '';
  const now = new Date().toISOString();
  messages.value.push({
    role: 'user',
    content,
    timestamp: now,
  });
  draft.value = '';
  await persistConversation();
  await scrollToBottom();

  const reply: ConversationEntry = {
    role: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
  };
  messages.value.push(reply);
  loading.value = true;

  if (!canUseRuntimeConnect()) {
    loading.value = false;
    error.value = '当前页面未接入扩展后台链路，AI 对话只能在扩展运行环境中使用。';
    reply.content = error.value;
    await persistConversation();
    await scrollToBottom();
    return;
  }

  const messageId = `bridge-aegis-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const port = chrome.runtime.connect({
    name: `ai-conversation-${messageId}`,
  });

  currentPort.value = port;
  let completed = false;

  port.onMessage.addListener((message: any) => {
    if (message.payload?.messageId !== messageId) {
      return;
    }

    if (message.type === 'AI_CONVERSATION_STREAM_DATA') {
      const lastMessage = messages.value[messages.value.length - 1];
      if (lastMessage?.role === 'assistant') {
        lastMessage.content += message.payload.content || '';
        void scrollToBottom();
      }
      return;
    }

    if (message.type === 'AI_CONVERSATION_COMPLETE') {
      completed = true;
      const lastMessage = messages.value[messages.value.length - 1];
      if (lastMessage?.role === 'assistant') {
        lastMessage.content = lastMessage.content.trimEnd();
      }
      loading.value = false;
      void persistConversation();
      void scrollToBottom();
      disconnectPort();
      return;
    }

    if (message.type === 'AI_CONVERSATION_ERROR') {
      completed = true;
      const detail = message.payload.error || '未知错误';
      error.value = `舰桥 AI 链路异常：${detail}`;
      const lastMessage = messages.value[messages.value.length - 1];
      if (lastMessage?.role === 'assistant' && !lastMessage.content) {
        lastMessage.content = error.value;
      }
      loading.value = false;
      void persistConversation();
      void scrollToBottom();
      disconnectPort();
    }
  });

  port.onDisconnect.addListener(() => {
    if (currentPort.value === port) {
      currentPort.value = null;
    }

    if (loading.value && !completed) {
      loading.value = false;
      error.value = '与舰桥 AI 的流式链路已断开。';
      void persistConversation();
    }
  });

  port.postMessage({
    type: 'START_AI_CONVERSATION',
    payload: {
      prompt: content,
      messageId,
      provider: resolvedProvider.value || config.value.provider,
      model: effectiveModelId.value,
      apiKey: config.value.apiKey.trim(),
      apiBaseUrl: effectiveBaseUrl.value,
      role: ROLE_ID,
      systemPrompt: config.value.systemPrompt.trim() || BUILTIN_SYSTEM_PROMPT,
    },
  });
};

const clearConversation = async () => {
  try {
    await ElMessageBox.confirm('这会清空当前 AI 终端的历史消息与 DeepSeek 上下文。', '清空上下文', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    });

    messages.value = [];
    loading.value = false;
    error.value = '';
    disconnectPort();

    if (canUseExtensionStorage()) {
      await chrome.storage.local.remove([CONVERSATION_STORAGE_KEY]);
    } else {
      storage.page.local.remove(CONVERSATION_STORAGE_KEY);
    }

    if (canUseRuntimeMessaging()) {
      chrome.runtime.sendMessage({
        type: 'CLEAR_AI_SESSION',
        payload: { role: ROLE_ID },
      });
    }

    ElMessage.success('AI 终端上下文已清空。');
  } catch {
    // noop
  }
};

const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    ElMessage.success('回复内容已复制。');
  } catch (copyError) {
    maLogger.error('[AITerminalView] Copy failed:', copyError);
    ElMessage.error('复制失败，请手动复制。');
  }
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

watch(() => config.value.provider, (nextProvider, previousProvider) => {
  const previousBase = previousProvider ? providerCatalog[previousProvider].baseUrl : '';
  const nextBase = providerCatalog[nextProvider].baseUrl;

  if (!config.value.apiBaseUrl.trim() || config.value.apiBaseUrl.trim() === previousBase) {
    config.value.apiBaseUrl = nextBase;
  }

  if (nextProvider === 'deepseek' && !config.value.modelId.trim()) {
    config.value.modelId = 'deepseek-chat';
  }
});

onMounted(async () => {
  await loadConfig();
  await loadConversation();
  await scrollToBottom();
});

onUnmounted(() => {
  disconnectPort();
});
</script>

<style scoped>
.ai-terminal {
  --ai-panel-max-height: clamp(870px, calc(100vh - 200px), 100vh);
  display: grid;
  gap: 18px;
  align-content: start;
  color: rgba(228, 245, 255, 0.92);
}

.ai-terminal__bridge,
.terminal-panel {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(108, 187, 255, 0.24);
  background:
    linear-gradient(180deg, rgba(8, 18, 32, 0.96), rgba(3, 10, 22, 0.92)),
    radial-gradient(circle at top right, rgba(111, 214, 255, 0.12), transparent 42%);
  box-shadow:
    inset 0 0 0 1px rgba(164, 222, 255, 0.08),
    0 0 28px rgba(59, 164, 229, 0.08);
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
}

.ai-terminal__bridge {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: 16px;
  padding: 20px 22px;
}

.ai-terminal__bridge::before,
.terminal-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(124, 220, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124, 220, 255, 0.05) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.2;
  pointer-events: none;
}

.bridge-copy,
.bridge-status,
.terminal-panel>* {
  position: relative;
  z-index: 1;
}

.bridge-copy__eyebrow,
.panel-heading__eyebrow {
  margin: 0;
  font: 600 11px/1.2 'JetBrains Mono', 'IBM Plex Mono', monospace;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(118, 214, 255, 0.72);
}

.bridge-copy h2,
.panel-heading h3,
.prompt-block__header h4 {
  margin: 8px 0 0;
  font-size: 28px;
  letter-spacing: 0.08em;
  color: #f2fbff;
  text-shadow: 0 0 16px rgba(98, 198, 255, 0.2);
}

.bridge-copy__subtitle {
  margin: 10px 0 0;
  max-width: 62ch;
  color: rgba(192, 221, 240, 0.82);
  line-height: 1.7;
}

.bridge-status {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.status-tile {
  display: grid;
  gap: 6px;
  padding: 14px;
  min-height: 104px;
  border: 1px solid rgba(115, 191, 255, 0.18);
  background: rgba(9, 24, 39, 0.72);
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
}

.status-tile span,
.status-tile small,
.message-card__meta small,
.composer__summary span {
  font: 500 11px/1.35 'JetBrains Mono', 'IBM Plex Mono', monospace;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.status-tile strong {
  font-size: 22px;
  letter-spacing: 0.06em;
}

.status-tile small {
  color: rgba(167, 203, 223, 0.72);
}

.status-tile[data-tone='blue'] strong {
  color: #8fdcff;
}

.status-tile[data-tone='green'] strong,
.status-tile[data-tone='online'] strong {
  color: #7ff7d3;
}

.status-tile[data-tone='warning'] strong {
  color: #ff9a7a;
}

.status-tile[data-tone='standby'] strong {
  color: #b3d8ea;
}

.ai-terminal__grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.92fr) minmax(0, 1.18fr);
  gap: 18px;
  align-items: start;
}

.terminal-panel {
  display: grid;
  gap: 18px;
  padding: 18px;
  align-content: start;
}

.terminal-panel--config {
  min-height: 760px;
  max-height: var(--ai-panel-max-height);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(126, 188, 226, 0.3) transparent;
}

.terminal-panel--config::-webkit-scrollbar {
  width: 6px;
}

.terminal-panel--config::-webkit-scrollbar-thumb {
  background: rgba(126, 188, 226, 0.22);
}

.panel-heading,
.prompt-block__header,
.chat-actions,
.composer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-heading h3,
.prompt-block__header h4 {
  font-size: 21px;
}

.panel-heading strong,
.chat-actions strong {
  font: 700 11px/1.2 'JetBrains Mono', 'IBM Plex Mono', monospace;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(129, 212, 255, 0.86);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field--full {
  grid-column: 1 / -1;
}

.field span,
.config-hint span,
.message-log__empty span {
  font: 600 11px/1.2 'JetBrains Mono', 'IBM Plex Mono', monospace;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(123, 216, 255, 0.78);
}

.config-hint p {
  font: 500 14px/1.6 'JetBrains Mono', 'IBM Plex Sans', sans-serif;
}

.field__control,
.field__control--select,
.prompt-block__editor,
.composer__input {
  width: 100%;
  border: 1px solid rgba(111, 189, 255, 0.18);
  background: rgba(4, 14, 28, 0.88);
  color: rgba(231, 247, 255, 0.94);
  font: 500 14px/1.6 'JetBrains Mono', 'IBM Plex Sans', sans-serif;
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
}

.field__control:focus,
.field__control--select:focus,
.prompt-block__editor:focus,
.composer__input:focus {
  border-color: rgba(130, 224, 255, 0.48);
  box-shadow: 0 0 0 1px rgba(130, 224, 255, 0.16), 0 0 18px rgba(86, 188, 255, 0.1);
}

.field__control--select {
  appearance: none;
}

.field__control::placeholder,
.prompt-block__editor::placeholder,
.composer__input::placeholder {
  color: rgba(143, 181, 201, 0.44);
}

.config-hint {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid rgba(102, 179, 240, 0.14);
  background: rgba(7, 20, 34, 0.56);
}

.config-hint p {
  margin: 0;
  color: rgba(189, 219, 236, 0.76);
  line-height: 1.65;
}

.config-actions,
.chat-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.terminal-btn {
  border: 1px solid rgba(119, 198, 255, 0.18);
  background: rgba(10, 24, 40, 0.74);
  color: rgba(223, 243, 255, 0.88);
  font: 600 12px/1 'JetBrains Mono', 'IBM Plex Mono', monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 11px 14px;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
}

.terminal-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(144, 221, 255, 0.34);
  box-shadow: 0 0 16px rgba(76, 182, 255, 0.12);
}

.terminal-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.terminal-btn--primary {
  background: linear-gradient(135deg, rgba(27, 92, 143, 0.86), rgba(39, 154, 211, 0.82));
  border-color: rgba(135, 224, 255, 0.34);
}

.terminal-btn--ghost {
  padding-inline: 12px;
}

.prompt-block {
  display: grid;
  gap: 12px;
}

.prompt-block__editor {
  min-height: 264px;
  resize: vertical;
}

.terminal-panel--chat {
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 760px;
  max-height: var(--ai-panel-max-height);
  overflow: hidden;
}

.message-log {
  min-height: 0;
  overflow-y: auto;
  padding-right: 6px;
  display: grid;
  align-content: start;
  gap: 12px;
}

.message-log::-webkit-scrollbar {
  width: 6px;
}

.message-log::-webkit-scrollbar-thumb {
  background: rgba(126, 188, 226, 0.22);
}

.message-log__empty {
  display: grid;
  place-items: start;
  gap: 10px;
  padding: 22px;
  border: 1px dashed rgba(117, 196, 255, 0.2);
  background: rgba(8, 19, 33, 0.62);
}

.message-log__empty h4 {
  margin: 0;
  font-size: 22px;
}

.message-log__empty p {
  margin: 0;
  max-width: 58ch;
  color: rgba(188, 220, 238, 0.78);
  line-height: 1.7;
}

.message-card {
  display: grid;
  gap: 5px;
  padding: 7px 9px;
  border: 1px solid rgba(113, 189, 255, 0.16);
  background: rgba(7, 19, 33, 0.82);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
}

.message-card--user {
  border-color: rgba(109, 176, 226, 0.22);
  background: linear-gradient(135deg, rgba(13, 31, 50, 0.86), rgba(18, 45, 72, 0.82));
}

.message-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.message-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid rgba(119, 207, 255, 0.18);
  font: 700 11px/1 'JetBrains Mono', 'IBM Plex Mono', monospace;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8edaff;
  background: rgba(10, 29, 48, 0.74);
}

.message-card__body {
  color: rgba(232, 246, 255, 0.92);
  line-height: 1.75;
}

.message-card__body p {
  margin: 0;
  white-space: pre-wrap;
  font: 400 14px/1.6 'JetBrains Mono', 'IBM Plex Sans', sans-serif;
}

.message-markdown :deep(p) {
  margin: 0 0 0.78em;
  font: 400 14px/1.6 'JetBrains Mono', 'IBM Plex Sans', sans-serif;
}

.message-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.message-card__actions {
  display: flex;
  justify-content: flex-end;
}

.copy-btn {
  border: none;
  background: transparent;
  color: rgba(132, 211, 255, 0.82);
  cursor: pointer;
  font: 600 11px/1 'JetBrains Mono', 'IBM Plex Mono', monospace;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.typing-line {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 18px;
}

.typing-line span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #88dfff;
  box-shadow: 0 0 10px rgba(136, 223, 255, 0.48);
  animation: terminalTyping 1.1s ease-in-out infinite;
}

.typing-line span:nth-child(2) {
  animation-delay: 0.14s;
}

.typing-line span:nth-child(3) {
  animation-delay: 0.28s;
}

.composer {
  display: grid;
  gap: 12px;
}

.composer__input {
  min-height: 120px;
  resize: vertical;
}

.composer__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.composer__summary span {
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  border: 1px solid rgba(112, 188, 255, 0.14);
  background: rgba(8, 20, 35, 0.66);
}

.composer__error {
  margin: 0;
  color: #ff9f8a;
  font-size: 13px;
}

@keyframes terminalTyping {

  0%,
  100% {
    transform: translateY(1px);
    opacity: 0.35;
  }

  50% {
    transform: translateY(-1px) scale(1.04);
    opacity: 1;
  }
}

@media (max-width: 1220px) {

  .ai-terminal__bridge,
  .ai-terminal__grid {
    grid-template-columns: 1fr;
  }

  .bridge-status {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ai-terminal {
    --ai-panel-max-height: clamp(760px, calc(100vh - 220px), 980px);
    min-height: 1280px;
  }
}

@media (max-width: 860px) {

  .bridge-status,
  .config-grid {
    grid-template-columns: 1fr;
  }

  .ai-terminal {
    --ai-panel-max-height: none;
    min-height: auto;
  }

  .terminal-panel {
    height: auto;
  }

  .terminal-panel--config,
  .terminal-panel--chat {
    max-height: none;
  }

  .panel-heading,
  .prompt-block__header,
  .composer__footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .chat-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
