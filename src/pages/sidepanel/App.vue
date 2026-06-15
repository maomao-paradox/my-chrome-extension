<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <nav class="navigation">
      <div class="nav-tabs-scroll" ref="navTabsScroll">
        <div class="nav-tabs">
          <button v-for="tab in tabs" :key="tab.id" :class="['nav-tab', { active: currentTab === tab.id }]"
            @click="handleTabClick(tab.id)">
            <span class="tab-icon">{{ getTabIcon(tab.id) }}</span>
            <span class="tab-label">{{ tab.name }}</span>
          </button>
        </div>
      </div>
    </nav>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- AI对话面板 -->
      <AIChat v-if="currentTab === 'ai-chat'" />

      <!-- 其他功能面板 -->
      <div v-else-if="currentTab === 'other-features'" class="features-container fade-in">
        <header>
          <h1>MRIA扩展功能</h1>
          <p class="subtitle">增强您的浏览体验</p>
        </header>

        <!-- 功能卡片 -->
        <div class="feature-cards">
          <div class="feature-card">
            <PageInfo />
          </div>
          <div class="feature-card">
            <CoreFeatures />
          </div>
          <div class="feature-card">
            <TextOperations />
          </div>
          <div class="feature-card">
            <DeveloperTools />
          </div>
          <div class="feature-card">
            <About />
          </div>
        </div>
      </div>

      <!-- 浏览器变量查看器 -->
      <div v-else-if="currentTab === 'browser-var'" class="var-inspector-container fade-in">
        <BrowserVarInspector />
      </div>

      <!-- 路径扫描工具 -->
      <div v-else-if="currentTab === 'path-scanner'" class="path-scanner-container fade-in">
        <HiddenPathScanner />
      </div>

      <!-- 音乐 -->
      <div v-else-if="currentTab === 'music'" class="music-container fade-in">
        <Music />
      </div>
    </main>

    <!-- 状态栏 -->
    <div class="status-bar" ref="statusBar">
      <div class="status-left">
        <span>MRIA Extension v1.0.0</span>
      </div>
      <div class="status-center">
        <div class="status-dot"></div>
        <span>系统状态正常</span>
      </div>
      <div class="status-right">
        <span>{{ formattedTime }}</span>
      </div>
    </div>

    <!-- 提示框 -->
    <!-- <div id="toast" class="toast" ref="toast">
      <span class="toast-icon">{{ toastIcon }}</span>
      <span class="toast-message"></span>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import PageInfo from './views/PageInfo.vue';
import CoreFeatures from './views/CoreFeatures.vue';
import TextOperations from './views/TextOperations.vue';
import DeveloperTools from './views/DeveloperTools.vue';
import About from './views/About.vue';
import BrowserVarInspector from './views/BrowserVarInspector.vue';
import HiddenPathScanner from './views/HiddenPathScanner.vue';
import XhrPatchManager from './views/XhrPatchManager.vue';
import AIChat from './views/FuturisticAIChat.vue';
import Music from './views/Music.vue';

// 导航选项卡定义
interface Tab {
  id: string;
  name: string;
}

// 导航选项卡列表
const tabs: Tab[] = [
  { id: 'ai-chat', name: '网页分析' },
  { id: 'other-features', name: '功能面板' },
  { id: 'browser-var', name: '调试面板' },
  { id: 'path-scanner', name: '路径扫描' },
  { id: 'music', name: '音乐' }
];

// 当前选中的选项卡
const currentTab = ref('ai-chat'); // 默认选中网页分析

// 引用DOM元素
const statusBar = ref<HTMLElement | null>(null);
const toast = ref<HTMLElement | null>(null);
const navTabsScroll = ref<HTMLElement | null>(null);

// 格式化时间
const formattedTime = computed(() => {
  return new Date().toLocaleTimeString();
});

// Toast类型定义
type ToastType = 'success' | 'error' | 'info';
let currentToastType: ToastType = 'info';
let timeUpdateInterval: number | null = null;

