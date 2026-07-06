<template>
  <div class="common-layout">
    <div class="header">
      <h1>XHR响应修改器</h1>
      <p class="subtitle">Chrome扩展 - 拦截并修改XMLHttpRequest响应数据</p>
    </div>

    <div class="main-content">
      <div class="tabs">
        <div :class="['tab', activeTab === 'rules' && 'active']" @click="activeTab = 'rules'">规则管理</div>
        <div :class="['tab', activeTab === 'whitelist' && 'active']" @click="activeTab = 'whitelist'">域名白名单</div>
        <div :class="['tab', activeTab === 'test' && 'active']" @click="activeTab = 'test'">测试工具</div>
      </div>

      <!-- 规则管理页 -->
      <div v-show="activeTab === 'rules'">
        <RuleForm :edit-id="editId" :rule="editableRule" @submit="handleSubmit"
          @reset="resetEditableRule" />
        <RuleList :rules="rules" @toggle="toggleRule" @edit="editRule" @delete="deleteRule" />
      </div>

      <!-- 域名白名单页 -->
      <div v-show="activeTab === 'whitelist'" class="whitelist-container">
        <h3>域名白名单</h3>
        <div class="whitelist-desc">
          <p>只有在白名单中的域名才会启用XHR补丁。支持的格式：</p>
          <ul>
            <li>精确匹配：<code>example.com</code> - 仅匹配 example.com</li>
            <li>通配符：<code>*</code> - 匹配所有域名</li>
            <li>子域名匹配：<code>*.example.com</code> - 匹配 example.com 及其所有子域名</li>
          </ul>
        </div>
        
        <div class="whitelist-form">
          <input 
            v-model="newDomain"
            type="text" 
            placeholder="输入域名（例如：example.com 或 *.example.com）"
            class="domain-input"
          />
          <button @click="addDomain" class="add-btn">添加</button>
        </div>
        
        <div class="whitelist-list">
          <div v-if="whitelist.length === 0" class="empty-state">
            暂无白名单域名，添加域名后补丁才会生效
          </div>
          <div v-for="(domain, index) in whitelist" :key="index" class="whitelist-item">
            <code>{{ domain }}</code>
            <button @click="removeDomain(index)" class="remove-btn">删除</button>
          </div>
        </div>
      </div>

      <!-- 测试工具页 -->
      <TestTool v-show="activeTab === 'test'" />
    </div>

    <div class="footer">
      <p>Chrome Manifest V3 扩展 | XHR响应修改器 v1.0</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { RuleForm, RuleList, TestTool } from '@components/index'
import { Rule } from '@/types/components/index'

const activeTab = ref('rules')
const rules = ref<Rule[]>([])
const editId = ref<number | null>(null)
const editableRule = reactive({})

// 域名白名单相关
const whitelist = ref<string[]>([])
const newDomain = ref('')

// 存储键名
const RULES_KEY = 'mria_xhr_rules'
const WHITELIST_KEY = 'mria_xhr_whitelist'

// 组件挂载时加载数据
onMounted(() => {
  loadRules()
  loadWhitelist()
})

// 从localStorage加载规则
function loadRules() {
  try {
    const storedRules = localStorage.getItem(RULES_KEY)
    if (storedRules) {
      rules.value = JSON.parse(storedRules)
    } else {
      // 默认规则
      const defaultRule = {
        id: Date.now(),
        urlPattern: 'https://jsonplaceholder.typicode.com/todos/*',
        responseData: JSON.stringify({ id: 1, title: 'Modified by XHR Interceptor', completed: true, userId: 1 }, null, 2),
        responseType: 'json',
        enabled: true
      }
      rules.value = [defaultRule]
      saveRules()
    }
  } catch (error) {
    maLogger.error('加载规则失败:', error)
  }
}

// 从localStorage加载白名单
function loadWhitelist() {
  try {
    const storedWhitelist = localStorage.getItem(WHITELIST_KEY)
    if (storedWhitelist) {
      whitelist.value = JSON.parse(storedWhitelist)
    }
  } catch (error) {
    maLogger.error('加载白名单失败:', error)
  }
}

// 保存规则到localStorage
function saveRules() {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules.value))
    notifyContentScript('MRIA_XHR_UPDATE_RULES', { rules: rules.value })
  } catch (error) {
    maLogger.error('保存规则失败:', error)
  }
}

