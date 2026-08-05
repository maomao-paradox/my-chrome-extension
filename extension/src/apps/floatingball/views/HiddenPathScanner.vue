<template>
  <div class="hidden-path-scanner">
    <header>
      <h1><el-icon class="el-icon-search"></el-icon> 隐藏路径扫描工具</h1>
      <p class="subtitle">扫描网站可能存在的隐藏路径和文件</p>
    </header>

    <div class="content">
      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="control-buttons">
          <el-button type="primary" :loading="running" @click="startScan">
            <el-icon v-if="!running" class="el-icon-search"></el-icon>
            <el-icon v-else class="el-icon-loading"></el-icon>
            {{ running ? '扫描中...' : '开始扫描' }}
          </el-button>
          <el-button :disabled="running" @click="clearResults">
            <el-icon class="el-icon-delete"></el-icon> 清空结果
          </el-button>
          <el-button :disabled="running" @click="resetScanner">
            <el-icon class="el-icon-refresh"></el-icon> 重置
          </el-button>
        </div>

        <!-- 目标URL设置 -->
        <div class="target-settings">
          <el-input v-model="targetUrl" placeholder="输入目标URL (例如: https://example.com/)" :readonly="running" clearable>
            <template #prefix>
              <el-icon class="el-icon-link"></el-icon>
            </template>
          </el-input>
          <el-button type="success" size="small" :disabled="running" style="margin-left: 10px;" @click="useCurrentPage">
            使用当前页面
          </el-button>
        </div>

        <!-- 路径字典选项 -->
        <div class="dictionary-options">
          <el-checkbox-group v-model="selectedDictionaries" :disabled="running">
            <el-checkbox label="common">常见路径 (admin, login, etc.)</el-checkbox>
            <el-checkbox label="api">API路径 (api, v1, etc.)</el-checkbox>
            <el-checkbox label="files">常见文件 (robots.txt, sitemap.xml)</el-checkbox>
            <el-checkbox label="debug">调试路径 (.git, .env, etc.)</el-checkbox>
          </el-checkbox-group>
        </div>

        <!-- 自定义路径输入 -->
        <div class="custom-paths">
          <div class="section-header">
            <el-icon class="el-icon-edit"></el-icon>
            <span>自定义路径 (每行一个)</span>
          </div>
          <textarea v-model="customPaths" placeholder="例如:\nadmin\nlogin\napi\n.htaccess\nrobots.txt" rows="3"
            :readonly="running"></textarea>
        </div>

        <!-- 扫描设置 -->
        <div class="scan-settings">
          <el-input-number v-model="concurrency" label="并发数" :min="1" :max="20" :disabled="running"
            style="width: 120px;"></el-input-number>
          <el-input-number v-model="timeout" label="超时时间(ms)" :min="500" :max="10000" :disabled="running"
            style="width: 120px; margin-left: 20px;"></el-input-number>
        </div>

        <!-- 扫描状态 -->
        <div v-if="running" class="scan-status">
          <div class="progress-container">
            <el-progress :percentage="progress" :status="scanStatus"></el-progress>
          </div>
          <p class="status-text">
            已扫描: {{ scannedCount }}/{{ totalCount }} 路径 |
            发现: {{ foundCount }} 个可能存在的路径
          </p>
        </div>
      </div>

      <!-- 扫描结果 -->
      <div class="results-container">
        <div class="section-header">
          <el-icon class="el-icon-document-checked"></el-icon>
          <span>扫描结果 ({{ scanResults.length }})</span>
          <el-select v-model="filterStatus" placeholder="过滤状态" size="small" style="margin-left: 20px; width: 120px;">
            <el-option label="全部" value="all"></el-option>
            <el-option label="存在" value="success"></el-option>
            <el-option label="不存在" value="error"></el-option>
            <el-option label="重定向" value="redirect"></el-option>
          </el-select>
        </div>
        <div class="results-list">
          <div v-if="scanResults.length === 0 && !running" class="no-results">
            <el-empty description="暂无扫描结果" />
          </div>
          <div v-for="(result, index) in filteredResults" :key="index" class="result-item"
            :class="`status-${result.status}`">
            <div class="result-header">
              <el-icon class="result-icon" :class="getStatusIcon(result.status)"></el-icon>
              <span class="result-path">{{ result.path }}</span>
              <span class="result-status">{{ getStatusText(result.status) }}</span>
              <span v-if="result.statusCode" class="result-code">{{ result.statusCode }}</span>
              <span class="result-time">{{ result.time }}ms</span>
            </div>
            <div v-if="result.responseSize" class="result-details">
              <span>响应大小: {{ formatFileSize(result.responseSize) }}</span>
              <span v-if="result.redirectUrl">重定向到: {{ result.redirectUrl }}</span>
            </div>
            <el-button v-if="result.status === 'success' || result.status === 'redirect'" type="text" size="small" class="open-btn"
              @click="openPath(result.fullUrl)">
              打开
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="instructions">
      <h3><el-icon class="el-icon-info"></el-icon> 使用说明</h3>
      <ul>
        <li><el-icon class="el-icon-circle-check"></el-icon> 输入目标URL，可选择使用当前页面URL</li>
        <li><el-icon class="el-icon-circle-check"></el-icon> 选择要使用的路径字典或手动输入自定义路径</li>
        <li><el-icon class="el-icon-circle-check"></el-icon> 点击"开始扫描"按钮开始检测隐藏路径</li>
        <li><el-icon class="el-icon-circle-check"></el-icon> 扫描结果将显示路径状态、响应码和响应时间</li>
        <li><el-icon class="el-icon-circle-check"></el-icon> 点击"打开"按钮可访问发现的路径</li>
      </ul>
    </div>

    <footer>
      © 2023 隐藏路径扫描工具 | 仅用于安全测试和授权的渗透测试
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// 响应式数据
const targetUrl = ref('');
const selectedDictionaries = ref(['common', 'files']);
const customPaths = ref('');
const concurrency = ref(5);
const timeout = ref(3000);
const running = ref(false);
const progress = ref(0);
const scannedCount = ref(0);
const totalCount = ref(0);
const foundCount = ref(0);
const scanStatus = ref<any>('');
const scanResults = ref<any>([]);
const filterStatus = ref('all');

