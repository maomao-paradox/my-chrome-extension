<template>
  <div class="xhr-patch-container fade-in">
    <!-- 标题和操作栏 -->
    <div class="header-section">
      <h1>XHR补丁管理</h1>
      <p class="subtitle">控制和监控页面的XHR请求拦截规则</p>

      <!-- 状态指示器 -->
      <div class="status-indicator" :class="{ 'active': isXhrEnabled && isXhrPatched }">
        <div class="status-dot"></div>
        <span>
          {{ isXhrEnabled && isXhrPatched ? 'XHR补丁已启用并应用规则' : isXhrEnabled ? 'XHR补丁已启用但未应用规则' : 'XHR补丁已禁用' }}
        </span>
      </div>
    </div>

    <!-- 操作按钮组 -->
    <div class="action-buttons">
      <button class="btn btn-primary" :disabled="isLoading" @click="refreshRules">
        <span class="btn-icon">🔄</span>
        刷新规则
      </button>
      <button class="btn btn-secondary" :disabled="isLoading" @click="addNewRule">
        <span class="btn-icon">➕</span>
        添加规则
      </button>
      <button class="btn btn-danger" :disabled="isLoading || rules.length === 0" @click="clearAllRules">
        <span class="btn-icon">🗑️</span>
        清空规则
      </button>
      <button class="btn btn-outline" :disabled="isLoading" @click="toggleXhrPatch">
        <span class="btn-icon">{{ isXhrEnabled ? '🚫' : '✅' }}</span>
        {{ isXhrEnabled ? '禁用补丁' : '启用补丁' }}
      </button>
    </div>

    <!-- 规则列表 -->
    <div class="rules-section">
      <div class="section-header">
        <h2>当前规则 ({{ rules.length }})</h2>
        <div class="search-box">
          <input v-model="searchQuery" type="text" placeholder="搜索规则路径..." class="search-input" />
          <span class="search-icon">🔍</span>
        </div>
      </div>

      <!-- 规则为空时的提示 -->
      <div v-if="filteredRules.length === 0 && !isLoading" class="empty-state">
        <div class="empty-icon">🌐</div>
        <p>暂无规则配置</p>
        <button class="btn btn-sm btn-outline" @click="addNewRule">添加第一条规则</button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在获取规则...</p>
      </div>

      <!-- 规则列表 -->
      <div v-else class="rules-list">
        <div v-for="(rule, index) in filteredRules" :key="rule.api" class="rule-card">
          <!-- 规则头部 -->
          <div class="rule-header">
            <div class="rule-path">
              <span class="path-icon">📡</span>
              <span class="path-text">{{ rule.api }}</span>
            </div>
            <div class="rule-actions">
              <button class="btn-icon-small" title="编辑规则" @click="editRule(rule, index)">
                ✏️
              </button>
              <button class="btn-icon-small" title="删除规则" @click="deleteRule(rule.api!)">
                ❌
              </button>
            </div>
          </div>

          <!-- 规则详情 -->
          <div class="rule-details">
            <div v-if="rule.openRules && rule.openRules.length > 0" class="handler-item">
              <span class="handler-label">Open处理器:</span>
              <span class="handler-status active">{{ rule.openRules.length }}个子规则</span>
            </div>
            <div v-if="rule.sendRules && rule.sendRules.length > 0" class="handler-item">
              <span class="handler-label">Send处理器:</span>
              <span class="handler-status active">{{ rule.sendRules.length }}个子规则</span>
            </div>
            <div v-if="rule.responseRules && rule.responseRules.length > 0" class="handler-item">
              <span class="handler-label">响应拦截:</span>
              <span class="handler-status active">{{ rule.responseRules.length }}个子规则</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑规则对话框 -->
    <div v-if="showRuleDialog" class="dialog-overlay" @click.self="closeRuleDialog">
      <div class="rule-dialog">
        <div class="dialog-header">
          <h3>{{ isEditing ? '编辑规则' : '添加规则' }}</h3>
          <button class="close-btn" @click="closeRuleDialog">×</button>
        </div>

        <div class="dialog-content">
          <div class="form-group">
            <label for="rulePath">API路径:</label>
            <input id="rulePath" v-model="currentRule.api" type="text" placeholder="例如: /api/get_hospital_list"
              class="form-input" required />
          </div>

          <!-- Open处理器子规则 -->
          <HandlerSection handler-type="open" title="Open处理器 (修改请求参数)" :sub-rules="currentRule.openRules || []"
            @add-sub-rule="addSubRule" @remove-sub-rule="removeSubRule" />

          <!-- Send处理器子规则 -->
          <HandlerSection handler-type="send" title="Send处理器 (修改请求体)" :sub-rules="currentRule.sendRules || []"
            @add-sub-rule="addSubRule" @remove-sub-rule="removeSubRule" />

          <!-- 响应拦截器子规则 -->
          <HandlerSection handler-type="response" title="响应拦截器 (修改响应数据)" :sub-rules="currentRule.responseRules || []"
            @add-sub-rule="addSubRule" @remove-sub-rule="removeSubRule" />
        </div>

        <div class="dialog-footer">
          <button class="btn btn-outline" @click="closeRuleDialog">取消</button>
          <button class="btn btn-primary" :disabled="!currentRule.api" @click="saveRule">保存规则</button>
        </div>
      </div>
    </div>

    <!-- 确认对话框 -->
    <MRDialog v-model:visible="showConfirmDialog" title="确认操作" :closable="false" :close-on-click-overlay="false"
      cancel-text="取消" confirm-text="确认" dialog-class="confirm-dialog" @cancel="closeConfirmDialog"
      @confirm="confirmAction">
      <div class="dialog-content">
        <p>{{ confirmMessage }}</p>
      </div>
    </MRDialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import SubRule from '../../../assets/components/SubRule.vue';
