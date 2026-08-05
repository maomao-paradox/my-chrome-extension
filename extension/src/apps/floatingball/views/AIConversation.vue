<template>
  <div class="ai-conversation">
    <div v-if="showToolbar" class="conversation-toolbar">
      <div class="toolbar-select-group">
        <label class="toolbar-select-shell">
          <span class="sr-only">Role</span>
          <select
            v-model="selectedRole"
            :disabled="loading"
            class="toolbar-select"
          >
            <option
              v-for="role in aiRoles"
              :key="role.value"
              :value="role.value"
            >
              {{ role.label }}
            </option>
          </select>
        </label>

        <label class="toolbar-select-shell">
          <span class="sr-only">Model</span>
          <select
            v-model="selectedModel"
            :disabled="loading"
            class="toolbar-select"
          >
            <option
              v-for="model in aiModels"
              :key="model.value"
              :value="model.value"
            >
              {{ model.label }}
            </option>
          </select>
        </label>
      </div>

      <button
        v-if="messages.length > 0"
        type="button"
        class="toolbar-action"
        :disabled="loading"
        title="Reset conversation"
        @click="clearConversation"
      >
        <IconDelete />
      </button>
    </div>

    <div
      ref="conversationBody"
      :class="['ai-conversation-body', { 'is-empty': messages.length === 0 }]"
      @scroll="handleScroll"
    >
      <div class="message-stream">
        <div v-if="messages.length === 0" class="welcome-state">
          <div class="welcome-signal">
            <span class="welcome-orb">{{ welcomeIcon }}</span>
            <span class="welcome-line"></span>
          </div>
          <div class="welcome-copy">
            <span class="welcome-kicker">AI CONSOLE</span>
            <h4>{{ welcomeTitle }}</h4>
            <p>{{ welcomeMessage }}</p>
          </div>
        </div>

        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="['message-item', message.role]"
        >
          <div class="message-avatar">
            {{ message.role === "user" ? userIcon : currentAssistantIcon }}
          </div>

          <div class="message-shell">
            <div class="message-text">
              <MaMarkdown
                v-if="message.role === 'assistant'"
                :value="message.content"
                mode="preview"
                class="ai-markdown-preview"
              />
              <div v-else>{{ message.content }}</div>
            </div>

            <div class="message-meta">
              <span class="message-time">{{
                formatTime(message.timestamp)
              }}</span>
              <button
                v-if="message.role === 'assistant' && message.content"
                type="button"
                class="copy-button"
                :title="copiedIndex === index ? 'Copied' : 'Copy message'"
                @click="copyMessage(message.content, index)"
              >
                {{ copiedIndex === index ? "Done" : "Copy" }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="showTypingIndicator" class="message-item assistant typing">
          <div class="message-avatar">{{ currentAssistantIcon }}</div>
          <div class="message-shell">
            <div class="typing-indicator" aria-hidden="true">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
            <div class="typing-copy">{{ typingMessage }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="ai-conversation-footer">
      <div
        :class="[
          'composer-shell',
          { 'is-focused': isInputFocused, 'has-value': !!input.trim() },
        ]"
      >
        <textarea
          ref="messageInput"
          v-model="input"
          rows="1"
          class="message-input"
          :placeholder="inputPlaceholder"
          :disabled="loading"
          @input="handleInput"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          @keydown.enter.exact="handleEnter"
        />

        <button
          type="button"
          :disabled="!input.trim() || loading"
          :class="['send-button', { 'is-visible': showSendButton, loading }]"
          @click="sendMessage"
        >
          <span class="sr-only">{{
            loading ? "Sending" : sendButtonText
          }}</span>
          <svg
            class="send-icon"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M3.5 10H16.5M10.5 4L16.5 10L10.5 16"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.6"
            />
          </svg>
        </button>
      </div>

      <div class="conversation-footnote">{{ inputHint }}</div>

      <div v-if="error" class="error-line">
        <span class="error-dot"></span>
        <span class="error-copy">{{ error }}</span>
        <button
          type="button"
          class="close-error"
          title="Dismiss"
          @click="error = ''"
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
import { MaMarkdown } from '@components/index';
import { loadAIConfig } from '@/utils/ai-config';
import { IconDelete } from '@/assets/icons';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type AiRoleOption = {
  value: string;
  label: string;
  avatar?: string;
  systemPrompt?: string;
};

const props = defineProps({
  title: {
    type: String,
    default: 'AI 助手'
  },
  welcomeTitle: {
    type: String,
    default: '开始一段临床级问答'
  },
  welcomeMessage: {
    type: String,
    default: '输入病例、数据问题或工作流需求，AI 将在当前面板中连续响应。'
  },
  welcomeIcon: {
    type: String,
    default: 'AI'
  },
  userIcon: {
    type: String,
    default: 'YOU'
  },
  aiIcon: {
    type: String,
    default: 'AI'
  },
  typingMessage: {
    type: String,
    default: 'Generating response...'
  },
  inputPlaceholder: {
    type: String,
    default: 'Ask about radiotherapy workflows, metrics, or current records...'
  },
  sendButtonText: {
    type: String,
    default: 'Send'
  },
  inputHint: {
    type: String,
    default: 'Enter to send. Shift + Enter for a new line.'
  },
  defaultRole: {
    type: String,
    default: ''
  },
  systemPrompt: {
    type: String,
    default: ''
  },
  showToolbar: {
    type: Boolean,
    default: true
  },
  roleOptions: {
    type: Array as PropType<AiRoleOption[]>,
    default: () => [
      { value: '', label: 'AI Assistant' },
      { value: 'Fuka Shikuzaki', label: 'Fuka Shikuzaki', avatar: 'FS' }
    ]
  }
});

const emit = defineEmits([
  'messageSent',
  'messageReceived',
  'error',
  'conversationCleared'
]);

const aiModels = [{ value: 'deepseek', label: 'DeepSeek' }];
const aiRoles = computed(() => props.roleOptions);

const input = ref('');
const messages = ref<ChatMessage[]>([]);
const loading = ref(false);
const error = ref('');
const conversationBody = ref<HTMLElement | null>(null);
const messageInput = ref<HTMLTextAreaElement | null>(null);
const selectedModel = ref('deepseek');
const selectedRole = ref(props.defaultRole);
const copiedIndex = ref<number | null>(null);
const autoScrollEnabled = ref(true);
const isInputFocused = ref(false);
const currentMessageId = ref('');
const currentPort = ref<chrome.runtime.Port | null>(null);

const currentRoleOption = computed(() =>
  aiRoles.value.find((role) => role.value === selectedRole.value)
);
const currentAssistantIcon = computed(
  () => currentRoleOption.value?.avatar || props.aiIcon
);
const currentSystemPrompt = computed(
  () => currentRoleOption.value?.systemPrompt || props.systemPrompt
);
const showSendButton = computed(
  () => isInputFocused.value || !!input.value.trim() || loading.value
);
const showTypingIndicator = computed(() => {
  if (!loading.value) {
    return false;
  }

  const lastMessage = messages.value[messages.value.length - 1];
  return (
    !lastMessage ||
    lastMessage.role !== 'assistant' ||
    !lastMessage.content.trim()
  );
});

let historySaveTimer: number | null = null;
let scrollAnimationFrame: number | null = null;

const clearHistorySaveTimer = () => {
  if (historySaveTimer !== null) {
    window.clearTimeout(historySaveTimer);
    historySaveTimer = null;
  }
};

const clearScrollAnimation = () => {
  if (scrollAnimationFrame !== null) {
    cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
  }
};

const resizeMessageInput = () => {
  nextTick(() => {
    const inputElement = messageInput.value;
    if (!inputElement) {
      return;
    }

    inputElement.style.height = '0px';
    const nextHeight = Math.min(Math.max(inputElement.scrollHeight, 32), 108);
    inputElement.style.height = `${nextHeight}px`;
  });
};

const scheduleScrollToBottom = (behavior: ScrollBehavior = 'auto') => {
  nextTick(() => {
    if (!conversationBody.value || !autoScrollEnabled.value) {
      return;
    }

    clearScrollAnimation();
    scrollAnimationFrame = requestAnimationFrame(() => {
      conversationBody.value?.scrollTo({
        top: conversationBody.value.scrollHeight,
        behavior
      });
      scrollAnimationFrame = null;
    });
  });
};

const scheduleHistorySave = (delay = 240) => {
  clearHistorySaveTimer();

  if (!messages.value.length) {
    return;
  }

  historySaveTimer = window.setTimeout(() => {
    historySaveTimer = null;
    void saveChatHistory();
  }, delay);
};

const flushHistorySave = () => {
  clearHistorySaveTimer();

  if (messages.value.length > 0) {
    void saveChatHistory();
  }
};

const getStorageKey = () => {
  const roleKey = selectedRole.value || 'default_ai_assistant';
  return `shared_chat_history_${roleKey}`;
};

const normalizeTimestamp = (timestamp: unknown) => {
  const parsedTimestamp =
    timestamp instanceof Date ? timestamp : new Date(timestamp as string);
  return Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;
};

const normalizeStoredMessages = (storedData: unknown): ChatMessage[] => {
  if (!storedData) {
    return [];
  }

  const source = Array.isArray(storedData)
    ? storedData
    : typeof storedData === 'object'
      ? Object.keys(storedData as Record<string, unknown>)
        .map(Number)
        .sort((left, right) => left - right)
        .map((key) => (storedData as Record<number, any>)[key])
      : [];

  return source
    .filter(
      (message) =>
        message && (message.role === 'user' || message.role === 'assistant')
    )
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: typeof message.content === 'string' ? message.content : '',
      timestamp: normalizeTimestamp(message.timestamp)
    }));
};

