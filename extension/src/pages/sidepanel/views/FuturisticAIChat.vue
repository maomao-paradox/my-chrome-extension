<template>
    <div class="ai-chat-container">
        <!-- 聊天记录区域 -->
        <div ref="chatMessages" class="chat-messages">
            <!-- 顶部操作栏 -->
            <div v-if="messages.length > 0" class="chat-header-actions">
                <button class="clear-conversation-btn" :disabled="isTyping" title="清空对话" @click="clearConversation">
                    🗑️ 清空对话
                </button>
            </div>
            <!-- 系统欢迎消息 - 只有在没有历史消息时显示 -->
            <div v-if="messages.length === 0" class="message system-message">
                <div class="message-content">
                    <p>👋 欢迎使用AI助手！我可以帮你解答问题、提供建议或协助你完成任务。</p>
                    <p class="tip">提示：你可以问我任何问题，例如："如何优化我的网站性能？"或"帮我总结这段内容。"</p>
                </div>
            </div>

            <!-- 聊天消息列表 -->
            <div v-for="(msg, index) in messages" :key="index"
                :class="['message', msg.role === 'user' ? 'user-message' : 'ai-message']">
                <template v-if="msg.role !== 'system'">
                    <div class="message-avatar"> {{ msg.role === 'user' ? '👤' : roleAvatars[selectedRole] }} </div>
                    <div class="message-content">
                        <!-- 消息文本内容（带背景框） -->
                        <div class="message-text-container">
                            <!-- AI消息使用Markdown渲染 -->
                            <div v-if="msg.role === 'assistant'" class="message-text ai-text">
                                <MaMarkdown :value="msg.content" mode="preview" class="ai-markdown-preview" />
                            </div>
                            <!-- 用户消息直接显示 -->
                            <div v-else class="message-text user-text">
                                {{ msg.content }}
                            </div>
                        </div>
                        <!-- 消息元信息（时间戳和复制按钮） -->
                        <div class="message-meta">
                            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
                            <button v-if="msg.role === 'assistant' && msg.content" class="copy-button"
                                title="复制消息" @click="copyMessage(msg.content)">
                                {{ copiedIndex === index ? '✓' : '📋' }}
                            </button>
                        </div>
                    </div>
                </template>
            </div>

        </div>

        <!-- 正在输入指示器 -->
        <div v-if="isTyping" class="message ai-message">
            <div class="message-avatar">{{ roleAvatars[selectedRole] }}</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="error-message">
            <span class="error-icon">⚠️</span>
            {{ error }}
            <button class="close-error" @click="error = ''">×</button>
        </div>
    </div>

    <!-- 输入区域 -->
    <div class="footer">
        <div class="model-select-container">
            <!-- 角色选择下拉 -->
            <select v-model="selectedRole" :disabled="isTyping" class="model-select">
                <option value="">{{ selectedRole ?? 'AI助手' }}</option>
                <option v-for="role in aiRoles" :key="role.value" :value="role.value">
                    {{ role.label }}
                </option>
            </select>
            <!-- 模型选择下拉 -->
            <select v-model="selectedModel" :disabled="isTyping" class="model-select">
                <option v-for="model in aiModels" :key="model.value" :value="model.value">
                    {{ model.label }}
                </option>
            </select>
        </div>
        <div class="chat-input-area">
            <!-- AI模型选择 -->
            <textarea v-model="inputMessage" class="message-input" placeholder="请输入你的问题或指令..."
                rows="3" @keydown.enter.exact="sendMessage" @keydown.enter.shift="handleShiftEnter"></textarea>
            <div class="input-actions">
                <button class="btn-attach" @click="showToast('附件功能即将上线', 'info')">
                    附件
                </button>
                <button class="btn-send" :disabled="!inputMessage.trim() || isTyping" @click="sendMessage">
                    <span v-if="isTyping" class="loading-dots">...</span>
                    {{ isTyping ? '发送中' : '发送' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import messenger from '@/message';
import {MaMarkdown} from '@components/index';

const aiModels = [
  { value: 'deepseek', label: 'DeepSeek' }
  // 未来可以添加更多模型
];

// 可用的AI角色列表
const aiRoles = [
  { value: '', label: 'AI助手' },
  { value: 'Fuka Shikuzaki', label: 'Fuka Shikuzaki' }
];

// AI角色头像映射
const roleAvatars: Record<string, string> = {
  '': '🤖', // 默认AI助手
  'Fuka Shikuzaki': '👧' // Fuka Shikuzaki角色
};

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

// 聊天消息列表
const messages = ref<ChatMessage[]>([]);

// 当前输入消息
const inputMessage = ref('');
// 是否正在输入
const isTyping = ref(false);
// 聊天记录区域引用
const chatMessages = ref<HTMLElement | null>(null);
// 错误消息
const error = ref('');
// 当前消息ID
const currentMessageId = ref<string>('');
// 当前端口连接
const currentPort = ref<any>(null);
// 复制成功的消息索引
const copiedIndex = ref<number | null>(null);
// 选中的AI模型
const selectedModel = ref('deepseek'); // 默认选择deepseek模型
// 选中的AI角色
const selectedRole = ref(''); // 默认无角色

// 对话持久化相关函数
// 获取当前角色对应的存储键
function getStorageKey(): string {
  // 为AI助手角色生成一个默认存储键，确保所有角色都能保存和加载对话历史
  const roleKey = selectedRole.value || 'default_ai_assistant';
  // 所有角色使用相同的存储键命名规则，实现上下文互通
  return `shared_chat_history_${roleKey}`;
}

// 读取 ExtensionToolPrompt.md 文件
async function loadExtensionToolPrompt(): Promise<string> {
  try {
    // 获取静态文件的 URL
    const promptUrl = chrome.runtime.getURL('ExtensionToolPrompt.md');
    // 使用 fetch 读取文件内容
    const response = await fetch(promptUrl);
    if (!response.ok) {
      maLogger.error('Failed to load ExtensionToolPrompt.md');
      return '';
    }
    return await response.text();
  } catch (error) {
    maLogger.error('Error loading ExtensionToolPrompt.md:', error);
    return '';
  }
}

// 添加系统提示词到消息列表
async function addSystemPrompt(): Promise<void> {
  const promptContent = await loadExtensionToolPrompt();
  if (promptContent) {
    messages.value.unshift({
      role: 'system',
      content: promptContent,
      timestamp: new Date()
    });
    maLogger.log('System prompt added successfully');
  }
}

// 从浏览器存储加载历史对话
async function loadChatHistory(): Promise<void> {
  try {
    const storageKey = getStorageKey();
    // 所有角色都使用相同的逻辑，不再区分AI助手和其他角色
    // 确保所有角色都能正常加载和保存对话历史
    maLogger.log('Loading chat history for role:', selectedRole.value);

    maLogger.log('Attempting to load chat history for role:', selectedRole.value);
    const result = await chrome.storage.local.get([storageKey]);
    maLogger.log('Storage result:', result);

    let loadedMessages: Array<{ role: 'user' | 'assistant' | 'system', content: string, timestamp: Date }> = [];

    if (result[storageKey]) {
      const storedData = result[storageKey];

      if (Array.isArray(storedData)) {
        // 正常数组格式
        loadedMessages = storedData.map((msg: any) => ({
          ...msg,
          role: msg.role as 'user' | 'assistant' | 'system',
          timestamp: new Date(msg.timestamp)
        }));
      } else if (typeof storedData === 'object') {
        // 对象格式（数字键），转换为数组
        maLogger.log('Found object format history, converting to array...');
        // 获取所有键并按数字排序
        const keys = Object.keys(storedData).map(Number).sort((a, b) => a - b);
        // 转换为数组
        loadedMessages = keys.map(key => {
          const msg = storedData[key];
          return {
            ...msg,
            role: msg.role as 'user' | 'assistant' | 'system',
            timestamp: new Date(msg.timestamp)
          };
        });
      }
    }

    if (loadedMessages.length > 0) {
      messages.value = loadedMessages;
      maLogger.log('Loaded chat history from storage:', messages.value.length, 'messages');
      maLogger.log('Loaded messages:', messages.value);
    } else {
      // 没有历史消息，先清空当前消息列表，然后添加系统提示词
      messages.value = [];
      maLogger.log('No chat history found for role:', selectedRole.value);
      // 添加系统提示词到新会话
      await addSystemPrompt();
    }
  } catch (error) {
    maLogger.error('Error loading chat history:', error);
    messages.value = [];
    // 添加系统提示词到新会话（即使加载失败也提供提示词）
    await addSystemPrompt();
  }
}

// 保存对话历史到浏览器存储
async function saveChatHistory(): Promise<void> {
  try {
    // 只保存用户和助手的消息，不保存系统提示词
    const userMessages = messages.value.filter(msg => msg.role !== 'system');

    // 如果没有可保存的消息，直接跳过
    if (userMessages.length === 0) {
      maLogger.log('No user messages to save, skipping...');
      return;
    }

    const storageKey = getStorageKey();
    if (!storageKey) {
      // AI助手角色 - 不保存对话历史
      maLogger.log('AI assistant role selected, not saving chat history');
      return;
    }

    maLogger.log('Saving chat history for role:', selectedRole.value);
    maLogger.log('Messages to save:', userMessages);

    // 准备保存的数据，确保timestamp是ISO字符串格式
    const messagesToSave = userMessages.map(msg => {
      let timestampStr: string;

      try {
        if (msg.timestamp instanceof Date) {
          // 如果是Date对象，转换为ISO字符串
          timestampStr = msg.timestamp.toISOString();
        } else if (typeof msg.timestamp === 'string') {
          // 如果已经是字符串，直接使用
          timestampStr = msg.timestamp;
        } else {
          // 其他情况，尝试转换为Date对象后再转换为字符串
          const dateObj = new Date(msg.timestamp);
          if (isNaN(dateObj.getTime())) {
            // 如果转换失败，使用当前时间
            timestampStr = new Date().toISOString();
          } else {
            timestampStr = dateObj.toISOString();
          }
        }
      } catch (error) {
        // 捕获所有错误，使用当前时间作为fallback
        maLogger.warn('Invalid timestamp, using current time:', msg.timestamp, error);
        timestampStr = new Date().toISOString();
      }

      return {
        ...msg,
        timestamp: timestampStr
      };
    });

    const saveData = {
      [storageKey]: messagesToSave
    };
    await chrome.storage.local.set(saveData);
    maLogger.log('Saved chat history to storage:', userMessages.length, 'messages');
  } catch (error) {
    maLogger.error('Error saving chat history:', error);
  }
}

/**
 * 清空当前角色的聊天会话
 */
async function clearConversation(): Promise<void> {
  try {
    // 1. 清空当前消息列表
    messages.value = [];
    error.value = '';

    // 2. 删除浏览器存储中当前角色的对话历史
    const storageKey = getStorageKey();
    maLogger.log('Clearing chat history for role:', selectedRole.value);
    await chrome.storage.local.remove([storageKey]);

    // 3. 通知后台清除当前角色的sessionID，重新申请新的sessionID
    // 向后台发送清除会话请求
    chrome.runtime.sendMessage({
      type: 'CLEAR_AI_SESSION',
      payload: {
        role: selectedRole.value
      }
    });

    // 4. 添加系统提示词到新会话
    await addSystemPrompt();

    maLogger.log('Chat session cleared successfully for role:', selectedRole.value);
  } catch (error: any) {
    maLogger.error('Error clearing chat session:', error);
    error.value = '清空会话失败，请稍后重试';
  }
}

// 监听角色变化，加载对应角色的对话历史
watch(selectedRole, async (newRole, oldRole) => {
  if (newRole !== oldRole) {
    maLogger.log('Role changed from', oldRole, 'to', newRole);
    maLogger.log('Starting to load chat history for new role...');

    // 显示加载状态
    isTyping.value = true;

    try {
      // 加载新角色的对话历史
      await loadChatHistory();
      maLogger.log('Chat history loaded successfully for role:', newRole);
    } catch (error) {
      maLogger.error('Error loading chat history when role changed:', error);
      // 如果加载失败，清空消息
      messages.value = [];
    } finally {
      // 无论加载结果如何，都关闭加载状态
      isTyping.value = false;
    }
  }
});

// 监听messages变化，自动保存对话历史
watch(messages, () => {
  saveChatHistory().catch(maLogger.error);
}, { deep: true });

/**
 * 发送消息到AI
 */
async function sendMessage(): Promise<void> {
  const content = inputMessage.value.trim();
  if (!content || isTyping.value) {return;}

  // 添加用户消息到列表
  messages.value.push({
    role: 'user',
    content,
    timestamp: new Date()
  });

  // 清空输入框
  inputMessage.value = '';

  // 滚动到底部
  await scrollToBottom();

  // 显示正在输入状态
  isTyping.value = true;
  error.value = '';

  try {
    // 先占位，之后逐字填充
    const reply = {
      role: 'assistant' as const,
      content: '',
      timestamp: new Date()
    };
    messages.value.push(reply);

    // 生成唯一消息ID
    const messageId = `ai-conversation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentMessageId.value = messageId;

    // 建立与后台的端口连接
    const port = chrome.runtime.connect({
      name: `ai-conversation-${messageId}`
    });
    currentPort.value = port;

    // 监听端口消息
    port.onMessage.addListener((message: any) => {
      if (message.type === 'AI_CONVERSATION_STREAM_DATA' && message.payload?.messageId === messageId) {
        const messageIndex = messages.value.length - 1;
        if (messageIndex >= 0) {
          messages.value[messageIndex].content += message.payload.content;
          scrollToBottom();
        }
      } else if (message.type === 'AI_CONVERSATION_COMPLETE' && message.payload?.messageId === messageId) {
        // 完成时的处理 - 修剪消息末尾的空白字符，解决空行问题
        const messageIndex = messages.value.length - 1;
        if (messageIndex >= 0) {
          // 修剪消息内容末尾的空白字符（包括换行符、空格等）
          messages.value[messageIndex].content = messages.value[messageIndex].content.trimEnd();
        }
        isTyping.value = false;
        scrollToBottom();
        // 清理端口
        port.disconnect();
        currentPort.value = null;
      } else if (message.type === 'AI_CONVERSATION_ERROR' && message.payload?.messageId === messageId) {
        // 错误处理
        const errorMsg = `抱歉，处理您的请求时出错：${message.payload.error}`;
        error.value = errorMsg;
        const messageIndex = messages.value.length - 1;
        if (messageIndex >= 0) {
          messages.value[messageIndex].content = errorMsg;
        }
        isTyping.value = false;
        scrollToBottom();
        // 清理端口
        port.disconnect();
        currentPort.value = null;
      }
    });

    // 监听端口断开
    port.onDisconnect.addListener(() => {
      maLogger.log('与后台的端口连接已断开');
      currentPort.value = null;
      if (isTyping.value) {
        isTyping.value = false;
        error.value = '与后台的连接已断开';
      }
    });

    // 向后台发送请求
    port.postMessage({
      type: 'START_AI_CONVERSATION',
      payload: {
        prompt: content,
        messageId: messageId,
        model: selectedModel.value,
        role: selectedRole.value,
        messages: messages.value.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }
    });

    maLogger.log('发送消息成功，已建立端口连接:', messageId);
  } catch (err: any) {
    maLogger.error('发送消息失败:', err);
    const errorMsg = '抱歉，暂时无法为您提供服务，请稍后重试。';
    error.value = errorMsg;
    // 移除占位消息
    if (messages.value.length > 0) {
      messages.value.pop();
    }
    // 添加错误消息
    messages.value.push({
      role: 'assistant',
      content: errorMsg,
      timestamp: new Date()
    });
    isTyping.value = false;
    scrollToBottom();
  }
}

/**
 * 处理Shift+Enter组合键（换行）
 */
function handleShiftEnter(event: KeyboardEvent): void {
  // 让浏览器默认处理Shift+Enter（即添加换行符）
}

/**
 * 滚动聊天记录到底部
 */
async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (chatMessages.value) {
    chatMessages.value.scrollTop = chatMessages.value.scrollHeight;
  }
}

/**
 * 格式化时间
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 显示提示框
 */
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000): void {
  // 创建提示框元素
  const toast = document.createElement('div');
  toast.className = `toast show ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // 定时移除
  setTimeout(() => {
    toast.className = 'toast';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, duration);
}

/**
 * 复制消息
 */
async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    // 显示复制成功状态
    const currentIndex = messages.value.findIndex(msg => msg.content === content && msg.role === 'assistant');
    if (currentIndex !== -1) {
      copiedIndex.value = currentIndex;
      setTimeout(() => {
        copiedIndex.value = null;
      }, 2000);
    }
  } catch (err) {
    maLogger.error('复制失败:', err);
    showToast('复制失败，请手动复制', 'error');
  }
}

/**
 * 设置消息监听器
 */
const setupMessageListener = () => {
  // 使用项目的messenger系统监听消息
  messenger.ext.listen((message: any, sender: any, sendResponse: any) => {
    if (message.type === 'AI_CONVERSATION_STREAM_DATA' && message.payload?.messageId === currentMessageId.value) {
      const messageIndex = messages.value.length - 1;
      if (messageIndex >= 0) {
        messages.value[messageIndex].content += message.payload.content;
        scrollToBottom();
      }
    } else if (message.type === 'AI_CONVERSATION_COMPLETE' && message.payload?.messageId === currentMessageId.value) {
      // 完成时的处理
      scrollToBottom();
      isTyping.value = false;
    } else if (message.type === 'AI_CONVERSATION_ERROR' && message.payload?.messageId === currentMessageId.value) {
      // 错误处理
      const errorMsg = `抱歉，处理您的请求时出错：${message.payload.error}`;
      error.value = errorMsg;
      const messageIndex = messages.value.length - 1;
      if (messageIndex >= 0) {
        messages.value[messageIndex].content = errorMsg;
      }
      scrollToBottom();
      isTyping.value = false;
    }
    return true; // 保持消息通道开放
  });
};

/**
 * 组件挂载时初始化
 */
onMounted(async () => {
  // 加载历史对话
  maLogger.log('Component mounted, loading chat history...');
  await loadChatHistory();
  // 加载完成后滚动到底部
  maLogger.log('Chat history loaded, scrolling to bottom...');
  await nextTick();
  scrollToBottom();
  // 设置消息监听器
  setupMessageListener();
  maLogger.log('Component initialization completed');
});

/**
 * 组件卸载时清理
 */
onUnmounted(() => {
  // 清理端口连接
  if (currentPort.value) {
    currentPort.value.disconnect();
    currentPort.value = null;
  }
  // 项目的messenger系统会自动处理监听器清理
});
</script>

<style scoped>
/* CSS变量定义 - 科技感主题 */
:root {
    /* 主色调 - 科技蓝 */
    --primary-color: #165DFF;
    --primary-light: #4080FF;
    --primary-dark: #0E42D2;

    /* 渐变色 */
    --gradient-primary: linear-gradient(135deg, #165DFF 0%, #4080FF 100%);
    --gradient-secondary: linear-gradient(135deg, #0D1117 0%, #161B22 100%);
    --gradient-card: linear-gradient(135deg, rgba(22, 93, 255, 0.05) 0%, rgba(64, 128, 255, 0.1) 100%);

    /* 背景色 */
    --bg-primary: #0D1117;
    --bg-secondary: #161B22;
    --bg-card: rgba(22, 27, 34, 0.8);
    --bg-hover: rgba(22, 93, 255, 0.1);

    /* 文本色 */
    --text-primary: #E6EDF3;
    --text-secondary: #8B949E;
    --text-tertiary: #484F58;

    /* 边框和分隔线 */
    --border-color: #30363D;
    --border-light: rgba(48, 54, 61, 0.5);

    /* 阴影 */
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

    /* 发光效果 */
    --glow-primary: 0 0 8px rgba(22, 93, 255, 0.5);
    --glow-secondary: 0 0 12px rgba(64, 128, 255, 0.3);

    /* 动画时间 */
    --transition-fast: 0.2s ease;
    --transition-normal: 0.3s ease;
    --transition-slow: 0.5s ease;
}

.chat-header-actions {
    display: flex;
    justify-content: flex-end;
    padding: 8px 16px;
    margin-bottom: 8px;
}

.clear-conversation-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(239, 68, 68, 0.1);
    color: #EF4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.clear-conversation-btn:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.clear-conversation-btn:active:not(:disabled) {
    transform: translateY(0);
}

.clear-conversation-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.ai-chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--gradient-secondary);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
}

.chat-messages {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    scroll-behavior: smooth;
    background: var(--bg-primary);
}

/* 科技感滚动条 */
.chat-messages::-webkit-scrollbar {
    width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
    background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
    transition: background var(--transition-fast);
}

.chat-messages::-webkit-scrollbar-thumb:hover {
    background: var(--primary-light);
    box-shadow: var(--glow-primary);
}

.message {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
    animation: fadeIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.system-message {
    justify-content: center;
    margin: 24px 0;
}

.system-message .message-content {
    background: rgba(22, 93, 255, 0.1);
    border: 1px solid rgba(64, 128, 255, 0.3);
    color: var(--primary-light);
    padding: 16px 20px;
    border-radius: 12px;
    max-width: 80%;
    text-align: center;
    backdrop-filter: blur(8px);
    box-shadow: var(--shadow-sm);
}

.system-message .tip {
    margin-top: 10px;
    font-size: 13px;
    color: var(--primary-light);
    opacity: 0.8;
}

.message-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    margin-bottom: 8px;
}

.message-avatar:hover {
    transform: scale(1.05);
    box-shadow: var(--shadow-md);
}

.user-message {
    align-items: flex-end;
}

.user-message .message-avatar {
    background: var(--gradient-primary);
    border: none;
}

.message-content {
    display: flex;
    flex-direction: column;
    max-width: 85%;
    width: 100%;
}

/* 消息文本样式 - 带背景框 */
.message-text {
    background: var(--bg-card);
    padding: 14px 18px;
    border-radius: 16px 16px 16px 4px;
    word-wrap: break-word;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-light);
    backdrop-filter: blur(8px);
    transition: box-shadow var(--transition-fast);
    line-height: 1.5;
}