import MRDialog from '../../../assets/components/MRDialog.vue';
import HandlerSection from '../../../assets/components/HandlerSection.vue';
import type { XhrRulesArray, XhrRule, RuleInstruction } from '@/types/index.js';

// 响应式数据
const isLoading = ref(false);
const isXhrPatched = ref(false); // 是否已应用补丁（技术状态）
const isXhrEnabled = ref(false); // 是否启用补丁（逻辑开关）
const rules = ref<XhrRulesArray>([]);
const searchQuery = ref('');
const showRuleDialog = ref(false);
const showConfirmDialog = ref(false);
const confirmMessage = ref('');
const confirmActionCallback = ref<() => void>(() => { });
const isEditing = ref(false);
const currentRuleIndex = ref(-1);

// 当前编辑的规则
const currentRule = ref<XhrRule>({
  api: '',
  openRules: [],
  sendRules: [],
  responseRules: []
});

// 计算过滤后的规则列表
const filteredRules = computed((): XhrRulesArray => {
  // 添加详细日志，检查过滤前后规则对象的完整结构
  if (!searchQuery.value.trim()) {
    maLogger.log('搜索框为空，返回原始规则列表');
    return rules.value;
  }

  const query = searchQuery.value.toLowerCase();

  // 在过滤前打印规则对象的完整结构
  maLogger.log('过滤前的原始规则:', JSON.stringify(rules.value, null, 2));

  // 过滤规则，并使用深拷贝确保保留所有属性
  const result = rules.value.filter((rule: XhrRule) => rule.api?.toLowerCase().includes(query));

  // 打印过滤后的规则结构
  maLogger.log('过滤后的规则:', JSON.stringify(result, null, 2));
  return result;
});

// 向内容脚本发送消息的通用函数
import { sendMessageToContentScript } from '@/message/back-content';

// 初始化时和手动刷新规则
async function refreshRules() {
  try {
    isLoading.value = true;
    const response = await sendMessageToContentScript({ type: 'MRIA_XHR_GET_STATUS' });

    maLogger.log('GET_XHR_RULES 获取到的原始响应:', response);

    if (response.success) {
      const data = response.data;
      // 更新完整的状态信息
      isXhrEnabled.value = data.isEnabled !== undefined ? data.isEnabled : false;
      isXhrPatched.value = data.isPatched !== undefined ? data.isPatched : false;

      // 转换规则格式
      const newRules: XhrRule[] = [];
      if (data.rules) {
        for (const [api, ruleObj] of Object.entries(data.rules)) {
          // 创建包含所有必要属性的规则对象，确保结构完整性
          const rule: XhrRule = {
            api,
            ...JSON.parse(JSON.stringify(ruleObj))
          };
          newRules.push(rule);
        }
      };

      rules.value = newRules;
      maLogger.log('刷新后的规则列表:', rules.value);
    }
  } catch (error) {
    maLogger.error('获取XHR规则失败:', error);
    isXhrPatched.value = false;
    rules.value = [];
  } finally {
    isLoading.value = false;
  }
}

// 添加新规则
function addNewRule() {
  isEditing.value = false;
  currentRule.value = {
    api: '',
    openRules: [],
    sendRules: [],
    responseRules: []
  };
  showRuleDialog.value = true;
}

// 编辑规则
function editRule(rule: XhrRule, index: number) {
  maLogger.log('正在编辑规则', rule);
  isEditing.value = true;
  currentRuleIndex.value = index;
  currentRule.value = {
    api: rule.api
  };
  if (rule.openRules && rule.openRules.length > 0) {
    currentRule.value.openRules = JSON.parse(JSON.stringify(rule.openRules));
  }
  if (rule.sendRules && rule.sendRules.length > 0) {
    currentRule.value.sendRules = JSON.parse(JSON.stringify(rule.sendRules));
  }
  if (rule.responseRules && rule.responseRules.length > 0) {
    currentRule.value.responseRules = JSON.parse(JSON.stringify(rule.responseRules));
  }
  showRuleDialog.value = true;
}