const emit = defineEmits(['add-message']);

// 常见路径字典
const pathDictionaries = {
  common: [
    'admin', 'login', 'dashboard', 'panel', 'user', 'profile',
    'adminpanel', 'adminlogin', 'wp-admin', 'wp-login', 'backend',
    'manage', 'controlpanel', 'member', 'account', 'settings',
    'phpinfo.php', 'admin.php', 'manager/'
  ],
  api: [
    'api', 'api/v1', 'api/v2', 'rest', 'graphql', 'json', 'xml',
    'v1', 'v2', 'v3', 'endpoints', 'resources', 'data'
  ],
  files: [
    'robots.txt', 'sitemap.xml', 'humans.txt', 'crossdomain.xml',
    'security.txt', 'ads.txt', 'favicon.ico', 'logo.png'
  ],
  debug: [
    '.git', '.git/HEAD', '.svn', '.hg', '.env', '.env.local', '.env.development',
    'composer.json', 'package.json', 'config.php', 'config.php.bak', 'settings.py',
    'web.config', 'nginx.conf', '.htaccess', 'backup', 'backups',
    '.DS_Store', 'backup.zip', 'www.zip'
  ]
};

// 格式化文件大小
function formatFileSize(bytes: number) {
  if (bytes < 1024) {return bytes + ' B';}
  else if (bytes < 1048576) {return (bytes / 1024).toFixed(2) + ' KB';}
  else {return (bytes / 1048576).toFixed(2) + ' MB';}
}

// 获取状态图标
function getStatusIcon(status: string) {
  switch (status) {
    case 'success': return 'el-icon-circle-check';
    case 'redirect': return 'el-icon-outer-link';
    case 'error': return 'el-icon-circle-close';
    default: return 'el-icon-help';
  }
}

// 获取状态文本
function getStatusText(status: string) {
  switch (status) {
    case 'success': return '存在';
    case 'redirect': return '重定向';
    case 'error': return '不存在';
    default: return '未知';
  }
}

// 过滤结果
const filteredResults = computed(() => {
  if (filterStatus.value === 'all') {return scanResults.value;}
  return scanResults.value.filter((result: any) => result.status === filterStatus.value);
});

// 使用当前页面URL
function useCurrentPage() {
  try {
    // 在Chrome扩展环境中获取当前页面URL
    const currentUrl = window.location.origin + '/';
    targetUrl.value = currentUrl;
    emit('add-message', {
      message: '已设置为当前页面URL',
      type: 'success'
    });
  } catch (error) {
    emit('add-message', {
      message: '获取当前页面URL失败',
      type: 'error'
    });
  }
}