const disconnectCurrentPort = () => {
  if (!currentPort.value) {
    return;
  }

  try {
    currentPort.value.disconnect();
  } catch (disconnectError) {
    maLogger.warn(
      'Failed to disconnect AI conversation port:',
      disconnectError
    );
  } finally {
    currentPort.value = null;
  }
};

async function loadChatHistory() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    messages.value = [];
    return;
  }

  try {
    const storageKey = getStorageKey();
    const result = await chrome.storage.local.get([storageKey]);
    messages.value = normalizeStoredMessages(result[storageKey]);
    autoScrollEnabled.value = true;
    scheduleScrollToBottom('auto');
  } catch (loadError) {
    maLogger.error('Error loading AI conversation history:', loadError);
    messages.value = [];
  }
}

async function saveChatHistory() {
  if (
    typeof chrome === 'undefined' ||
    !chrome.storage?.local ||
    messages.value.length === 0
  ) {
    return;
  }

  try {
    const storageKey = getStorageKey();
    const payload = {
      [storageKey]: messages.value.map((message) => ({
        ...message,
        timestamp: normalizeTimestamp(message.timestamp).toISOString()
      }))
    };

    await chrome.storage.local.set(payload);
  } catch (saveError) {
    maLogger.error('Error saving AI conversation history:', saveError);
  }
}