// 关闭规则对话框
function closeRuleDialog() {
  showRuleDialog.value = false;
  // 重置表单
  setTimeout(() => {
    currentRule.value = {
      api: '',
      openRules: [],
      sendRules: [],
      responseRules: []
    };
  }, 300);
}

// 添加子规则
function addSubRule(handlerType: 'open' | 'send' | 'response') {
  const defaultSubRule: RuleInstruction = {
    type: handlerType === 'open' ? 'replaceUrl' : 'setField'
  };

  if (handlerType === 'open') {
    if (!currentRule.value.openRules) {
      currentRule.value.openRules = [];
    }
    currentRule.value.openRules.push(defaultSubRule);
  } else if (handlerType === 'send') {
    if (!currentRule.value.sendRules) {
      currentRule.value.sendRules = [];
    }
    currentRule.value.sendRules.push(defaultSubRule);
  } else if (handlerType === 'response') {
    if (!currentRule.value.responseRules) {
      currentRule.value.responseRules = [];
    }
    currentRule.value.responseRules.push(defaultSubRule);
  }
}

// 移除子规则
function removeSubRule(handlerType: 'open' | 'send' | 'response', index: number) {
  if (handlerType === 'open' && currentRule.value.openRules) {
    currentRule.value.openRules.splice(index, 1);
  } else if (handlerType === 'send' && currentRule.value.sendRules) {
    currentRule.value.sendRules.splice(index, 1);
  } else if (handlerType === 'response' && currentRule.value.responseRules) {
    currentRule.value.responseRules.splice(index, 1);
  }
}

// 保存单条规则
async function saveRule() {
  if (!currentRule.value.api) {return;}

  try {
    isLoading.value = true;

    // 构建规则对象
    const newXhrRule: XhrRule = JSON.parse(JSON.stringify(currentRule.value));
    if (newXhrRule.openRules?.length === 0) {
      delete newXhrRule.openRules;
    }
    if (newXhrRule.sendRules?.length === 0) {
      delete newXhrRule.sendRules;
    }
    if (newXhrRule.responseRules?.length === 0) {
      delete newXhrRule.responseRules;
    }

    // 发送保存规则的消息
    const response = await sendMessageToContentScript({
      type: 'MRIA_XHR_UPDATE_RULES',
      payload: {
        [newXhrRule.api!]: newXhrRule
      }
    });

    if (response && response.success) {
      // 更新本地规则列表
      if (isEditing.value && currentRuleIndex.value >= 0) {
        // 如果是编辑模式，更新现有规则
        rules.value[currentRuleIndex.value] = newXhrRule;
      } else {
        // 如果是添加模式，添加新规则
        rules.value.push(newXhrRule);
      }

      closeRuleDialog();
    }
  } catch (error) {
    maLogger.error('保存规则失败:', error);
  } finally {
    isLoading.value = false;
  }
}

// 显示确认对话框
function showConfirm(message: string, callback: () => void) {
  confirmMessage.value = message;
  confirmActionCallback.value = callback;
  showConfirmDialog.value = true;
}

// 关闭确认对话框
function closeConfirmDialog() {
  showConfirmDialog.value = false;
}

// 确认操作
function confirmAction() {
  confirmActionCallback.value();
  closeConfirmDialog();
}

// 删除整条规则
function deleteRule(path: string) {
  showConfirm(`确定要删除规则 "${path}" 吗？`, async () => {
    try {
      isLoading.value = true;
      const response = await sendMessageToContentScript({
        type: 'DELETE_XHR_RULE',
        payload: path
      });

      if (response && response.success) {
        // 从本地列表中删除
        rules.value = rules.value.filter(rule => rule.api !== path);
      }
    } catch (error) {
      maLogger.error('删除规则失败:', error);
    } finally {
      isLoading.value = false;
    }
  });
}

// 清空所有规则
function clearAllRules() {
  showConfirm('确定要清空所有规则吗？此操作不可恢复。', async () => {
    try {
      isLoading.value = true;
      const response = await sendMessageToContentScript({
        type: 'CLEAR_XHR_RULES'
      });

      if (response && response.success) {
        rules.value = [];
      }
    } catch (error) {
      maLogger.error('清空规则失败:', error);
    } finally {
      isLoading.value = false;
    }
  });
}

