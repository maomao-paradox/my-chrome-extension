<template>
  <div ref="chatWindowRef" class="ai-chat-window" :class="{ 'show': isVisible }">
    <!-- 聊天消息列表 -->
    <div class="chat-messages">
      <!-- 系统消息：提示用户AI解释功能 -->
      <div class="message system-message">
        <div class="message-content">
          <span>AI解释功能已启动，请输入您的问题或直接查看解释：</span>
        </div>
      </div>
      
      <!-- 用户消息 -->
      <div v-for="(message, index) in messages" :key="index" 
           class="message" :class="{ 'user-message': message.isUser, 'ai-message': !message.isUser }">
        <div class="message-content">
          <span>{{ message.content }}</span>
          <span v-if="message.isLoading" class="loading-indicator">加载中...</span>
        </div>
      </div>
      
      <!-- 初始AI请求：选中文本的解释 -->
      <div v-if="initialText" class="message ai-message">
        <div class="message-content">
          <span>正在为您解释："{{ initialText }}"</span>
          <span class="loading-indicator">加载中...</span>
        </div>
      </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-area">
      <input 
        ref="inputRef" 
        v-model="inputMessage" 
        type="text" 
        placeholder="输入您的问题..." 
        @keyup.enter="sendMessage"
      >
      <button @click="sendMessage" class="send-btn">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

// 组件props
const props = defineProps<{
  // 是否可见
  isVisible: boolean;
  // 初始文本（选中文本）
  initialText?: string;
}>()

// 组件事件
const emit = defineEmits<{
  // 关闭事件
  (e: 'close'): void;
  // 发送消息事件
  (e: 'sendMessage', message: string): void;
}>()

// 聊天窗口引用
const chatWindowRef = ref<HTMLElement | null>(null)
// 输入框引用
const inputRef = ref<HTMLInputElement | null>(null)
// 消息列表
const messages = ref<Array<{ 
  content: string;
  isUser: boolean;
  isLoading?: boolean;
}>>([])
// 输入消息
const inputMessage = ref('')

// 监听可见性变化，自动聚焦输入框
watch(() => props.isVisible, (newValue) => {
  if (newValue) {
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
})

// 发送消息
const sendMessage = () => {
  const message = inputMessage.value.trim();
  if (!message) return;
  
  // 添加用户消息到列表
  messages.value.push({
    content: message,
    isUser: true
  });
  
  // 清空输入框
  inputMessage.value = '';
  
  // 添加AI回复的加载状态
  messages.value.push({
    content: '',
    isUser: false,
    isLoading: true
  });
  
  // 触发发送消息事件
  emit('sendMessage', message);
}

// 接收AI回复
const receiveAIResponse = (response: string) => {
  // 更新最后一条消息为AI回复
  if (messages.value.length > 0) {
    const lastMessage = messages.value[messages.value.length - 1];
    if (!lastMessage.isUser && lastMessage.isLoading) {
      lastMessage.content = response;
      lastMessage.isLoading = false;
    } else {
      // 如果没有加载中的消息，直接添加新消息
      messages.value.push({
        content: response,
        isUser: false
      });
    }
  }
}

// 关闭聊天窗口
const closeChatWindow = () => {
  emit('close');
}

// 暴露方法给父组件
defineExpose({
  receiveAIResponse,
  closeChatWindow
});
</script>

<style scoped>
.ai-chat-window {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  min-height: 200px;
  max-height: 400px;
  background: var(--scifi-bg-secondary) !important;
  border: 1px solid var(--scifi-border-color);
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px var(--scifi-glow-color), 0 0 0 1px var(--scifi-border-color);
  z-index: 999998;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

.ai-chat-window.show {
  opacity: 1;
  transform: translateY(0);
}

/* 科幻风格装饰线条 */
.ai-chat-window::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--scifi-accent-primary), transparent);
  animation: scifiScanline 3s linear infinite;
}

/* 聊天消息列表 */
.chat-messages {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: var(--scifi-bg-primary);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--scifi-accent-primary);
  border-radius: 3px;
}

/* 消息样式 */
.message {
  display: flex;
  margin-bottom: 8px;
  animation: fadeIn 0.3s ease;
}

.message-content {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
  position: relative;
}

/* 系统消息 */
.system-message .message-content {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: var(--scifi-text-primary);
  font-style: italic;
}

/* 用户消息 */
.user-message {
  justify-content: flex-end;
}

.user-message .message-content {
  background: linear-gradient(135deg, var(--scifi-bg-primary), var(--scifi-bg-secondary));
  border: 1px solid var(--scifi-border-color);
  color: var(--scifi-text-primary);
  border-radius: 8px 0 8px 8px;
}

/* AI消息 */
.ai-message .message-content {
  background: linear-gradient(135deg, var(--scifi-bg-secondary), var(--scifi-accent-primary));
  border: 1px solid var(--scifi-accent-primary);
  color: var(--scifi-text-primary);
  border-radius: 0 8px 8px 8px;
}

/* 输入区域 */
.input-area {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: var(--scifi-bg-secondary) !important;
  border-top: 1px solid var(--scifi-border-color);
}

.input-area input {
  flex: 1;
  padding: 8px 12px;
  background: var(--scifi-bg-primary);
  border: 1px solid var(--scifi-border-color);
  border-radius: 6px;
  color: var(--scifi-text-primary);
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.input-area input:focus {
  border-color: var(--scifi-accent-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.send-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--scifi-bg-primary), var(--scifi-bg-secondary));
  border: 1px solid var(--scifi-border-color);
  border-radius: 6px;
  color: var(--scifi-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.send-btn:hover {
  background: linear-gradient(135deg, var(--scifi-bg-secondary), var(--scifi-accent-primary));
  border-color: var(--scifi-accent-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--scifi-glow-color), 0 0 0 1px var(--scifi-accent-primary);
}

.send-btn:active {
  transform: translateY(0);
  box-shadow: 0 0 0 1px var(--scifi-accent-primary);
}

/* 加载指示器 */
.loading-indicator {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: var(--scifi-accent-primary);
  animation: pulse 1s infinite;
}

/* 动画效果 */
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

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes scifiScanline {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}
</style>