// 获取标签页图标
const getTabIcon = (tabId: string) => {
  const icons: Record<string, string> = {
    'ai-chat': '🤖',
    'other-features': '⚙️',
    'browser-var': '🔍',
    'path-scanner': '🔐',
    'xhr-patch': '🔧'
  };
  return icons[tabId] || '📄';
};

// 获取提示框图标
const getToastIcon = (type: ToastType) => {
  const icons: Record<ToastType, string> = {
    'success': '✅',
    'error': '❌',
    'info': 'ℹ️'
  };
  return icons[type];
};

// 提示框图标
const toastIcon = computed(() => {
  return getToastIcon(currentToastType);
});

/**
 * 处理选项卡点击
 */
function handleTabClick(tabId: string) {
  currentTab.value = tabId;
  showToast(`已切换到 ${tabs.find(tab => tab.id === tabId)?.name}`, 'success');
}

/**
 * 显示提示框
 * @param message 提示消息
 * @param type 提示类型
 * @param duration 持续时间(毫秒)
 */
function showToast(message: string, type: ToastType = 'info', duration: number = 3000): void {
  if (!toast.value) return;

  const toastElement = toast.value;
  const messageElement = toastElement.querySelector('.toast-message') as HTMLElement;

  if (messageElement) {
    messageElement.textContent = message;
  }

  currentToastType = type;

  // 设置类型和显示
  toastElement.className = `toast show ${type}`;

  // 定时隐藏
  setTimeout(() => {
    if (toast.value) {
      toast.value.className = 'toast';
    }
  }, duration);
}

/**
 * 监听来自内容脚本的消息
 */
onMounted(() => {
  // 监听消息
  chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean => {
    if (message.action === 'UPDATE_STATUS' && statusBar.value) {
      const statusCenter = statusBar.value.querySelector('.status-center span');
      if (statusCenter) {
        statusCenter.textContent = message.text;
      }
      sendResponse({ success: true });
    } else if (message.action === 'SHOW_TOAST') {
      showToast(message.text, message.type as ToastType || 'info');
      sendResponse({ success: true });
    }
    return true; // 保持消息通道开放以便异步响应
  });

  // 显示初始化成功消息
  showToast('侧边栏初始化成功', 'success');

  // 更新时间显示
  timeUpdateInterval = window.setInterval(() => {
    // 触发computed更新
    formattedTime.value;
  }, 1000);

  // 添加鼠标滚轮横向滚动支持
  if (navTabsScroll.value) {
    // 平滑滚动变量
    let scrollAnimationId: number | null = null;
    let currentScrollPos = 0;
    let targetScrollPos = 0;
    let easeFactor = 0.3; // 缓动因子，值越大滚动越快

    // 平滑滚动动画函数
    const smoothScroll = () => {
      if (!navTabsScroll.value) return;

      // 计算当前位置和目标位置的差值
      const diff = targetScrollPos - navTabsScroll.value.scrollLeft;

      // 如果差值很小，直接设置目标位置并停止动画
      if (Math.abs(diff) < 1) {
        navTabsScroll.value.scrollLeft = targetScrollPos;
        if (scrollAnimationId) {
          cancelAnimationFrame(scrollAnimationId);
          scrollAnimationId = null;
        }
        return;
      }

      // 应用缓动算法
      navTabsScroll.value.scrollLeft += diff * easeFactor;

      // 继续下一帧动画
      scrollAnimationId = requestAnimationFrame(smoothScroll);
    };

    const handleWheel = (event: WheelEvent) => {
      // 只有当按下Shift键或者没有垂直滚动条时才进行横向滚动
      if (event.shiftKey || (navTabsScroll.value && navTabsScroll.value.scrollHeight <= navTabsScroll.value.clientHeight)) {
        event.preventDefault();

        if (navTabsScroll.value) {
          // 计算新的目标位置
          targetScrollPos = navTabsScroll.value.scrollLeft + event.deltaY * 0.4; // 更大的缩放因子以加快滚动速度

          // 确保目标位置在有效范围内
          targetScrollPos = Math.max(0, Math.min(targetScrollPos, navTabsScroll.value.scrollWidth - navTabsScroll.value.clientWidth));

          // 如果没有正在运行的动画，启动一个
          if (!scrollAnimationId) {
            smoothScroll();
          }
        }
      }
    };

    navTabsScroll.value.addEventListener('wheel', handleWheel, { passive: false });

    // 在组件卸载时清理
    onBeforeUnmount(() => {
      if (navTabsScroll.value) {
        navTabsScroll.value.removeEventListener('wheel', handleWheel);
      }
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
        scrollAnimationId = null;
      }
    });
  }
});