const formatTime = (timestamp: Date) => {
  const date = normalizeTimestamp(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const isAtBottom = () => {
  if (!conversationBody.value) {
    return false;
  }

  const { scrollTop, scrollHeight, clientHeight } = conversationBody.value;
  return scrollHeight - scrollTop - clientHeight < 12;
};

const handleScroll = () => {
  autoScrollEnabled.value = isAtBottom();
};

const handleInput = () => {
  if (error.value) {
    error.value = '';
  }

  resizeMessageInput();
};

const handleInputFocus = () => {
  isInputFocused.value = true;
};

const handleInputBlur = () => {
  isInputFocused.value = false;
};

const handleEnter = (event: KeyboardEvent) => {
  if (event.isComposing) {
    return;
  }

  event.preventDefault();
  void sendMessage();
};

const sendMessage = async () => {
  const text = input.value.trim();
  if (!text || loading.value) {
    return;
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
    error.value = 'AI service is unavailable in the current runtime.';
    return;
  }

  error.value = '';
  autoScrollEnabled.value = true;

  messages.value.push({
    role: 'user',
    content: text,
    timestamp: new Date()
  });
  scheduleHistorySave(80);

  input.value = '';
  resizeMessageInput();
  scheduleScrollToBottom('smooth');
  emit('messageSent', text);

  try {
    loading.value = true;
    const assistantMessageIndex =
      messages.value.push({
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }) - 1;

    currentMessageId.value = `ai-conversation-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    disconnectCurrentPort();

    const port = chrome.runtime.connect({
      name: `ai-conversation-${currentMessageId.value}`
    });
    currentPort.value = port;

    let streamSettled = false;
    const settleStream = (options?: {
      trimEnd?: boolean;
      errorMessage?: string;
      disconnectPort?: boolean;
    }) => {
      if (streamSettled) {
        return;
      }

      streamSettled = true;

      if (options?.trimEnd && messages.value[assistantMessageIndex]) {
        messages.value[assistantMessageIndex].content =
          messages.value[assistantMessageIndex].content.trimEnd();
      }

      if (options?.errorMessage) {
        error.value = options.errorMessage;
        if (messages.value[assistantMessageIndex]) {
          messages.value[assistantMessageIndex].content = options.errorMessage;
        }
      }

      loading.value = false;
      currentMessageId.value = '';

      if (currentPort.value === port) {
        currentPort.value = null;
      }

      scheduleScrollToBottom('auto');
      flushHistorySave();

      if (options?.disconnectPort !== false) {
        try {
          port.disconnect();
        } catch (disconnectError) {
          maLogger.warn(
            'Failed to disconnect settled AI conversation port:',
            disconnectError
          );
        }
      }
    };

    port.onMessage.addListener((message: any) => {
      if (message.payload?.messageId !== currentMessageId.value) {
        return;
      }

      if (message.type === 'AI_CONVERSATION_STREAM_DATA') {
        if (messages.value[assistantMessageIndex]) {
          messages.value[assistantMessageIndex].content +=
            message.payload.content || '';
        }
        scheduleHistorySave(320);
        scheduleScrollToBottom('auto');
        emit(
          'messageReceived',
          messages.value[assistantMessageIndex]?.content || ''
        );
        return;
      }

      if (message.type === 'AI_CONVERSATION_COMPLETE') {
        settleStream({ trimEnd: true });
        return;
      }

      if (message.type === 'AI_CONVERSATION_ERROR') {
        emit('error', message.payload.error);
        settleStream({
          errorMessage: `Sorry, something went wrong: ${message.payload.error}`
        });
      }
    });

    port.onDisconnect.addListener(() => {
      if (streamSettled) {
        return;
      }

      settleStream({
        errorMessage: 'Connection to the background service was interrupted.',
        disconnectPort: false
      });
    });

    const config = await loadAIConfig();

    port.postMessage({
      type: 'START_AI_CONVERSATION',
      payload: {
        prompt: text,
        messageId: currentMessageId.value,
        provider: config.provider,
        model: config.modelId,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        role: selectedRole.value,
        systemPrompt: currentSystemPrompt.value
      }
    });
  } catch (sendError: any) {
    maLogger.error('Error sending AI conversation message:', sendError);
    loading.value = false;
    currentMessageId.value = '';
    disconnectCurrentPort();

    if (messages.value.length > 0) {
      messages.value.pop();
    }

    const fallbackMessage = 'Sorry, the AI service is temporarily unavailable.';
    error.value = fallbackMessage;
    messages.value.push({
      role: 'assistant',
      content: fallbackMessage,
      timestamp: new Date()
    });

    flushHistorySave();
    scheduleScrollToBottom('auto');
    emit('error', sendError?.message || fallbackMessage);
  }
};

const clearConversation = async () => {
  disconnectCurrentPort();
  loading.value = false;
  currentMessageId.value = '';
  input.value = '';
  error.value = '';
  copiedIndex.value = null;
  clearHistorySaveTimer();

  try {
    messages.value = [];
    resizeMessageInput();

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove([getStorageKey()]);
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'CLEAR_AI_SESSION',
        payload: {
          role: selectedRole.value
        }
      });
    }

    emit('conversationCleared');
  } catch (clearError) {
    maLogger.error('Error clearing AI conversation:', clearError);
    error.value = 'Unable to clear the current conversation.';
  }
};

const copyMessage = async (content: string, index: number) => {
  try {
    await navigator.clipboard.writeText(content);
    copiedIndex.value = index;

    window.setTimeout(() => {
      if (copiedIndex.value === index) {
        copiedIndex.value = null;
      }
    }, 1600);
  } catch (copyError) {
    maLogger.error('Failed to copy AI conversation message:', copyError);
  }
};

watch(selectedRole, async (newRole, oldRole) => {
  if (newRole === oldRole) {
    return;
  }

  disconnectCurrentPort();
  loading.value = false;
  currentMessageId.value = '';
  error.value = '';
  copiedIndex.value = null;
  clearHistorySaveTimer();

  await loadChatHistory();
});

onMounted(async () => {
  await loadChatHistory();
  resizeMessageInput();
});

onUnmounted(() => {
  clearHistorySaveTimer();
  clearScrollAnimation();
  flushHistorySave();
  disconnectCurrentPort();
});
</script>

<style scoped>
.ai-conversation {
  --conversation-text-strong: rgba(248, 251, 255, 0.94);
  --conversation-text-soft: rgba(255, 255, 255, 0.6);
  --conversation-text-faint: rgba(255, 255, 255, 0.36);
  --conversation-accent: #52a9ff;
  --conversation-accent-soft: rgba(82, 169, 255, 0.18);
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  color: var(--conversation-text-strong);
  background: transparent;
  font-family: "SF Pro Text", "SF Pro Display", "Inter", "Segoe UI", sans-serif;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.conversation-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 1px 2px 6px;
}

.toolbar-select-group {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.toolbar-select-shell {
  position: relative;
  display: inline-flex;
  min-width: 0;
}

.toolbar-select-shell::after {
  content: "";
  position: absolute;
  top: 50%;
  right: 9px;
  width: 5px;
  height: 5px;
  border-right: 1px solid rgba(255, 255, 255, 0.42);
  border-bottom: 1px solid rgba(255, 255, 255, 0.42);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.toolbar-select {
  min-width: 102px;
  min-height: 24px;
  padding: 0 24px 0 8px;
  border: none;
  border-radius: 999px;
  appearance: none;
  background: rgba(255, 255, 255, 0.035);
  color: var(--conversation-text-soft);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  outline: none;
  cursor: pointer;
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.08);
  transition:
    color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}

.toolbar-select:hover:not(:disabled),
.toolbar-select:focus {
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.05);
  box-shadow:
    inset 0 0 0 0.5px rgba(82, 169, 255, 0.22),
    0 0 0 3px rgba(82, 169, 255, 0.08);
}

.toolbar-select:disabled {
  opacity: 0.52;
  cursor: not-allowed;
}

.toolbar-action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 26px;
  padding: 2px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--conversation-text-faint);
  cursor: pointer;
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.08);
  transition:
    color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    opacity 180ms ease;
}

.toolbar-action:hover:not(:disabled),
.toolbar-action:focus-visible {
  color: rgba(255, 215, 219, 0.96);
  background: rgba(255, 106, 121, 0.08);
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 106, 121, 0.16),
    0 10px 24px rgba(0, 0, 0, 0.14);
}

.toolbar-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-action-label {
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  margin-right: 0;
  white-space: nowrap;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition:
    max-width 220ms ease,
    opacity 180ms ease,
    margin-right 220ms ease;
}

.toolbar-action:hover .toolbar-action-label,
.toolbar-action:focus-visible .toolbar-action-label {
  max-width: 50px;
  opacity: 1;
  margin-right: 6px;
}

.toolbar-action-icon {
  width: 22px;
  height: 22px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.08);
}

.ai-conversation-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 2px 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}

.ai-conversation-body.is-empty {
  display: flex;
  align-items: center;
}

.message-stream {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 8px;
}

.welcome-state {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 380px;
  padding: 2px 1px 8px;
}

.welcome-signal {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.welcome-orb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background:
    linear-gradient(145deg, rgba(82, 169, 255, 0.14), rgba(82, 169, 255, 0.04)),
    rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
    0 20px 46px rgba(8, 16, 27, 0.28);
}

.welcome-line {
  width: 48px;
  height: 1px;
  margin-left: 10px;
  background: linear-gradient(
    90deg,
    rgba(82, 169, 255, 0.48),
    rgba(255, 255, 255, 0)
  );
}

.welcome-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.welcome-kicker {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.24em;
  color: rgba(255, 255, 255, 0.4);
}

.welcome-copy h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.18;
  letter-spacing: -0.01em;
}

.welcome-copy p {
  margin: 0;
  color: var(--conversation-text-soft);
  font-size: 12px;
  line-height: 1.5;
}

.message-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  animation: message-slide-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  margin-top: 1px;
  border-radius: 9px;
  background:
    linear-gradient(
      145deg,
      rgba(82, 169, 255, 0.14),
      rgba(255, 255, 255, 0.03)
    ),
    rgba(255, 255, 255, 0.025);
  color: rgba(255, 255, 255, 0.88);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
    0 10px 26px rgba(4, 9, 16, 0.22);
}

.message-item.user .message-avatar {
  background:
    linear-gradient(145deg, rgba(82, 169, 255, 0.2), rgba(82, 169, 255, 0.08)),
    rgba(255, 255, 255, 0.025);
  color: #eff8ff;
}

.message-shell {
  display: flex;
  max-width: min(84%, 720px);
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.message-item.user .message-shell {
  align-items: flex-end;
}

.message-text {
  padding: 7px 10px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
  color: rgba(248, 251, 255, 0.88);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.045),
      rgba(255, 255, 255, 0.018)
    ),
    rgba(255, 255, 255, 0.02);
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.05),
    0 12px 30px rgba(4, 9, 16, 0.2);
  user-select: text;
  -webkit-user-select: text;
}

.message-item.assistant .message-text {
  border-bottom-left-radius: 5px;
}

.message-item.user .message-text {
  color: rgba(247, 251, 255, 0.96);
  background:
    linear-gradient(135deg, rgba(82, 169, 255, 0.16), rgba(82, 169, 255, 0.08)),
    rgba(255, 255, 255, 0.018);
  border-bottom-right-radius: 5px;
  box-shadow:
    inset 0 0 0 0.5px rgba(82, 169, 255, 0.16),
    0 14px 32px rgba(11, 63, 116, 0.18);
}

.ai-markdown-preview {
  width: 100%;
  height: 100%;
}

:deep(.preview-only) {
  width: 100%;
  height: 100%;
}

:deep(.preview-content) {
  padding: 0;
  height: auto;
  max-height: none;
  overflow: visible;
  color: inherit;
  background: transparent;
}

:deep(.preview-content p) {
  margin: 4px 0 3px;
}

:deep(.preview-content p:first-child) {
  margin-top: 0;
}

:deep(.preview-content p:last-child) {
  margin-bottom: 0;
}

:deep(.preview-content pre) {
  background: rgba(8, 14, 26, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

:deep(.preview-content code) {
  background: rgba(255, 255, 255, 0.08);
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
}

.message-item.user .message-meta {
  justify-content: flex-end;
}

.message-time {
  color: var(--conversation-text-faint);
  font-size: 9px;
  letter-spacing: 0.06em;
}

.copy-button {
  border: none;
  padding: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.42);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0;
  transform: translateY(2px);
  cursor: pointer;
  transition:
    color 180ms ease,
    opacity 180ms ease,
    transform 180ms ease;
}

.message-item:hover .copy-button,
.message-item:focus-within .copy-button {
  opacity: 1;
  transform: translateY(0);
}

.copy-button:hover,
.copy-button:focus-visible {
  color: rgba(255, 255, 255, 0.82);
}

.typing {
  align-items: center;
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.typing-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(82, 169, 255, 0.9);
  box-shadow: 0 0 10px rgba(82, 169, 255, 0.36);
  animation: typing-pulse 1.25s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.18s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.36s;
}

.typing-copy {
  color: var(--conversation-text-soft);
  font-size: 11px;
  line-height: 1.4;
}

.ai-conversation-footer {
  padding: 8px 2px 1px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.composer-shell {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-height: 32px;
  transition: transform 180ms ease;
}

.composer-shell.is-focused {
  transform: translateY(-1px);
}

.message-input {
  width: 100%;
  min-height: 32px;
  max-height: 108px;
  padding: 0;
  border: none;
  resize: none;
  background: transparent;
  color: var(--conversation-text-strong);
  font-size: 12px;
  line-height: 1.45;
  outline: none;
}

.message-input::placeholder {
  color: rgba(255, 255, 255, 0.34);
}

.message-input:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border: none;
  border-radius: 999px;
  background: rgba(82, 169, 255, 0.08);
  color: var(--conversation-accent);
  cursor: pointer;
  box-shadow: inset 0 0 0 0.5px rgba(82, 169, 255, 0.2);
  opacity: 0;
  transform: translateX(6px);
  pointer-events: none;
  transition:
    opacity 180ms ease,
    transform 220ms ease,
    color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}

.send-button.is-visible {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.send-button:hover:not(:disabled),
.send-button:focus-visible {
  color: #e6f5ff;
  background: rgba(82, 169, 255, 0.14);
  box-shadow:
    inset 0 0 0 0.5px rgba(82, 169, 255, 0.3),
    0 10px 24px rgba(11, 63, 116, 0.2);
}

.send-button:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}

.send-button.loading .send-icon {
  animation: send-spin 1s linear infinite;
}

.send-icon {
  width: 12px;
  height: 12px;
}

.conversation-footnote {
  padding-top: 3px;
  color: var(--conversation-text-faint);
  font-size: 9px;
  letter-spacing: 0.04em;
}

.error-line {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 4px;
  color: rgba(255, 196, 200, 0.92);
  font-size: 10px;
  line-height: 1.45;
}

.error-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 999px;
  background: rgba(255, 120, 132, 0.9);
  box-shadow: 0 0 10px rgba(255, 120, 132, 0.3);
}

.error-copy {
  min-width: 0;
}

.close-error {
  margin-left: auto;
  border: none;
  padding: 0;
  background: transparent;
  color: rgba(255, 215, 219, 0.78);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.close-error:hover,
.close-error:focus-visible {
  color: rgba(255, 235, 238, 0.96);
}

.ai-conversation-body::-webkit-scrollbar {
  width: 6px;
}

.ai-conversation-body::-webkit-scrollbar-track {
  background: transparent;
}

.ai-conversation-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
}

.ai-conversation-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.24);
}

@keyframes message-slide-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes typing-pulse {
  0%,
  60%,
  100% {
    opacity: 0.45;
    transform: scale(0.78);
  }

  30% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes send-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .welcome-state {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .welcome-line {
    width: 32px;
  }

  .message-shell {
    max-width: 90%;
  }
}

@media (max-width: 480px) {
  .conversation-toolbar {
    gap: 8px;
    padding-right: 0;
  }

  .toolbar-select {
    min-width: 92px;
  }

  .message-shell {
    max-width: 94%;
  }

  .message-text {
    padding: 7px 9px;
    font-size: 11px;
  }

  .message-avatar {
    width: 24px;
    height: 24px;
    flex-basis: 24px;
    font-size: 8px;
  }
}
</style>
