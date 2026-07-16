<template>
  <div class="mcp-dialog">
    <!-- 对话历史 -->
    <div ref="historyRef" class="dialog-history">
      <div v-for="(item, index) in conversationHistory" :key="index" :class="['message-item', item.role]">
        <div class="message-avatar">
          {{ item.role === 'user' ? '👤' : '🤖' }}
        </div>
        <div class="message-content">
          <div class="message-text">{{ item.content }}</div>
          <div v-if="item.result" class="message-result">
            <div class="result-label">执行结果：</div>
            <div class="result-content" :class="item.result.success ? 'success' : 'error'">
              {{ item.result.success ? item.result.result : item.result.error }}
            </div>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-item">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="loading-text">AI正在思考...</div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <el-input v-model="inputMessage" type="textarea" :rows="2" placeholder="请输入您想要执行的操作，例如：点击页面右上角的登录按钮" resize="none"
        @keyup.enter.native="handleSend" />
      <div class="input-actions">
        <el-button type="primary" :disabled="!inputMessage.trim() || loading" @click="handleSend">
          发送
        </el-button>
        <el-button @click="handleClear">清空</el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { completeChatFlow } from '@/service-worker/deepseek';
import { mcpContext } from './mcp-context';
import { generateMultiTurnPrompt } from './mcp-prompt';
import { parseMCPCommand } from './mcp-parser';
import { executeMCPCommand } from './mcp-executor';

// 对话历史项类型
interface ConversationItem {
  role: 'user' | 'assistant';
  content: string;
  result?: any;
}

// 响应式数据
const conversationHistory = ref<ConversationItem[]>([]);
const inputMessage = ref('');
const loading = ref(false);
const historyRef = ref<HTMLElement | null>(null);

// 从上下文加载历史记录
onMounted(() => {
  mcpContext.loadFromStorage();
  const history = mcpContext.getHistory();
  conversationHistory.value = history.map(item => ({
    role: item.role as 'user' | 'assistant',
    content: item.content
  }));
  scrollToBottom();
});

// 监听对话历史变化，自动滚动到底部
watch(conversationHistory, () => {
  scrollToBottom();
}, { deep: true });

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (historyRef.value) {
      historyRef.value.scrollTop = historyRef.value.scrollHeight;
    }
  });
}

// 处理发送消息
async function handleSend() {
  const message = inputMessage.value.trim();
  if (!message || loading.value) {return;}

  // 添加用户消息到历史记录
  const userItem: ConversationItem = {
    role: 'user',
    content: message
  };
  conversationHistory.value.push(userItem);
  mcpContext.addItem('user', message);
  mcpContext.saveToStorage();

  inputMessage.value = '';
  loading.value = true;

  try {
    // 生成AI提示词
    const formattedHistory = mcpContext.getFormattedHistory();
    const prompt = generateMultiTurnPrompt(formattedHistory, message);

    // 调用AI生成指令
    let assistantResponse = '';
    const assistantItem: ConversationItem = {
      role: 'assistant',
      content: ''
    };
    conversationHistory.value.push(assistantItem);

    // 使用流式响应
    await completeChatFlow(
      prompt,
      'mcp-assistant',
      {
        onData: (data: string) => {
          assistantResponse += data;
          assistantItem.content = assistantResponse;
        },
        onComplete: async () => {
          loading.value = false;

          // 添加助手响应到上下文
          mcpContext.addItem('assistant', assistantResponse);
          mcpContext.saveToStorage();

          // 解析并执行指令
          const parseResult = parseMCPCommand(assistantResponse);
          if (parseResult.success && parseResult.command) {
            // 执行指令
            const executeResult = await executeMCPCommand(parseResult.command);
            assistantItem.result = executeResult;
          } else {
            // 解析失败
            assistantItem.result = {
              success: false,
              error: parseResult.error || '指令解析失败'
            };
          }
        },
        onError: (error: any) => {
          loading.value = false;
          maLogger.error('AI调用失败:', error);

          assistantItem.content = 'AI调用失败，请稍后重试';
          assistantItem.result = {
            success: false,
            error: error.message || 'AI调用失败'
          };

          mcpContext.addItem('assistant', assistantItem.content);
          mcpContext.saveToStorage();
        }
      }
    );
  } catch (error) {
    loading.value = false;
    maLogger.error('发送消息失败:', error);

    const errorItem: ConversationItem = {
      role: 'assistant',
      content: '发送消息失败，请稍后重试',
      result: {
        success: false,
        error: error instanceof Error ? error.message : '发送消息失败'
      }
    };
    conversationHistory.value.push(errorItem);
    mcpContext.addItem('assistant', errorItem.content);
    mcpContext.saveToStorage();
  }
}

// 处理清空历史
function handleClear() {
  conversationHistory.value = [];
  mcpContext.clearHistory();
  mcpContext.saveToStorage();
}
</script>

<style scoped>
.mcp-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.dialog-history {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #1e1e1e;
}

.dialog-history::-webkit-scrollbar {
  width: 8px;
}

.dialog-history::-webkit-scrollbar-track {
  background: #2d2d2d;
  border-radius: 4px;
}

.dialog-history::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.dialog-history::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.message-item {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  margin: 0 8px;
}

.message-content {
  flex: 1;
  max-width: 80%;
}

.message-text {
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}

.message-item.user .message-text {
  background-color: #409eff;
  color: #fff;
  border-bottom-right-radius: 6px;
}

.message-item.assistant .message-text {
  background-color: #333;
  color: #fff;
  border-bottom-left-radius: 6px;
}

.message-result {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 12px;
}

.result-label {
  color: #aaa;
  margin-bottom: 4px;
}

.result-content {
  padding: 6px 10px;
  border-radius: 4px;
  font-family: monospace;
}

.result-content.success {
  background-color: rgba(64, 158, 255, 0.2);
  color: #409eff;
}

.result-content.error {
  background-color: rgba(255, 73, 73, 0.2);
  color: #ff4949;
}

.loading-item {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;
}

.loading-text {
  padding: 12px 16px;
  background-color: #333;
  color: #fff;
  border-radius: 18px;
  border-bottom-left-radius: 6px;
  font-size: 14px;
  line-height: 1.5;
}

.input-area {
  padding: 16px;
  background-color: #2d2d2d;
  border-top: 1px solid #444;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .message-content {
    max-width: 90%;
  }
}
</style>