/* 用户消息样式 */
.user-message .message-text {
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: 16px 16px 4px 16px;
}

/* 悬停效果 */
.message-text:hover {
    box-shadow: var(--shadow-md);
}

/* 消息元信息样式 */
.message-meta {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 12px;
    margin-top: 6px;
    opacity: 0.7;
    font-size: 12px;
    color: var(--text-secondary);
}

/* 用户消息的元信息右对齐 */
.user-message .message-meta {
    justify-content: flex-end;
}

/* 时间戳样式 */
.message-time {
    font-size: 11px;
}

.user-message .message-time {
    color: rgba(255, 255, 255, 0.7);
}

.typing-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 0;
}

.typing-indicator span {
    width: 8px;
    height: 8px;
    background-color: var(--primary-light);
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out;
    box-shadow: var(--glow-primary);
}

.typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {

    0%,
    60%,
    100% {
        transform: scale(0.8);
        opacity: 0.3;
    }

    30% {
        transform: scale(1);
        opacity: 1;
    }
}

.chat-input-area {
    flex: 1;
    padding: 20px 20px 20px 0;
    background: transparent;
    border-top: none;
}

.message-input {
    width: 100%;
    padding: 14px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    resize: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    background: rgba(22, 27, 34, 0.8);
    color: var(--text-primary);
    transition: all var(--transition-normal);
    backdrop-filter: blur(8px);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.message-input:focus {
    outline: none;
    border-color: var(--primary-light);
    box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.message-input::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
}

.input-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
    gap: 12px;
}