// 切换XHR补丁状态
async function toggleXhrPatch() {
  try {
    // 乐观更新UI状态，立即反映用户操作
    const newState = !isXhrEnabled.value;
    isXhrEnabled.value = newState;

    isLoading.value = true;
    const response = await sendMessageToContentScript({
      type: 'TOGGLE_XHR_PATCH',
      payload: {
        enable: newState
      }
    });

    // 根据实际响应结果确认或回滚状态
    if (response && response.success) {
      // 更新完整的状态信息
      isXhrEnabled.value = response.isEnabled !== undefined ? response.isEnabled : newState;
      isXhrPatched.value = response.isPatched !== undefined ? response.isPatched : (newState && Object.keys(rules.value).length > 0);
    } else {
      // 如果操作失败，回滚UI状态
      isXhrEnabled.value = !newState;
    }
  } catch (error) {
    maLogger.error('切换XHR补丁状态失败:', error);
    // 发生错误时也回滚UI状态
    isXhrPatched.value = !isXhrPatched.value;
  } finally {
    isLoading.value = false;
  }
}

// 组件挂载时获取规则
onMounted(() => {
  refreshRules();
});
</script>

<style scoped>
.xhr-patch-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.3s ease-in-out;
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

.header-section {
  margin-bottom: 24px;
  text-align: center;
}

.header-section h1 {
  font-size: 22px;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #165DFF 0%, #4080FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.status-indicator.active {
  background: rgba(22, 93, 255, 0.1);
  border-color: var(--primary-light);
  box-shadow: var(--glow-primary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: all 0.3s ease;
}

.status-indicator.active .status-dot {
  background: var(--primary-color);
  box-shadow: 0 0 8px var(--primary-color);
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--shadow-md), var(--glow-primary);
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--bg-hover);
  border-color: var(--border-color);
  color: var(--primary-light);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(22, 93, 255, 0.15);
  border-color: var(--primary-light);
}

.btn-danger {
  background: rgba(255, 82, 82, 0.1);
  border-color: rgba(255, 82, 82, 0.3);
  color: #FF5252;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(255, 82, 82, 0.2);
  border-color: #FF5252;
}

.btn-outline {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--primary-light);
  color: var(--primary-light);
  background: var(--bg-hover);
}

.btn-icon {
  font-size: 14px;
}

.btn-icon-small {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.btn-icon-small:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.rules-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.section-header h2 {
  font-size: 18px;
  color: var(--text-primary);
}

.search-box {
  position: relative;
}

.search-input {
  padding: 8px 32px 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 14px;
  width: 200px;
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: var(--glow-primary);
}

.search-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  pointer-events: none;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.rules-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.rule-card:hover {
  border-color: var(--primary-light);
  box-shadow: var(--shadow-sm), var(--glow-primary);
  transform: translateY(-2px);
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.rule-path {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--text-primary);
  word-break: break-all;
}

.path-icon {
  font-size: 16px;
}

.path-text {
  font-family: 'Courier New', monospace;
  background: rgba(22, 93, 255, 0.08);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.rule-actions {
  display: flex;
  gap: 8px;
}

.rule-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.handler-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.handler-label {
  color: var(--text-secondary);
}

.handler-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.handler-status.active {
  background: rgba(46, 204, 113, 0.1);
  color: #2ECC71;
  border: 1px solid rgba(46, 204, 113, 0.3);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.rule-dialog,
.confirm-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dialog-content {
  padding: 20px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: var(--glow-primary);
}

.handler-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.handler-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.handler-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.subrules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subrule-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 16px;
  transition: all 0.3s ease;
}

.subrule-card:hover {
  border-color: var(--primary-light);
  box-shadow: var(--shadow-sm);
}

.subrule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.subrule-index {
  font-weight: 500;
  color: var(--primary-light);
  font-size: 14px;
}

.delete-subrule:hover {
  color: #FF5252 !important;
  background: rgba(255, 82, 82, 0.1) !important;
}

.subrule-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subrule-form-group {
  margin-bottom: 0;
}

.subrule-form-group label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: block;
}

.subrule-form-group select,
.subrule-form-group input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
}

.empty-subrules {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
  font-size: 14px;
  background: var(--bg-primary);
  border-radius: 6px;
  border: 2px dashed var(--border-color);
}

.empty-subrules p {
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 600px) {
  .handler-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .handler-header h4 {
    text-align: center;
  }

  .subrule-content {
    gap: 8px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

/* 滚动条样式 */
.rules-list::-webkit-scrollbar,
.dialog-content::-webkit-scrollbar {
  width: 6px;
}

.rules-list::-webkit-scrollbar-track,
.dialog-content::-webkit-scrollbar-track {
  background: var(--bg-primary);
  border-radius: 3px;
}

.rules-list::-webkit-scrollbar-thumb,
.dialog-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.rules-list::-webkit-scrollbar-thumb:hover,
.dialog-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .action-buttons {
    flex-direction: column;
  }

  .btn {
    justify-content: center;
  }

  .section-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .rule-actions {
    flex-direction: column;
  }
}
</style>
