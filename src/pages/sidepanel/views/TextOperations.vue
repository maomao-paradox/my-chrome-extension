<template>
  <div class="panel">
    <div class="panel-title">文本操作</div>
    <div class="input-group">
      <label for="find-text">查找文本</label>
      <input type="text" id="find-text" v-model="findText" placeholder="输入要查找的文本">
    </div>
    <div class="input-group">
      <label for="replace-text">替换为</label>
      <input type="text" id="replace-text" v-model="replaceText" placeholder="输入替换的文本">
    </div>
    <div class="action-buttons">
      <button class="btn-primary" @click="replaceAllText">批量替换文本</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ExtMessage, ResponseMessage } from '@/assets/types/message';

// 文本替换相关数据
const findText = ref('');
const replaceText = ref('');


/**
 * 发送消息到内容脚本
 * @param message 消息对象
 * @param callback 回调函数
 */
function sendMessageToContentScript(message: ExtMessage, callback?: (response: ResponseMessage) => void): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, message, (response: ResponseMessage) => {
        if (callback) {
          callback(response);
        }
      });
    }
  });
}

/**
 * 显示提示框
 * @param message 提示消息
 * @param type 提示类型
 */
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  chrome.runtime.sendMessage({
    action: 'SHOW_TOAST',
    text: message,
    type: type
  });
}

/**
 * 批量替换文本
 */
function replaceAllText(): void {
  const oldText = findText.value.trim();
  const newText = replaceText.value;
  
  if (!oldText) {
    showToast('请输入要查找的文本', 'error');
    return;
  }
  
  sendMessageToContentScript({
    type: 'BATCH_REPLACE_TEXT',
    payload: { oldText, newText },
    target :'content'
  }, (response: ResponseMessage) => {
    if (response && response.success) {
      showToast(response.msg || '文本替换成功', 'success');
    } else {
      showToast('替换失败: ' + (response?.msg || '请确保扩展已正确加载'), 'error');
    }
  });
}
</script>

<style scoped>
.panel {
  background-color: var(--panel-bg);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
  transition: var(--transition);
}

.panel:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.panel-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: var(--text-color);
  position: relative;
  padding-left: 12px;
}

.panel-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  background-color: var(--primary-color);
  border-radius: 2px;
}

.input-group {
  margin-bottom: 16px;
}

label {
  display: block;
  font-size: 13px;
  color: var(--text-regular-color);
  margin-bottom: 6px;
  font-weight: 500;
}

input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  color: black;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  transition: var(--transition);
  background-color: white;
}

input[type="text"]:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: var(--transition);
  flex: 1;
  font-weight: 500;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background-color: #66b1ff;
}
</style>