// 构建要扫描的路径列表
function buildPathList() {
  const paths = new Set();

  // 添加字典路径
  selectedDictionaries.value.forEach(dict => {
    if (pathDictionaries[dict as keyof typeof pathDictionaries]) {
      pathDictionaries[dict as keyof typeof pathDictionaries].forEach(path => paths.add(path));
    }
  });

  // 添加自定义路径
  if (customPaths.value.trim()) {
    customPaths.value.trim().split('\n').forEach(path => {
      if (path.trim()) {paths.add(path.trim());}
    });
  }

  return Array.from(paths);
}

// 格式化URL
function formatUrl(baseUrl: string, path: string) {
  // 确保baseUrl以/结尾
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  // 移除path开头的/（如果有）
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return base + cleanPath;
}

// 扫描单个路径
async function scanPath(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout.value);
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      },
      signal: controller.signal
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    clearTimeout(timeoutId);

    const result = {
      path: url.replace(targetUrl.value, ''),
      fullUrl: url,
      status: 'success',
      statusCode: response.status,
      time: responseTime,
      responseSize: 0,
      redirectUrl: ''
    };

    // 检查是否是重定向
    if (response.redirected) {
      result.status = 'redirect';
      result.redirectUrl = response.url;
    } else if (response.status >= 400) {
      result.status = 'error';
    }

    // 获取响应大小
    const blob = await response.blob();
    result.responseSize = blob.size;

    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    return {
      path: url.replace(targetUrl.value, ''),
      fullUrl: url,
      status: 'error',
      statusCode: 0,
      time: responseTime,
      error: error.message
    };
  }
}