.btn-attach,
.btn-send {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all var(--transition-normal);
    display: flex;
    align-items: center;
    gap: 6px;
}

.btn-attach {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
}

.btn-attach:hover {
    background: var(--bg-hover);
    border-color: var(--primary-light);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.btn-send {
    background: var(--gradient-primary);
    color: white;
    box-shadow: var(--shadow-sm);
}

.btn-send:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md), var(--glow-primary);
}

.btn-send:active:not(:disabled) {
    transform: translateY(0);
}

.btn-send:disabled {
    background: var(--bg-card);
    color: var(--text-secondary);
    cursor: not-allowed;
    opacity: 0.6;
}

/* 全局Toast样式 - 科技感 */
.toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 14px 24px;
    border-radius: 10px;
    color: white;
    font-size: 14px;
    z-index: 9999;
    opacity: 0;
    transition: all var(--transition-normal);
    pointer-events: none;
    max-width: 80%;
    text-align: center;
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.toast.show {
    opacity: 1;
    transform: translate(-50%, -50%) translateY(-20px);
}

.toast.success {
    background: linear-gradient(135deg, rgba(103, 194, 58, 0.9) 0%, rgba(86, 167, 46, 0.9) 100%);
    box-shadow: 0 0 12px rgba(103, 194, 58, 0.4);
}

