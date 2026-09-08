<template>
  <div class="card">
    <h2 class="card-title"><span class="icon">➕</span>{{ editId ? '编辑规则' : '添加修改规则' }}</h2>

    <div class="form-group">
      <label>URL匹配模式</label>
      <input v-model="form.urlPattern" placeholder="例如：https://api.example.com/data/*" />
      <p class="help-text">支持通配符 * 和正则表达式</p>
    </div>

    <div class="form-group">
      <label>响应类型</label>
      <div class="response-type">
        <label v-for="t in types" :key="t.value">
          <input v-model="form.responseType" type="radio" :value="t.value" />
          {{ t.label }}
        </label>
      </div>
    </div>

    <div class="form-group">
      <label>修改后的响应数据</label>
      <textarea v-model="form.responseData" :rows="8" />
    </div>

    <div class="checkbox-group">
      <input id="enableRule" v-model="form.enabled" type="checkbox" />
      <label for="enableRule">启用此规则</label>
    </div>

    <div class="btn-group">
      <el-button @click="submit">{{ editId ? '更新规则' : '添加规则' }}</el-button>
      <el-button @click="reset">清空表单</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watchEffect } from 'vue';

const props = defineProps({
  editId: { type: [Number, null], default: null },
  rule: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['submit', 'reset']);

const types = [
  { value: 'json', label: 'JSON 数据' },
  { value: 'text', label: '文本/HTML' },
  { value: 'xml', label: 'XML 数据' }
];

const form = reactive({
  urlPattern: '',
  responseType: 'json',
  responseData: '',
  enabled: true
});

watchEffect(() => {
  // 当父组件把 rule 传进来时回填
  if (props.rule && props.editId) {
    Object.assign(form, props.rule);
  } else {
    reset();
  }
});

function submit() {
  // JSON 校验
  if (form.responseType === 'json') {
    try { JSON.parse(form.responseData); }
    catch (e) {
      if (!confirm('不是有效 JSON，仍要保存吗？')) {return;}
    }
  }
  emit('submit', { ...form, id: props.editId });
  reset();
}

function reset() {
  Object.assign(form, {
    urlPattern: '',
    responseType: 'json',
    responseData: '',
    enabled: true
  });
  emit('reset');
}
</script>

<style scoped>
/* 使用全局定义的CSS变量 */

.card {
  background: var(--bg-card) !important;
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  padding: 25px;
  margin-bottom: 25px;
  border: 1px solid var(--border-color);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.4rem;
  color: var(--primary-light);
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-light);
}

.card-title .icon {
  background: rgba(22, 93, 255, 0.15);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  color: var(--primary-light);
}

.form-group {
  margin-bottom: 22px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.input-group {
  position: relative;
}

input,
textarea,
select {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: inherit;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: 0 0 0 3px rgba(22, 93, 255, 0.2);
}

textarea {
  min-height: 120px;
  resize: vertical;
  font-family: 'Fira Code', 'Consolas', monospace;
  line-height: 1.5;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.checkbox-group input {
  width: auto;
}

.btn-group {
  display: flex;
  gap: 15px;
  margin-top: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
  flex: 1;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.btn-secondary {
  background: var(--secondary);
  color: white;
}

.btn-secondary:hover {
  background: #2e8b46;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
}

.btn-outline:hover {
  background: rgba(66, 133, 244, 0.1);
}

.rules-container {
  margin-top: 20px;
}

.empty-state {
  text-align: center;
  padding: 30px;
  color: var(--gray);
}

.empty-state .icon {
  font-size: 3.5rem;
  color: #e8eaed;
  margin-bottom: 15px;
}

.rule-item {
  background: #f8fbff;
  border-left: 4px solid var(--primary);
  padding: 20px;
  margin-bottom: 15px;
  border-radius: 0 8px 8px 0;
  position: relative;
  transition: all 0.3s;
  border: 1px solid #e3eeff;
}

.rule-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(66, 133, 244, 0.15);
}

.rule-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
  align-items: center;
}

.rule-title {
  font-weight: 600;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
}

.rule-title .status {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--secondary);
}

.rule-title .status.inactive {
  background: var(--danger);
}

.rule-actions {
  display: flex;
  gap: 8px;
}

.rule-actions button {
  background: rgba(66, 133, 244, 0.1);
  color: var(--primary);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rule-actions button:hover {
  background: var(--primary);
  color: white;
}

.rule-details {
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
}

@media (min-width: 768px) {
  .rule-details {
    grid-template-columns: 1fr 1fr;
  }
}

.rule-detail {
  background: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.rule-detail h4 {
  margin-bottom: 10px;
  color: var(--gray);
  font-size: 0.9rem;
  font-weight: 600;
}

.rule-content {
  font-family: 'Fira Code', 'Consolas', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.9rem;
  line-height: 1.5;
  max-height: 150px;
  overflow: auto;
  padding: 5px;
  background: #fafafa;
  border-radius: 4px;
}

.tabs {
  display: flex;
  margin-bottom: 25px;
  border-bottom: 1px solid var(--border);
}

.tab {
  padding: 12px 25px;
  cursor: pointer;
  font-weight: 600;
  color: var(--gray);
  transition: all 0.3s;
  position: relative;
}

.tab.active {
  color: var(--primary);
}

.tab.active:after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--primary);
  border-radius: 3px 3px 0 0;
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

.response-type {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.response-type label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
  padding: 10px 15px;
  border-radius: 8px;
  border: 1px solid var(--border);
  flex: 1;
  transition: all 0.2s;
}

.response-type input[type="radio"] {
  width: auto;
  margin: 0;
}

.response-type label:hover {
  border-color: var(--primary);
}

.response-type input:checked+label {
  border-color: var(--primary);
  background: rgba(66, 133, 244, 0.08);
}
</style>