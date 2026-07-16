<template>
  <div class="browser-var-inspector">
    <div class="header">
      <h2>JS调试工具</h2>
      <p class="description">实时查看和修改页面中的JS变量</p>
    </div>

    <div class="input-section">
      <label for="variablePath">变量路径:</label>
      <div class="input-group">
        <input id="variablePath" v-model="variablePath" type="text"
          placeholder="例如: window.document.title 或 appState.user" class="variable-input" @keydown.enter="getVariable" />
        <button class="get-btn" @click="getVariable">获取变量</button>
      </div>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <span>正在获取变量...</span>
    </div>

    <div v-else-if="error" class="error">
      <span class="error-icon">⚠️</span>
      <span>{{ error }}</span>
      <button class="retry-btn" @click="getVariable">重试</button>
    </div>

    <div v-else-if="variableData !== null" class="result-section">
      <div class="result-header">
        <span class="variable-type">{{ variableType }}</span>
        <button class="refresh-btn" @click="refreshVariable">刷新</button>
      </div>

      <!-- 可编辑文本区域 -->
      <div class="edit-section">
        <textarea v-model="variableString" class="variable-textarea" placeholder="在这里编辑变量值..."
          @blur="updateVariableFromText"></textarea>
        <button class="update-btn" @click="updateVariableFromText">更新变量</button>
      </div>

      <!-- 格式化的变量展示 -->
      <div v-if="isJson" class="formatted-result">
        <div class="json-tree" v-html="formattedJson"></div>
      </div>
      <div v-else class="formatted-result">
        <pre>{{ variableString }}</pre>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>请输入变量路径并点击"获取变量"按钮</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

// 导入messenger用于与content script通信
import messenger from '@/message';

// 变量路径
const variablePath = ref('');

// 变量数据
const variableData = ref<any>(null);

// 变量字符串表示
const variableString = ref('');

// 是否为JSON数据
const isJson = ref(false);

// 加载状态
const isLoading = ref(false);

// 错误信息
const error = ref('');

// 变量类型
const variableType = computed(() => {
  if (variableData.value === null) {return '';}
  if (typeof variableData.value === 'object') {
    if (Array.isArray(variableData.value)) {return 'Array';}
    if (variableData.value === null) {return 'null';}
    return 'Object';
  }
  return typeof variableData.value;
});

// 格式化的JSON
const formattedJson = computed(() => {
  if (!isJson.value || variableData.value === null) {return '';}
  return formatJsonForDisplay(variableData.value);
});

// 格式化JSON用于显示
function formatJsonForDisplay(data: any): string {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    // 使用简单的HTML标签美化JSON显示
    return jsonStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"([^"\\]*(\\.[^"\\]*)*)":/g, '<span class="json-key">"$1":</span>')
      .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="json-string">"$1"</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="json-boolean">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
  } catch (e) {
    return String(data);
  }
}

// 获取变量
async function getVariable() {
  if (!variablePath.value.trim()) {
    error.value = '请输入变量路径';
    return;
  }
  isLoading.value = true;
  error.value = '';

  // 使用messenger发送消息到content script
  await evaluateVariablePath(variablePath.value)
    .then(data => {
      variableData.value = data;
      // 格式化变量数据为字符串
      try {
        variableString.value = JSON.stringify(data, null, 2);
        isJson.value = true;
      } catch {
        variableString.value = String(data);
        isJson.value = false;
      }
    })
    .catch(err => {
      error.value = err.message || '获取变量失败';
    })
    .finally(() => {
      isLoading.value = false;
    });
}

// 评估变量路径
function evaluateVariablePath(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // 安全检查
      if (!path || typeof path !== 'string') {
        throw new Error('变量路径不能为空');
      }

      // 使用messenger发送消息到content script
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id as number, {
          action: 'GET_PAGE_VARIABLE',
          data: { varPath: path }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error('无法连接到页面: ' + chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.msg || '获取变量失败'));
          }
        });
      });
    } catch (error: any) {
      maLogger.error('评估变量路径时出错:', error.message);
      reject(error);
    }
  });
}

// 刷新变量
function refreshVariable() {
  if (variablePath.value.trim()) {
    getVariable();
  }
}