.toast.error {
    background: linear-gradient(135deg, rgba(245, 108, 108, 0.9) 0%, rgba(229, 89, 89, 0.9) 100%);
    box-shadow: 0 0 12px rgba(245, 108, 108, 0.4);
}

.toast.info {
    background: linear-gradient(135deg, rgba(22, 93, 255, 0.9) 0%, rgba(64, 128, 255, 0.9) 100%);
    box-shadow: var(--glow-primary), var(--shadow-lg);
}

/* AI模型选择样式 */
.model-select-container {
    flex-shrink: 0;
    margin: 0;
    padding: 20px 0 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.model-select {
    width: 120px;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: rgba(22, 27, 34, 0.8);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    backdrop-filter: blur(8px);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    outline: none;
    min-height: 32px;
}

.model-select:hover:not(:disabled) {
    border-color: var(--primary-light);
    box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.1);
    background: rgba(22, 27, 34, 0.9);
}

.model-select:focus {
    border-color: var(--primary-light);
    box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.model-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: rgba(22, 27, 34, 0.5);
    border-color: var(--border-color);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.model-select option {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: none;
    padding: 8px 12px;
}

.model-select option:hover {
    background: var(--bg-hover);
}

/* 消息内容样式 */
.ai-message-content,
.user-message-content {
    margin-bottom: 6px;
    line-height: 1.5;
    word-break: break-word;
    white-space: pre-wrap;
}

.user-message-content {
    color: white;
}

/* AI消息Markdown预览样式 */
.ai-markdown-preview {
    width: 100%;
    height: 100%;
}

/* 确保MaMarkdown组件样式正确应用 */
:deep(.preview-only) {
    width: 100%;
    height: 100%;
}

:deep(.preview-content) {
    padding: 0;
    height: auto;
    max-height: none;
    overflow: visible;
    background: transparent;
    color: var(--text-primary);
}

:deep(.preview-content h1),
:deep(.preview-content h2),
:deep(.preview-content h3),
:deep(.preview-content h4),
:deep(.preview-content h5),
:deep(.preview-content h6) {
    color: var(--text-primary);
    margin-top: 16px;
    margin-bottom: 8px;
}

:deep(.preview-content p) {
    margin: 6px 0 4px 0;
}

/* 修复AI回复末尾空行问题：移除最后一个段落的下外边距 */
:deep(.preview-content p:last-child) {
    margin-bottom: 0;
}

:deep(.preview-content a) {
    color: var(--primary-light);
    text-decoration: underline;
    transition: color var(--transition-fast);
}

:deep(.preview-content a:hover) {
    color: var(--primary-color);
}

:deep(.preview-content code) {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.9em;
}

:deep(.preview-content pre) {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
    border: 1px solid var(--border-color);
}

:deep(.preview-content pre code) {
    background: transparent;
    padding: 0;
    border-radius: 0;
}

:deep(.preview-content ul),
:deep(.preview-content ol) {
    margin: 8px 0;
    padding-left: 24px;
}

:deep(.preview-content li) {
    margin: 4px 0;
}

/* 复制按钮样式 */
.copy-button {
    padding: 2px 6px;
    border: none;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.2);
    cursor: pointer;
    font-size: 10px;
    transition: all var(--transition-fast);
    opacity: 0.7;
    color: var(--text-secondary);
    margin-left: 0;
}

