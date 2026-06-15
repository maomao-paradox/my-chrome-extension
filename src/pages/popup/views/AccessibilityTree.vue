<template>
    <div class="header">
        <h1>🌳 Accessibility Tree 提取器</h1>
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
        <button class="btn-primary" @click="extractAccessibilityTree" :disabled="isLoading">
            {{ isLoading ? '⏳ 提取中...' : '🚀 提取无障碍树' }}
        </button>
        <button class="btn-secondary" @click="copyMarkdown" :disabled="!canCopy || copySuccess">
            {{ copySuccess ? '✅ 已复制！' : '📋 复制 Markdown' }}
        </button>
    </div>

    <div class="output-area">
        <div class="output-header">
            <h3>📄 提取结果（大模型友好格式）</h3>
        </div>
        <div class="output-content">
            <div v-if="isLoading" class="loading">⏳ 正在提取无障碍树，请稍候...</div>
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
                error.value = '⚠️ 无法连接到页面，请刷新页面后重试。';
                isLoading.value = false;
                return;
            }

            if (response && response.success) {
                currentData.value = response.data;
                stats.value = response.data.stats;
                markdown.value = response.data.markdown;
                showStats.value = true;
            } else {
                error.value = `❌ 错误: ${response?.error || '提取失败'}`;
            }
            isLoading.value = false;
        });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        maLogger.error('提取失败:', errorMessage);

        if (errorMessage.includes('Could not establish connection')) {
            error.value = '⚠️ 无法连接到页面，请刷新页面后重试。';
        } else {
            error.value = `❌ 错误: ${errorMessage}`;
        }
        isLoading.value = false;
    }
}

async function copyMarkdown() {
    if (!markdown.value) return;

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

<style scoped>
body {
    width: 500px;
    max-height: 600px;
    margin: 0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e0e0e0;
}

h1 {
    font-size: 18px;
    margin: 0 0 4px 0;
    color: #1a73e8;
}

.url {
    font-size: 12px;
    color: #5f6368;
    word-break: break-all;
}

.stats {
    display: none;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
}

.stats-visible {
    display: flex;
}

.stat-card {
    flex: 1;
    text-align: center;
}

.stat-number {
    font-size: 20px;
    font-weight: bold;
    color: #1a73e8;
}

.stat-label {
    font-size: 11px;
    color: #5f6368;
    margin-top: 4px;
}

.button-group {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

button {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background: #1a73e8;
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: #1557b0;
}

.btn-secondary {
    background: #e8eaed;
    color: #3c4043;
}

.btn-secondary:hover:not(:disabled) {
    background: #dadce0;
}

.output-area {
    margin-top: 16px;
}

.output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.output-header h3 {
    margin: 0;
    font-size: 14px;
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
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px;
    border-radius: 8px;
    font-size: 11px;
    font-family: 'Monaco', 'Menlo', monospace;
    max-height: 350px;
    overflow: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.loading {
    text-align: center;
    padding: 20px;
    color: #5f6368;
}

.error {
    color: #d93025;
    background: #fce8e6;
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
}

.markdown-content {
    width: 100%;
}
</style>
