<template>
  <div class="script-runner">
    <header>
      <h1><el-icon class="el-icon-document"></el-icon>自动化工具</h1>
    </header>

    <div class="content">
      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="control-buttons">
          <el-button type="primary" :loading="running" @click="executeScript">
            <el-icon v-if="!running" class="el-icon-play"></el-icon>
            <el-icon v-else class="el-icon-loading"></el-icon>
            {{ running ? '执行中...' : '执行脚本' }}
          </el-button>
          <el-button @click="clearScript">
            <el-icon class="el-icon-delete"></el-icon> 清空
          </el-button>
          <el-button :disabled="!outputText" @click="copyResult">
            <el-icon class="el-icon-copy-document"></el-icon> 复制结果
          </el-button>
        </div>
      </div>

      <!-- 标签页切换 -->
      <div class="tab-container">
        <el-tabs v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane label="代码输入" name="code">
            <div class="script-input-container">
              <div class="section-header">
                <el-icon class="el-icon-edit"></el-icon>
                <span>JavaScript代码</span>
              </div>
              <div class="code-editor">
                <textarea v-model="scriptCode"
                  placeholder="在这里输入JavaScript代码...\n\n// 可以访问当前页面的DOM\n// 示例: maLogger.log('Hello World!');\n// 示例: document.title = '修改后的标题';"
                  rows="10" :readonly="running"></textarea>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="文件上传" name="file">
            <div class="file-upload-container">
              <div class="section-header">
                <el-icon class="el-icon-upload"></el-icon>
                <span>本地脚本文件</span>
              </div>
              <div class="upload-area">
                <el-upload class="upload-demo" action="" :auto-upload="false" :on-change="handleFileChange"
                  :show-file-list="false" accept=".js">
                  <el-button type="primary">
                    <el-icon class="el-icon-upload2"></el-icon> 选择JS文件
                  </el-button>
                </el-upload>
                <div v-if="fileInfo" class="file-info">
                  <el-icon class="el-icon-document"></el-icon>
                  <span>{{ fileInfo.name }}</span>
                  <el-button size="small" type="text" @click="clearFile">清除</el-button>
                </div>
                <div v-else class="upload-hint">
                  请选择本地JavaScript文件
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="网络脚本" name="url">
            <div class="url-script-container">
              <div class="section-header">
                <el-icon class="el-icon-link"></el-icon>
                <span>网络脚本URL</span>
              </div>
              <div class="url-input-area">
                <el-input v-model="scriptUrl" placeholder="输入网络脚本URL..." :disabled="running">
                  <template #append>
                    <el-button :disabled="!scriptUrl || running" @click="loadUrlScript">
                      <el-icon class="el-icon-download"></el-icon> 加载
                    </el-button>
                  </template>
                </el-input>
                <div v-if="urlInfo" class="url-info">
                  <el-icon class="el-icon-check"></el-icon>
                  <span>已加载: {{ urlInfo.url }}</span>
                  <el-button size="small" type="text" @click="clearUrl">清除</el-button>
                </div>
                <div v-else-if="scriptUrl" class="url-hint">
                  点击加载按钮获取脚本内容
                </div>
                <div v-else class="url-hint">
                  请输入网络脚本URL
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- 输出结果区域 -->
      <div class="output-container">
        <div class="section-header">
          <el-icon class="el-icon-monitor"></el-icon>
          <span>执行结果</span>
        </div>
        <div class="output-content">
          <pre v-if="outputText" class="output-text">{{ outputText }}</pre>
          <div v-else class="no-output">暂无输出</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { injectScriptToActivateTab } from '@/utils/element-control';
import { TabPaneName } from 'element-plus';
import message from '@/message/index.js';

const ext = message.ext;

// 响应式数据
const activeTab = ref<TabPaneName>('code'); // 标签页：code, file, url
const scriptCode = ref('');
const outputText = ref('');
const running = ref(false);
const scriptUrl = ref('');
const fileInfo = ref<{ name: string; size: number } | null>(null);
const urlInfo = ref<{ url: string } | null>(null);

const emit = defineEmits(['add-message']);

// 执行脚本
async function executeScript() {
  let codeToExecute = '';

  switch (activeTab.value) {
    case 'code':
      if (!scriptCode.value.trim()) {
        emit('add-message', {
          message: '请输入JavaScript代码',
          type: 'warning'
        });
        return;
      }
      codeToExecute = scriptCode.value;
      break;
    case 'file':
      if (!fileInfo.value) {
        emit('add-message', {
          message: '请选择本地JavaScript文件',
          type: 'warning'
        });
        return;
      }
      codeToExecute = scriptCode.value;
      break;
    case 'url':
      if (!urlInfo.value) {
        emit('add-message', {   
          message: '请加载网络脚本',
          type: 'warning'
        });
        return;
      }
      codeToExecute = scriptCode.value;
      break;
  }

  running.value = true;
  outputText.value = '';

  try {
    // 直接执行脚本
    injectScriptToActivateTab({scriptStr: codeToExecute});

    // 显示执行成功信息
    outputText.value = '脚本已开始执行，请在控制台查看输出';
    emit('add-message', {
      type: 'success',
      message: '脚本执行开始'
    });
  } catch (error: any) {
    // 捕获执行错误
    outputText.value = `执行错误: ${error.message}\n${error.stack || ''}`;
    emit('add-message', {
      type: 'error',
      message: '脚本执行出错'
    });
  } finally {
    running.value = false;
  }
}