// 并发扫描路径
async function concurrentScan(paths: string[]) {
  const results: any[] = [];
  const queue = [...paths];
  const activeWorkers = new Set();

  totalCount.value = paths.length;
  scannedCount.value = 0;
  foundCount.value = 0;
  progress.value = 0;
  scanStatus.value = 'progress';

  const processQueue = async () => {
    while (queue.length > 0 && activeWorkers.size < concurrency.value && running.value) {
      const path = queue.shift();
      const url = formatUrl(targetUrl.value, path as string);

      const worker = scanPath(url).then(result => {
        activeWorkers.delete(worker);
        results.push(result);
        scanResults.value.push(result);

        scannedCount.value++;
        if (result.status === 'success' || result.status === 'redirect') {
          foundCount.value++;
        }

        progress.value = Math.floor((scannedCount.value / totalCount.value) * 100);

        // 继续处理队列
        processQueue();
      }).catch(error => {
        activeWorkers.delete(worker);
        scannedCount.value++;
        progress.value = Math.floor((scannedCount.value / totalCount.value) * 100);
        maLogger.error('扫描路径失败:', error);
        processQueue();
      });

      activeWorkers.add(worker);
    }

    // 检查是否所有扫描都已完成
    if (activeWorkers.size === 0 && running.value) {
      running.value = false;
      scanStatus.value = foundCount.value > 0 ? 'success' : 'warning';

      emit('add-message', {
        message: `扫描完成！共发现 ${foundCount.value} 个可能存在的路径`,
        type: foundCount.value > 0 ? 'success' : 'warning'
      });
    }
  };

  // 开始处理队列
  processQueue();

  // 等待所有扫描完成
  while (activeWorkers.size > 0 && running.value) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

// 开始扫描
async function startScan() {
  if (!targetUrl.value.trim()) {
    emit('add-message', {
      message: '请输入目标URL',
      type: 'warning'
    });
    return;
  }

  const paths = buildPathList();
  if (paths.length === 0) {
    emit('add-message', {
      message: '请选择路径字典或输入自定义路径',
      type: 'warning'
    });
    return;
  }

  // 清空之前的结果
  scanResults.value = [];
  running.value = true;

  try {
    await concurrentScan(paths as string[]);
  } catch (error: any) {
    running.value = false;
    emit('add-message', {
      message: '扫描过程中发生错误: ' + error.message,
      type: 'error'
    });
    maLogger.error('扫描错误:', error);
  }
}

// 清空结果
function clearResults() {
  scanResults.value = [];
  scannedCount.value = 0;
  totalCount.value = 0;
  foundCount.value = 0;
  progress.value = 0;
  emit('add-message', {
    message: '已清空扫描结果',
    type: 'info'
  });
}

// 重置扫描器
function resetScanner() {
  clearResults();
  targetUrl.value = '';
  selectedDictionaries.value = ['common', 'files'];
  customPaths.value = '';
  concurrency.value = 5;
  timeout.value = 3000;
  filterStatus.value = 'all';
  emit('add-message', {
    message: '扫描器已重置',
    type: 'info'
  });
}

// 打开路径
function openPath(url: string) {
  try {
    window.open(url, '_blank');
  } catch (error) {
    emit('add-message', {
      message: '打开路径失败',
      type: 'error'
    });
  }
}

// 组件挂载时尝试设置当前页面URL
onMounted(() => {
  try {
    const currentUrl = window.location.origin + '/';
    targetUrl.value = currentUrl;
  } catch (error) {
    maLogger.log('无法自动设置当前页面URL:', error);
  }
});
</script>

<style scoped>
.hidden-path-scanner {
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

header {
  margin-bottom: 20px;
  text-align: center;
}

header h1 {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  color: #303133;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 0.9rem;
}

.content {
  max-width: 900px;
  margin: 0 auto;
}

.control-panel {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.control-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.target-settings {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.target-settings .el-input {
  flex: 1;
  min-width: 200px;
}

.dictionary-options {
  margin-bottom: 15px;
}

.dictionary-options .el-checkbox {
  margin-right: 15px;
  margin-bottom: 5px;
}

.custom-paths {
  margin-bottom: 15px;
}

.custom-paths textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  resize: vertical;
}

.scan-settings {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.scan-status {
  margin-top: 15px;
}

.progress-container {
  margin-bottom: 10px;
}

.status-text {
  margin: 0;
  font-size: 0.9rem;
  color: #606266;
}

.results-container {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 500;
  color: #303133;
}

.results-list {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background-color: #fff;
}

.result-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s;
}

.result-item:hover {
  background-color: #f5f7fa;
}

.result-item:last-child {
  border-bottom: none;
}

.result-header {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.result-icon {
  font-size: 16px;
}

.result-path {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  color: #303133;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.result-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.result-code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #606266;
  font-size: 0.9rem;
}

.result-time {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #909399;
  font-size: 0.9rem;
}

.result-details {
  display: flex;
  gap: 15px;
  margin-top: 5px;
  font-size: 0.85rem;
  color: #606266;
}

.open-btn {
  margin-left: 10px;
}

.no-results {
  padding: 40px 20px;
  text-align: center;
}

/* 状态样式 */
.status-success .result-status {
  background-color: #f0f9eb;
  color: #67c23a;
}

.status-success .result-icon {
  color: #67c23a;
}

.status-redirect .result-status {
  background-color: #ecf5ff;
  color: #409eff;
}

.status-redirect .result-icon {
  color: #409eff;
}

.status-error .result-status {
  background-color: #fef0f0;
  color: #f56c6c;
}

.status-error .result-icon {
  color: #f56c6c;
}

.instructions {
  margin-top: 30px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 8px;
  border-left: 4px solid #409eff;
}

.instructions h3 {
  margin: 0 0 10px 0;
  font-size: 1.1rem;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.instructions ul {
  margin: 0;
  padding-left: 25px;
}

.instructions li {
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
}

footer {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e4e7ed;
  text-align: center;
  color: #909399;
  font-size: 0.85rem;
}

/* 滚动条样式 */
.results-list::-webkit-scrollbar,
.custom-paths textarea::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.results-list::-webkit-scrollbar-track,
.custom-paths textarea::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.results-list::-webkit-scrollbar-thumb,
.custom-paths textarea::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.results-list::-webkit-scrollbar-thumb:hover,
.custom-paths textarea::-webkit-scrollbar-thumb:hover {
  background: #909399;
}

@media (max-width: 768px) {
  .control-buttons {
    flex-direction: column;
  }

  .control-buttons .el-button {
    width: 100%;
  }

  .target-settings {
    flex-direction: column;
    align-items: stretch;
  }

  .target-settings .el-button {
    margin-left: 0 !important;
    margin-top: 10px;
  }

  .result-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .result-details {
    flex-direction: column;
    gap: 5px;
  }
}
</style>