// 组件卸载前清理
onBeforeUnmount(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
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

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: var(--text-primary);
  background: var(--gradient-secondary);
  line-height: 1.6;
  height: 100vh;
  overflow: hidden;
}

/* 应用容器 */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 100%;
  background: var(--bg-primary);
}

/* 导航栏样式 */
.navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

/* 横向滚动容器 - 隐藏滚动条但保持滚动功能 */
.nav-tabs-scroll {
  display: flex;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  /* Firefox */
}

/* Chrome, Safari, Edge 隐藏滚动条 */
.nav-tabs-scroll::-webkit-scrollbar {
  display: none;
}

/* 品牌标识 */
.nav-logo {
  display: flex;
  align-items: center;
}

.version-badge {
  font-size: 11px;
  color: var(--text-secondary);
  background-color: var(--bg-hover);
  padding: 2px 6px;
  border-radius: 8px;
}

.nav-tabs {
  display: flex;
  gap: 10px;
  min-width: min-content;
  margin-left: 10px;
  padding: 8px 16px;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px 8px 16px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 13px;
  white-space: nowrap;
  font-weight: 500;
}

.nav-tab:hover {
  background: rgba(22, 93, 255, 0.08);
  color: var(--text-primary);
  border-color: rgba(22, 93, 255, 0.3);
  transform: translateY(-1px);
}

.nav-tab.active {
  background: linear-gradient(135deg, #165DFF 0%, #4080FF 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 2px 10px rgba(22, 93, 255, 0.3);
}

.tab-icon {
  font-size: 14px;
}

.tab-label {
  font-weight: 500;
}

/* 主内容区域 */
.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: var(--bg-primary);
}

/* 功能面板容器 */
.features-container {
  max-width: 100%;
}

/* 变量查看器容器 */
.var-inspector-container {
  padding: 0;
  height: 100%;
  overflow: hidden;
}

/* 路径扫描工具容器 */
.path-scanner-container {
  padding: 0;
  height: 100%;
  overflow: visible;
}

header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

h1 {
  font-size: 20px;
  color: var(--text-primary);
  margin-bottom: 8px;
  font-weight: 600;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

/* 功能卡片布局 */
.feature-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.feature-card {
  background: var(--gradient-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  transition: all var(--transition-fast);
  backdrop-filter: blur(4px);
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md), var(--glow-secondary);
  border-color: var(--primary-light);
}

/* 状态栏 */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-secondary);
  padding: 8px 20px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  backdrop-filter: blur(10px);
}

.status-left,
.status-center,
.status-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00C853 0%, #007E33 100%);
  box-shadow: 0 0 8px rgba(0, 200, 83, 0.6);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 提示框 */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  opacity: 0;
  transform: translateX(100%);
  transition: all var(--transition-normal);
  z-index: 1000;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toast.show {
  opacity: 1;
  transform: translateX(0);
}

.toast.success {
  background: linear-gradient(135deg, rgba(0, 200, 83, 0.9) 0%, rgba(0, 126, 51, 0.9) 100%);
}

.toast.error {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.9) 0%, rgba(198, 40, 40, 0.9) 100%);
}

.toast.info {
  background: linear-gradient(135deg, rgba(22, 93, 255, 0.9) 0%, rgba(64, 128, 255, 0.9) 100%);
}

.toast-icon {
  font-size: 14px;
}

.toast-message {
  font-size: 13px;
}

/* 淡入动画 */
.fade-in {
  animation: fadeIn 0.5s ease-in-out;
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
</style>