<template>
  <div class="script-config-item">
    <div class="script-header">
      <h3>{{ scriptName }}</h3>
      <div class="enabled-toggle">
        <span class="toggle-label">{{ props.enabled ? '启用' : '禁用' }}</span>
        <label class="switch">
          <input type="checkbox" :checked="props.enabled" @change="handleEnabledChange">
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    <div class="domain-input-section">
      <input v-model="localDomainsString" type="text"
        placeholder="输入域名，多个域名用逗号分隔（例如：https://example.com,https://test.com）" 
        class="domain-input"
        :disabled="!props.enabled">
      <button class="el-button" @click="saveDomains" :disabled="!props.enabled">保存配置</button>
    </div>
    <div class="domain-hint">
      <p>当前配置的域名：</p>
      <div class="domain-list">
        <span v-for="domain in props.domainList" :key="domain" class="domain-tag">{{ domain }}</span>
        <span v-if="props.domainList.length === 0" class="domain-tag empty-tag">无</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

// 定义组件属性
const props = defineProps<{
  scriptName: string;
  storageKey: string;
  enabled: boolean;
  domainsString: string;
  domainList: string[];
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'update:enabled', storageKey: string, value: boolean): void;
  (e: 'update:domains-string', storageKey: string, value: string): void;
  (e: 'success', message: string): void;
  (e: 'error', message: string): void;
}>();

// 本地响应式数据
const localDomainsString = ref('');

// 处理启用状态变化
const handleEnabledChange = (event: Event) => {
  const enabled = (event.target as HTMLInputElement).checked;
  emit('update:enabled', props.storageKey, enabled);
  emit('success', `${props.scriptName}已${enabled ? '启用' : '禁用'}`);
};

// 保存域名配置
const saveDomains = async () => {
  try {
    // 发送更新事件给父组件
    emit('update:domains-string', props.storageKey, localDomainsString.value);
    emit('success', `${props.scriptName}域名配置保存成功`);
  } catch (error) {
    maLogger.error(`保存${props.scriptName}配置失败:`, error);
    emit('error', `保存${props.scriptName}配置失败`);
  }
};

// 监听domainsString变化，更新本地输入
watch(() => props.domainsString, (newValue) => {
  localDomainsString.value = newValue;
});

// 组件挂载时初始化本地输入
onMounted(() => {
  localDomainsString.value = props.domainsString;
});
</script>

<style scoped>
.script-config-item {
  margin-bottom: 30px;
  padding: 15px;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

.script-config-item:hover {
  border-color: var(--primary-light);
  box-shadow: var(--glow-secondary);
}

.script-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.script-header h3 {
  color: var(--text-primary);
  font-size: 16px;
  margin: 0;
  font-weight: 600;
}

.enabled-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 14px;
  color: var(--text-secondary);
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary-color);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--primary-color);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.slider.round {
  border-radius: 24px;
}

.slider.round:before {
  border-radius: 50%;
}

.domain-input-section {
  margin: 15px 0;
}

.domain-input {
  width: 60%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-right: 10px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  transition: all var(--transition-fast);
}

.domain-input:focus {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: var(--glow-primary);
}

.domain-input:disabled {
  background-color: var(--bg-tertiary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.domain-input::placeholder {
  color: var(--text-tertiary);
}

.domain-hint {
  margin-top: 10px;
}

.domain-hint p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 10px 0;
}

.domain-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
}

.domain-tag {
  background-color: var(--primary-color);
  background-image: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(22, 93, 255, 0.3);
  transition: all var(--transition-fast);
}

.domain-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.4);
}

.empty-tag {
  background-color: var(--bg-tertiary);
  background-image: none;
  color: var(--text-tertiary);
  box-shadow: none;
}

/* 适配el-button组件 */
.el-button {
  background-color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
  color: white !important;
  border-radius: 6px !important;
  padding: 8px 16px !important;
  font-size: 14px !important;
  transition: all var(--transition-fast) !important;
}

.el-button:hover:not(:disabled) {
  background-color: var(--primary-light) !important;
  border-color: var(--primary-light) !important;
  transform: translateY(-1px) !important;
  box-shadow: var(--glow-primary) !important;
}

.el-button:active:not(:disabled) {
  transform: translateY(0) !important;
}

.el-button:disabled {
  background-color: var(--bg-tertiary) !important;
  border-color: var(--border-color) !important;
  color: var(--text-tertiary) !important;
  cursor: not-allowed !important;
}
</style>