// 从文本更新变量
function updateVariableFromText() {
  try {
    // 尝试解析为JSON
    const parsed = JSON.parse(variableString.value);
    variableData.value = parsed;
    isJson.value = true;
    updateVariable(); // 使用updateVariable方法，它会触发setPageVariable
  } catch {
    // 不是有效的JSON，保持为字符串
    variableData.value = variableString.value;
    isJson.value = false;
    updateVariable(); // 使用updateVariable方法，它会触发setPageVariable
  }
}

// 更新变量
function updateVariable() {
  if (!variablePath.value.trim()) {
    error.value = '请输入变量路径';
    return;
  }

  isLoading.value = true;
  error.value = '';

  // 安全检查
  if (variableData.value === undefined || variableData.value === null) {
    isLoading.value = false;
    error.value = '变量值不能为空';
    return;
  }

  // 调用setPageVariable方法
  setPageVariable(variablePath.value, variableData.value)
    .then(() => {
      // 显示成功消息
      showToast('变量更新成功', 'success');
    })
    .catch(err => {
      error.value = err.message || '更新变量失败';
    })
    .finally(() => {
      isLoading.value = false;
    });
}

// 设置页面变量
function setPageVariable(path: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 安全检查
      if (!path || typeof path !== 'string') {
        throw new Error('变量路径不能为空');
      }

      // 使用messenger发送消息到content script
      messenger.ext.send({
        action: 'SET_PAGE_VARIABLE',
        payload: { path, value }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('无法连接到页面: ' + chrome.runtime.lastError.message));
          return;
        }

        if (response && response.success) {
          maLogger.log('变量设置成功');
          resolve();
        } else {
          maLogger.error('设置变量失败:', response?.msg);
          reject(new Error(response?.msg || '设置变量失败'));
        }
      });
    } catch (error) {
      maLogger.error('设置变量出错:', error);
      reject(error);
    }
  });
}

// 显示提示框
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  // 发送消息到App.vue显示提示框
  chrome.runtime.sendMessage({
    action: 'SHOW_TOAST',
    text: message,
    type: type
  });
}

// 监听变量路径变化，清除结果
watch(variablePath, () => {
  if (!variablePath.value.trim()) {
    variableData.value = null;
    variableString.value = '';
    isJson.value = false;
    error.value = '';
  }
});
</script>

<style scoped>
.browser-var-inspector {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  text-align: center;
}

.header h2 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 600;
}

.description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-section label {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.input-group {
  display: flex;
  gap: 8px;
}

.variable-input {
  flex: 1;
  padding: 10px 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: all var(--transition-fast);
}

.variable-input:focus {
  border-color: var(--primary-color);
  box-shadow: var(--glow-primary);
}

.get-btn,
.refresh-btn,
.update-btn,
.retry-btn {
  padding: 10px 16px;
  background-color: var(--primary-color);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.get-btn:hover,
.refresh-btn:hover,
.update-btn:hover,
.retry-btn:hover {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.get-btn:active,
.refresh-btn:active,
.update-btn:active,
.retry-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.refresh-btn {
  padding: 6px 12px;
  font-size: 13px;
}

.retry-btn {
  margin-left: 8px;
  padding: 4px 12px;
  font-size: 12px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-secondary);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background-color: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 8px;
  color: #ff8a80;
}

.error-icon {
  font-size: 18px;
}

.result-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  overflow: hidden;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.variable-type {
  font-size: 12px;
  font-weight: 500;
  color: var(--primary-light);
  background-color: rgba(22, 93, 255, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.edit-section {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.variable-textarea {
  flex: 1;
  min-height: 120px;
  padding: 10px 12px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  outline: none;
  resize: vertical;
  transition: all var(--transition-fast);
}

.variable-textarea:focus {
  border-color: var(--primary-color);
  box-shadow: var(--glow-primary);
}

.formatted-result {
  flex: 1;
  overflow: auto;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px;
}

.formatted-result pre {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.json-tree {
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.5;
}

.json-key {
  color: #79b8ff;
}

.json-string {
  color: #9ecbff;
}

.json-number {
  color: #ffab70;
}

.json-boolean {
  color: #56d364;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-tertiary);
  font-style: italic;
}

/* 滚动条样式 */
.variable-textarea::-webkit-scrollbar,
.formatted-result::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.variable-textarea::-webkit-scrollbar-track,
.formatted-result::-webkit-scrollbar-track {
  background: var(--bg-primary);
  border-radius: 4px;
}

.variable-textarea::-webkit-scrollbar-thumb,
.formatted-result::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.variable-textarea::-webkit-scrollbar-thumb:hover,
.formatted-result::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
</style>