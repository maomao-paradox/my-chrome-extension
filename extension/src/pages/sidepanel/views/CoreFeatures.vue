<template>
  <div class="panel">
    <div class="panel-title">核心功能</div>
    <div class="feature-grid">
      <div 
        class="feature-card" 
        :class="{ active: isContentEditable }"
        @click="toggleContentEditable"
      >
        <h3><span class="feature-icon">✏️</span>{{ isContentEditable ? '禁用内容编辑' : '网页内容编辑' }}</h3>
        <p>开启后可以直接编辑当前网页的文本内容，类似编辑Word文档</p>
      </div>
      <div class="feature-card" @click="extractPageLinks">
        <h3><span class="feature-icon">🔗</span>提取页面链接</h3>
        <p>自动收集当前页面上的所有链接地址，方便查看和复制</p>
      </div>
      <div class="feature-card" @click="takePageScreenshot">
        <h3><span class="feature-icon">📸</span>网页截图</h3>
        <p>捕获当前网页的完整截图并保存到本地</p>
      </div>
      <div class="feature-card" @click="storeCurrentLocalStorage">
        <h3><span class="feature-icon">💾</span>暂存localStorage</h3>
        <p>保存当前页面的所有localStorage数据到扩展暂存区</p>
      </div>
      <div class="feature-card" @click="overwriteWithStoredLocalStorage">
        <h3><span class="feature-icon">🔄</span>覆盖localStorage</h3>
        <p>使用暂存的localStorage数据覆盖当前页面的数据</p>
      </div>
      <div class="feature-card" @click="triggerComponentCapture">
        <h3><span class="feature-icon">🎯</span>组件捕获</h3>
        <p>点击页面上的任意组件，捕获其代码并发送给AI编码助手</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// 消息类型定义
interface Message {
  action: string
  data?: any
  payload?: any
}

// 响应类型定义
interface MessageResponse {
  success?: boolean
  msg?: string
  data?: any
}

// 内容编辑状态
const isContentEditable = ref(false);

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
 * 切换网页内容可编辑状态
 */
function toggleContentEditable(): void {
  sendMessageToContentScript({
    action: 'TOGGLE_CONTENT_EDITABLE',
    data: { enabled: !isContentEditable.value }
  }, (response: MessageResponse) => {
    if (response && response.success) {
      showToast(response.msg || '操作成功', 'success');
      // 更新按钮状态
      isContentEditable.value = !isContentEditable.value;
    } else {
      showToast('切换失败: ' + (response?.msg || '请确保扩展已正确加载'), 'error');
    }
  });
}

/**
 * 提取页面链接
 */
function extractPageLinks(): void {
  sendMessageToContentScript({ action: 'EXTRACT_LINKS' }, (response: MessageResponse) => {
    if (response && response.success) {
      showToast(response.msg || '链接提取成功', 'success');
    } else {
      showToast('提取链接失败: ' + (response?.msg || '请确保扩展已正确加载'), 'error');
    }
  });
}

/**
 * 网页截图
 */
function takePageScreenshot(): void {
  showToast('正在准备截图...', 'info');
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.tabs.captureVisibleTab(tabs[0].id, { format: 'png' }, (dataUrl: string) => {
        if (dataUrl) {
          // 创建下载链接
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `screenshot_${new Date().getTime()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          showToast('截图已保存', 'success');
        } else {
          showToast('截图失败', 'error');
        }
      });
    }
  });
}

/**
 * 暂存当前页面的localStorage
 */
function storeCurrentLocalStorage(): void {
  showToast('正在暂存localStorage...', 'info');
  
  sendMessageToContentScript({ action: 'GET_LOCAL_STORAGE' }, (response: MessageResponse) => {
    if (response && response.success && response.data) {
      // 保存到扩展的localStorage
      chrome.storage.local.set({ 'storedLocalStorage': response.data, 'storedAt': new Date().toISOString() }, () => {
        showToast('localStorage已成功暂存', 'success');
      });
    } else {
      showToast('暂存localStorage失败: ' + (response?.msg || '无法获取页面数据'), 'error');
    }
  });
}

/**
 * 使用暂存的localStorage覆盖当前页面的localStorage
 */
function overwriteWithStoredLocalStorage(): void {
  showToast('正在准备覆盖localStorage...', 'info');
  
  // 从扩展的localStorage获取暂存的数据
  chrome.storage.local.get(['storedLocalStorage', 'storedAt'], (result) => {
    if (result.storedLocalStorage) {
      // 发送到内容脚本覆盖页面的localStorage
      sendMessageToContentScript({
        action: 'SET_LOCAL_STORAGE',
        payload: result.storedLocalStorage
      }, (response: MessageResponse) => {
        if (response && response.success) {
          showToast('localStorage已成功覆盖', 'success');
        } else {
          showToast('覆盖localStorage失败: ' + (response?.msg || '无法设置页面数据'), 'error');
        }
      });
    } else {
      showToast('没有找到暂存的localStorage数据', 'error');
    }
  });
}

/**
 * 触发组件捕获功能
 */
function triggerComponentCapture(): void {
  showToast('正在启动组件捕获...', 'info');
  
  sendMessageToContentScript({
    //@ts-ignore
    type: 'TRIGGER_COMPONENT_CAPTURE'
  }, (response: MessageResponse) => {
    if (response && response.success) {
      showToast(response.msg || '组件捕获已启动，请点击页面上的组件', 'success');
    } else {
      showToast('启动组件捕获失败: ' + (response?.msg || '请确保扩展已正确加载'), 'error');
    }
  });
}
</script>

<style scoped>
/* 导入全局CSS变量 */
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

.panel {
  background: var(--gradient-card);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--border-color);
  backdrop-filter: blur(4px);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

.panel:hover {
  box-shadow: var(--shadow-md);
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
  position: relative;
  padding-left: 16px;
}

.panel-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 24px;
  background: var(--gradient-primary);
  border-radius: 2px;
  box-shadow: var(--glow-primary);
}

.feature-grid {
  display: grid;
  gap: 16px;
}

.feature-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 16px;
  transition: all var(--transition-fast);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(4px);
}

/* 增强科技感的悬停效果 */
.feature-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary-light);
  box-shadow: var(--shadow-md), var(--glow-secondary);
}

/* 活动状态样式 */
.feature-card.active {
  background: rgba(22, 93, 255, 0.15);
  border-color: var(--primary-color);
  box-shadow: var(--glow-primary);
}

/* 卡片发光效果 */
.feature-card::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(135deg, transparent 0%, rgba(22, 93, 255, 0.1) 50%, transparent 100%);
  transform: rotate(30deg);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.feature-card:hover::after {
  opacity: 1;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%) rotate(30deg);
  }
  100% {
    transform: translateX(100%) rotate(30deg);
  }
}

.feature-card h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.feature-card p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  position: relative;
  z-index: 1;
}

.feature-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  border-radius: 8px;
  font-size: 16px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

.feature-card:hover .feature-icon {
  transform: scale(1.1);
  box-shadow: var(--glow-primary), var(--shadow-md);
}
</style>