// 清空脚本
function clearScript() {
  scriptCode.value = '';
  outputText.value = '';
  fileInfo.value = null;
  urlInfo.value = null;
  scriptUrl.value = '';
  emit('add-message', {
    type: 'info',
    message: '已清空'
  });
}

// 复制结果
function copyResult() {
  if (outputText.value) {
    navigator.clipboard.writeText(outputText.value).then(() => {
      emit('add-message', {
        type: 'success',
        message: '结果已复制到剪贴板'
      });
    }).catch(() => {
      emit('add-message', {
        type: 'error',
        message: '复制失败'
      });
    });
  }
}

// 标签页切换
function handleTabChange(name: TabPaneName) {
  activeTab.value = name;
}

// 处理文件选择
function handleFileChange(file: any) {
  const selectedFile = file.raw;
  if (selectedFile) {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      scriptCode.value = e.target?.result as string;
      fileInfo.value = {
        name: selectedFile.name,
        size: selectedFile.size
      };
      emit('add-message', {
        type: 'success',
        message: '文件读取成功'
      });
    };
    reader.onerror = () => {
      emit('add-message', {
        type: 'error',
        message: '文件读取失败'
      });
    };
    reader.readAsText(selectedFile);
  }
}

// 清除文件
function clearFile() {
  fileInfo.value = null;
  scriptCode.value = '';
}

// 加载网络脚本
async function loadUrlScript() {
  if (!scriptUrl.value.trim()) {
    emit('add-message', {
      type: 'warning',
      message: '请输入网络脚本URL'
    });
    return;
  }

  running.value = true;

  try {
    // 使用脚本执行服务加载网络脚本，绕过 CORS 限制
    const response = await ext.send({
      type: 'LOAD_URL_SCRIPT',
      payload: { url: scriptUrl.value },
      target: 'background'
    });

    if (!response.success) {
      throw new Error(response.error || '加载网络脚本失败');
    }

    const scriptContent = response.result;

    maLogger.log('加载的网络脚本内容:', scriptContent);
    scriptCode.value = scriptContent;
    urlInfo.value = {
      url: scriptUrl.value
    };
    emit('add-message', {
      type: 'success',
      message: '网络脚本加载成功'
    });
  } catch (error: any) {
    emit('add-message', {
      type: 'error',
      message: `网络脚本加载失败: ${error.message}`
    });
  } finally {
    running.value = false;
  }
}

// 清除URL
function clearUrl() {
  urlInfo.value = null;
  scriptUrl.value = '';
  scriptCode.value = '';
}
</script>

<style scoped>
.script-runner {
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

header {
  margin-bottom: 24px;
  text-align: center;
  color: #303133;
  padding: 20px;
  border-radius: 8px;
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.content {
  max-width: 800px;
  margin: 0 auto;
}

.control-panel {
  margin-bottom: 20px;
}

.control-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tab-container {
  margin-bottom: 20px;
}

.script-input-container,
.file-upload-container,
.url-script-container,
.output-container {
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

.code-editor,
.output-content {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
}

textarea {
  width: 100%;
  padding: 12px;
  border: none;
  outline: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  resize: vertical;
  background-color: #fafafa;
}

textarea:readonly {
  background-color: #f5f7fa;
  cursor: not-allowed;
}

.upload-area {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 20px;
  background-color: #fafafa;
}

.file-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-hint {
  margin-top: 10px;
  color: #909399;
  font-size: 0.9rem;
}

.url-input-area {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 20px;
  background-color: #fafafa;
}

.url-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.url-hint {
  margin-top: 10px;
  color: #909399;
  font-size: 0.9rem;
}

.output-content {
  min-height: 200px;
  background-color: #fafafa;
  position: relative;
}

.output-text {
  margin: 0;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: #303133;
  max-height: 400px;
  overflow-y: auto;
}

.no-output {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #909399;
  font-style: italic;
}

/* 滚动条样式 */
.output-text::-webkit-scrollbar,
textarea::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.output-text::-webkit-scrollbar-track,
textarea::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.output-text::-webkit-scrollbar-thumb,
textarea::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.output-text::-webkit-scrollbar-thumb:hover,
textarea::-webkit-scrollbar-thumb:hover {
  background: #909399;
}

/* 标签页样式 */
:deep(.el-tabs__header) {
  margin-bottom: 20px;
}

:deep(.el-tab-pane) {
  padding: 0;
}
</style>