.user-message .copy-button {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
}

.copy-button:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.3);
    color: var(--text-primary);
}

.user-message .copy-button:hover {
    color: white;
}

.message-text {
    padding: 12px 16px;
    border-radius: 18px;
    line-height: 1.5;
    word-break: break-word;
    white-space: pre-wrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
}

/* 错误提示样式 */
.error-message {
    margin: 12px 20px;
    padding: 12px 16px;
    background: rgba(255, 73, 73, 0.1);
    border: 1px solid rgba(255, 73, 73, 0.3);
    border-radius: 8px;
    color: #ff4949;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: fadeIn 0.3s ease;
    backdrop-filter: blur(8px);
}

.footer {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
}

.error-icon {
    font-size: 14px;
}

.close-error {
    margin-left: auto;
    padding: 2px 6px;
    border: none;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.2);
    color: #ff4949;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    transition: all var(--transition-normal);
}

.close-error:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
}

/* 加载点样式 */
.loading-dots {
    display: inline-block;
    animation: loadingDots 1.5s infinite ease-in-out;
}

@keyframes loadingDots {

    0%,
    20% {
        opacity: 0.3;
    }

    50% {
        opacity: 1;
    }

    80%,
    100% {
        opacity: 0.3;
    }
}

/* 增强科技感的动画效果 */
.message-content,
.chat-input-area,
.btn-attach,
.btn-send {
    animation: subtleGlow 4s infinite alternate;
}

.message-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
    margin-left: 16px;
    margin-right: 16px;
}

@keyframes subtleGlow {
    0% {
        box-shadow: inherit;
    }

    100% {
        box-shadow: inherit, 0 0 12px rgba(22, 93, 255, 0.1);
    }
}
</style>