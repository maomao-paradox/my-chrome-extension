<template>
  <div class="panel">
    <div class="panel-title">页面信息</div>
    <div class="info-display">
      <div class="info-item">
        <span class="info-label">当前URL:</span>
        <span class="info-value">{{ currentUrl }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">页面标题:</span>
        <span class="info-value">{{ pageTitle }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">域名:</span>
        <span class="info-value">{{ domainName }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// 页面信息数据
const currentUrl = ref('加载中...');
const pageTitle = ref('加载中...');
const domainName = ref('加载中...');

/**
 * 更新页面信息
 */
function updatePageInfo(): void {
  try {
    // 从当前活动标签页获取信息
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      if (tabs && tabs[0]) {
        const tab = tabs[0];
        
        // 更新UI显示
        currentUrl.value = tab.url || '未知URL';
        pageTitle.value = tab.title || '无标题页面';
        
        // 提取域名
        try {
          if (tab.url) {
            const url = new URL(tab.url);
            domainName.value = url.hostname;
          }
        } catch (e) {
          domainName.value = '无法解析域名';
        }
      }
    });
  } catch (error) {
    maLogger.error('更新页面信息失败:', error);
  }
}

// 组件挂载时更新页面信息
onMounted(() => {
  updatePageInfo();
  
  // 监听标签页变化，更新页面信息
  chrome.tabs.onActivated.addListener(() => {
    updatePageInfo();
  });
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id === tabId) {
          updatePageInfo();
        }
      });
    }
  });
});
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

.info-display {
  background-color: rgba(64, 158, 255, 0.05);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 4px;
  padding: 12px;
  margin-top: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: var(--text-secondary-color);
}

.info-value {
  color: var(--text-regular-color);
  font-weight: 500;
  word-break: break-all;
  text-align: right;
}
</style>