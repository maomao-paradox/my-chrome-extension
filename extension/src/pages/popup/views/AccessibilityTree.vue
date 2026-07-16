<template>
    <div class="header">
        <h1>Accessibility Tree 提取器</h1>
        <div class="url">{{ currentUrl }}</div>
    </div>

    <div class="stats" :class="{ 'stats-visible': showStats }">
        <div class="stat-card">
            <div class="stat-number">{{ stats.totalNodes }}</div>
            <div class="stat-label">总节点</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ stats.interactiveCount }}</div>
            <div class="stat-label">可交互</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ stats.buttonsCount }}</div>
            <div class="stat-label">按钮</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ stats.linksCount }}</div>
            <div class="stat-label">链接</div>
        </div>
    </div>

    <div class="button-group">
        <button class="btn-primary" :disabled="isLoading" @click="extractAccessibilityTree">
            {{ isLoading ? '提取中...' : '提取无障碍树' }}
        </button>
        <button class="btn-secondary" :disabled="!canCopy || copySuccess" @click="copyMarkdown">
            {{ copySuccess ? '已复制' : '复制 Markdown' }}
        </button>
    </div>

    <div class="output-area">
        <div class="output-header">
            <h3>提取结果</h3>
        </div>
        <div class="output-content">
            <div v-if="isLoading" class="loading">正在提取无障碍树，请稍候...</div>
            <div v-else-if="error" class="error">{{ error }}</div>
            <div v-else-if="markdown" class="markdown-content">
                <pre>{{ markdown }}</pre>
            </div>
            <div v-else class="loading">点击"提取无障碍树"开始分析当前页面</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

interface AccessibilityStats {
    totalNodes: number;
    interactiveCount: number;
    buttonsCount: number;
    linksCount: number;
}

interface AccessibilityData {
    stats: AccessibilityStats;
    markdown: string;
}

const currentUrl = ref('加载中...');
const stats = ref<AccessibilityStats>({
  totalNodes: 0,
  interactiveCount: 0,
  buttonsCount: 0,
  linksCount: 0
});
const showStats = ref(false);
const currentData = ref<AccessibilityData | null>(null);
const markdown = ref('');
const isLoading = ref(false);
const error = ref('');
const copySuccess = ref(false);

const canCopy = computed(() => !!markdown.value);

async function displayUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl.value = tab.url || '无法获取URL';
}

async function extractAccessibilityTree() {
  isLoading.value = true;
  error.value = '';
  markdown.value = '';
  showStats.value = false;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      throw new Error('无法获取当前标签页');
    }

    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'extractAccessibilityTree',
      target: 'content',
      payload: { maxDepth: 8, includeHidden: false, simplify: true }
    }, (response: any) => {
      if (chrome.runtime.lastError) {
        maLogger.error('发送消息失败:', chrome.runtime.lastError.message);
        error.value = '无法连接到页面，请刷新页面后重试。';
        isLoading.value = false;
        return;
      }

      if (response && response.success) {
        currentData.value = response.data;
        stats.value = response.data.stats;
        markdown.value = response.data.markdown;
        showStats.value = true;
      } else {
        error.value = `错误: ${response?.error || '提取失败'}`;
      }
      isLoading.value = false;
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    maLogger.error('提取失败:', errorMessage);

    if (errorMessage.includes('Could not establish connection')) {
      error.value = '无法连接到页面，请刷新页面后重试。';
    } else {
      error.value = `错误: ${errorMessage}`;
    }
    isLoading.value = false;
  }
}

async function copyMarkdown() {
  if (!markdown.value) {return;}

  try {
    await navigator.clipboard.writeText(markdown.value);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (err) {
    maLogger.error('复制失败:', err);
    error.value = '复制失败，请手动复制';
  }
}

onMounted(() => {
  displayUrl();
});
</script>

<style scoped lang="scss">
.header {
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--popup-border);
}

h1 {
    margin: 0 0 5px;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.15;
    color: var(--popup-text-primary);
}

.url {
    display: -webkit-box;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.35;
    color: var(--popup-text-subtle);
    word-break: break-all;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

.stats {
    display: none;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    margin-bottom: 8px;
}

.stats-visible {
    display: grid;
}

.stat-card {
    min-width: 0;
    padding: 7px 4px;
    border: 1px solid var(--popup-border);
    border-radius: 12px;
    background: var(--popup-control-bg);
    text-align: center;
    box-shadow: var(--popup-inset-highlight);
}

.stat-number {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 16px;
    font-weight: bold;
    line-height: 1;
    color: var(--popup-accent);
}

.stat-label {
    margin-top: 4px;
    font-size: 10px;
    line-height: 1;
    color: var(--popup-text-subtle);
}

.button-group {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
}

button {
    flex: 1;
    min-width: 0;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid var(--popup-border);
    border-radius: 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    transition: all 0.2s;
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    border-color: var(--popup-button-border);
    background: var(--popup-button-bg);
    color: var(--popup-text-on-accent);
    box-shadow: var(--popup-shadow-accent);
}

.btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.05);
}

.btn-secondary {
    background: var(--popup-control-bg);
    color: var(--popup-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: var(--popup-border-strong);
    background: var(--popup-control-hover-bg);
}

.output-area {
    margin-top: 8px;
}

.output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.output-header h3 {
    margin: 0;
    font-size: 13px;
    line-height: 1.2;
    color: var(--popup-text-primary);
}

.copy-btn {
    padding: 4px 8px;
    font-size: 11px;
    background: #e8eaed;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.output-content {
    width: 100%;
}

pre {
    margin: 0;
    max-height: 210px;
    overflow: auto;
    padding: 10px;
    border: 1px solid var(--popup-border);
    border-radius: 12px;
    background: var(--popup-card-bg);
    color: var(--popup-text-secondary);
    font-size: 10px;
    line-height: 1.45;
    font-family: 'Monaco', 'Menlo', monospace;
    white-space: pre-wrap;
    word-wrap: break-word;
    box-shadow: var(--popup-inset-highlight);
}

.loading {
    text-align: center;
    padding: 24px 12px;
    border: 1px dashed var(--popup-border);
    border-radius: 12px;
    background: var(--popup-control-bg);
    color: var(--popup-text-muted);
    font-size: 12px;
    line-height: 1.4;
}

.error {
    color: var(--popup-danger-text);
    background: var(--popup-danger-bg);
    border: 1px solid var(--popup-danger-border);
    padding: 10px;
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.4;
}

.markdown-content {
    width: 100%;
}
</style>
