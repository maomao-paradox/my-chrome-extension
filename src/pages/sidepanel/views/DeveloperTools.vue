<template>
  <div class="panel">
    <div class="panel-title">开发者工具</div>
    <div class="feature-grid">
      <div class="feature-card" @click="getPageSource">
        <h3><span class="feature-icon">📄</span>查看页面源码</h3>
        <p>获取当前网页的HTML源代码并下载</p>
      </div>
      <div class="feature-card" @click="clearLocalStorage">
        <h3><span class="feature-icon">🧹</span>清除本地存储</h3>
        <p>清理当前网站的本地存储数据，包括localStorage和sessionStorage</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 消息类型定义
interface Message {
  action: string
  data?: any
}

// 响应类型定义
interface MessageResponse {
  success?: boolean
  msg?: string
  data?: any
}

/**
 * 发送消息到内容脚本
 * @param message 消息对象
 * @param callback 回调函数
 */
function sendMessageToContentScript(message: Message, callback?: (response: MessageResponse) => void): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, message, (response: MessageResponse) => {
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
 * 获取页面源码
 */
function getPageSource(): void {
  sendMessageToContentScript({ action: 'GET_PAGE_SOURCE' }, (response: MessageResponse) => {
    if (response && response.success) {
      showToast(response.msg || '源码获取成功', 'success');
    } else {
      showToast('获取源码失败: ' + (response?.msg || '请确保扩展已正确加载'), 'error');
    }
  });
}

/**
 * 清除本地存储
 */
function clearLocalStorage(): void {
  if (confirm('确定要清除本地存储、会话存储和Cookie吗？')) {
    sendMessageToContentScript({ action: 'CLEAR_STORAGE' }, (response: MessageResponse) => {
      if (response && response.success) {
        showToast(response.msg || '存储清除成功', 'success');
      } else {
        showToast('清除存储失败: ' + (response?.msg || '请确保扩展已正确加载'), 'error');
      }
    });
  }
}

/**
 * 检查页面元素
 */
function inspectPageElements(): void {
  sendMessageToContentScript({ action: 'INSPECT_ELEMENTS' }, (response: MessageResponse) => {
    if (response && response.success) {
      showToast(response.msg || '开发者工具已打开', 'success');
    } else {
      showToast('检查元素失败: ' + (response?.msg || '请确保扩展已正确加载'), 'error');
    }
  });
}
</script>

<style scoped>
/* 面板容器 - 与父组件主题保持一致 */
.panel {
  /* 移除这些样式，因为它们应该由父组件的 .feature-card 控制 */
}

/* 面板标题 - 科技感风格 */
.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
  position: relative;
  padding-left: 16px;
  text-align: center;
}

.panel-title::before {
  content: '';
  position: absolute;
  left: 50%;
  top: calc(100% + 8px);
  transform: translateX(-50%);
  width: 60px;
  height: 3px;
  background: var(--gradient-primary);
  border-radius: 2px;
}

/* 功能网格布局 */
.feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* 功能卡片 - 科技感风格 */
.feature-card {
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  transition: all var(--transition-fast);
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md), var(--glow-secondary);
  border-color: var(--primary-light);
  background: rgba(22, 27, 34, 0.8);
}

.feature-card h3 {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
}

.feature-card p {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.feature-icon {
  width: 28px;
  height: 28px;
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 93, 255, 0.1);
  color: var(--primary-light);
  border-radius: 6px;
  font-size: 16px;
  border: 1px solid rgba(22, 93, 255, 0.2);
}

.feature-card:hover .feature-icon {
  background: rgba(22, 93, 255, 0.2);
  border-color: var(--primary-light);
  color: var(--primary-light);
}
</style>