// 保存白名单到localStorage
function saveWhitelist() {
  try {
    localStorage.setItem(WHITELIST_KEY, JSON.stringify(whitelist.value))
    notifyContentScript('MRIA_XHR_UPDATE_WHITELIST', { whitelist: whitelist.value })
  } catch (error) {
    maLogger.error('保存白名单失败:', error)
  }
}

// 通知content script更新数据
function notifyContentScript(type: string, data: { [key: string]: any | (string | number | boolean) }) {
  if (chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id as number, { type, ...data })
      }
    })
  }
}

// 处理规则提交
function handleSubmit(rule: Rule) {
  const idx = rules.value.findIndex(r => r.id === rule.id)
  if (idx > -1) {
    rules.value.splice(idx, 1, rule)
  } else {
    rules.value.push({ ...rule, id: Date.now() })
  }
  editId.value = null
  resetEditableRule()
  saveRules()
}

// 切换规则启用状态
function toggleRule(id: number) {
  const rule = rules.value.find(r => r.id === id)
  if (rule) {
    rule.enabled = !rule.enabled
  }
  saveRules()
}

// 编辑规则
function editRule(rule: Rule) {
  editId.value = rule.id
  Object.assign(editableRule, rule)
}

function resetEditableRule() {
  editId.value = null
  Object.keys(editableRule).forEach((key) => {
    delete editableRule[key as keyof typeof editableRule]
  })
}

// 删除规则
function deleteRule(id: number) {
  rules.value = rules.value.filter(r => r.id !== id)
  saveRules()
}

// 添加域名到白名单
function addDomain() {
  const domain = newDomain.value.trim()
  if (domain && !whitelist.value.includes(domain as string)) {
    whitelist.value.push(domain as string)
    saveWhitelist()
    newDomain.value = ''
  }
}

// 从白名单中删除域名
function removeDomain(index: number) {
  whitelist.value.splice(index, 1)
  saveWhitelist()
}
</script>

<style scoped>
/* ---------- 布局 ---------- */
.common-layout {
  font-family: inherit;
  color: var(--text-primary);
  background: var(--bg-primary);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ---------- 头部 ---------- */
.header {
  background: var(--gradient-primary);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
  border-bottom: 1px solid var(--border-color);
}

.header h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: 1px;
  color: white;
}

.subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  opacity: .9;
  color: rgba(255, 255, 255, 0.9);
}

/* ---------- 主体 ---------- */
.main-content {
  flex: 1;
  padding: 24px;
  background: var(--bg-primary);
  overflow-y: visible;
}

/* ---------- 标签页 ---------- */
.tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 2px solid var(--border-color);
}

.tab {
  padding: 10px 18px;
  cursor: pointer;
  font-size: 15px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  position: relative;
}

.tab:hover {
  color: var(--primary-light);
  background: var(--bg-hover);
  border-radius: 6px;
}

.tab.active {
  color: var(--primary-light);
  font-weight: 600;
}

.tab.active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 2px;
  background: var(--primary-light);
  box-shadow: var(--glow-primary);
}

/* ---------- 域名白名单样式 ---------- */
.whitelist-container {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.whitelist-container h3 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 20px;
  color: var(--text-primary);
}

.whitelist-desc {
  background: var(--bg-info);
  border: 1px solid var(--border-info);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.whitelist-desc p {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.whitelist-desc ul {
  margin: 0;
  padding-left: 20px;
}

.whitelist-desc li {
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.whitelist-desc code {
  background: var(--bg-code);
  color: var(--text-code);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.whitelist-form {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  align-items: stretch;
}

.domain-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color var(--transition-fast);
}

.domain-input:focus {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.add-btn {
  padding: 12px 24px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.add-btn:hover {
  background: var(--primary-light);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.add-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.whitelist-list {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.whitelist-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  transition: background-color var(--transition-fast);
}

.whitelist-item:last-child {
  border-bottom: none;
}

.whitelist-item:hover {
  background: var(--bg-hover);
}

.whitelist-item code {
  background: var(--bg-code);
  color: var(--text-code);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
  word-break: break-all;
}

.remove-btn {
  padding: 6px 12px;
  background: var(--bg-error);
  color: var(--text-error);
  border: 1px solid var(--border-error);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.remove-btn:hover {
  background: var(--error);
  color: white;
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

/* ---------- 底部 ---------- */
.footer {
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 10px 0;
  border-top: 1px solid var(--border-color);
}
</style>
