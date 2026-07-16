<template>
  <div class="subrule-card">
    <div class="subrule-header">
      <span class="subrule-index">#{{ index + 1 }}</span>
      <MRIconButton icon="🗑️" tooltip="删除子规则" variant="danger" @click="emit('remove')" />
    </div>

    <div class="subrule-content">
      <div class="form-group subrule-form-group">
        <label>操作类型:</label>
        <MRSelect v-model="subRule.type" :options="[
          { label: '替换URL', value: 'replaceUrl' },
          { label: '设置参数', value: 'setParam' },
          { label: '删除参数', value: 'deleteParam' },
          { label: '设置字段', value: 'setField' },
          { label: '删除字段', value: 'deleteField' },
          { label: '追加数组', value: 'appendArray' },
          { label: '设置状态码', value: 'setStatus' }
        ]" @change="handleTypeChange(subRule.type)" />
      </div>

      <!-- 替换URL特殊处理 -->
      <div v-if="subRule.type === 'replaceUrl'" class="form-group subrule-form-group">
        <label>搜索字符串:</label>
        <MRInput v-model="subRule.params.search" placeholder="可选，指定要替换的URL部分" />
      </div>
      
      <div v-if="subRule.type === 'replaceUrl'" class="form-group subrule-form-group">
        <label>替换值(新URL):</label>
        <MRInput v-model="subRule.params.value" placeholder="输入新URL" />
      </div>
      
      <!-- 其他类型的通用path输入 -->
      <div v-else-if="subRule.type !== 'setStatus'" class="form-group subrule-form-group">
        <label v-if="subRule.type === 'setParam' || subRule.type === 'deleteParam'">参数名:</label>
        <label v-else>字段路径:</label>
        <MRInput v-model="subRule.params.path" :placeholder="subRule.type === 'setParam' || subRule.type === 'deleteParam' ? '输入参数名' : '输入字段路径'" />
      </div>

      <!-- 非replaceUrl类型的值输入 -->
      <div v-if="subRule.type === 'setField' || subRule.type === 'appendArray' || subRule.type === 'setParam'"
        class="form-group subrule-form-group">
        <label>值:</label>
        <MRInput v-model="valueDisplay" placeholder="输入值 (支持JSON格式)" @change="handleValueChange" />
      </div>

      <div v-if="subRule.type === 'setStatus'" class="form-group subrule-form-group">
        <label>状态码:</label>
        <MRInput v-model.number="subRule.params.statusCode" type="number" placeholder="例如: 200" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue';
import MRIconButton from './MRIconButton.vue';
import MRInput from './MRInput.vue';
import MRSelect from './MRSelect.vue';
import { RuleInstruction } from '@/types/index.js';

interface Props {
  index: number;
  subRule: RuleInstruction;
}

interface Emits {
  remove: [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 确保params对象存在
watch(() => props.subRule, (newRule) => {
  if (!newRule.params) {
    (newRule as any).params = {};
  }
}, { immediate: true, deep: true });

// 监听subRule.type的变化，确保在类型改变时调用handleTypeChange函数
watch(() => props.subRule.type, (newType) => {
  handleTypeChange(newType);
}, { immediate: true });

// 计算属性，用于处理JSON对象的显示
const valueDisplay = computed({
  get: () => {
    const value = props.subRule.params?.value;
    // 如果值是对象，将其转换为JSON字符串
    if (value !== null && typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return value !== undefined ? value : '';
  },
  set: (newValue) => {
    // 临时设置，等待用户确认后再解析
    // 这个setter主要用于v-model的双向绑定，实际解析在handleValueChange中处理
    if (typeof newValue === 'object' && newValue !== null) {
      props.subRule.params.value = JSON.parse(JSON.stringify(newValue));
    } else {
      props.subRule.params.value = newValue;
    }
  }
});

// 处理值的变更，解析JSON字符串
const handleValueChange = () => {
  const inputValue = valueDisplay.value;
  try {
    // 尝试将输入解析为JSON
    props.subRule.params.value = JSON.parse(inputValue);
  } catch (error) {
    // 如果不是有效的JSON，则保持为字符串
    props.subRule.params.value = inputValue;
  }
};

// 监听原始值的变化，确保正确显示
watch(() => props.subRule.params?.value, () => {
  // 触发重新计算
}, { deep: true });

// 当类型改变时，初始化对应的参数
const handleTypeChange = (newType: string) => {
  const subRule = props.subRule;
  if (!subRule.params) {
    subRule.params = {};
  }

  // 根据类型设置默认参数
  if (newType === 'replaceUrl') {
    // replaceUrl 使用 search 和 value 参数，不使用 path
    if (subRule.params.path) {
      // 如果有旧的 path 值，将其转换为 value
      subRule.params.value = subRule.params.path;
      delete subRule.params.path;
    }
    // 初始化 search 和 value 参数
    if (subRule.params.search === undefined) {subRule.params.search = '';}
    if (subRule.params.value === undefined) {subRule.params.value = '';}
  } else if (newType === 'setParam' || newType === 'deleteParam') {
    if (!subRule.params.path) {subRule.params.path = '';}
    if (newType === 'setParam' && !subRule.params.value) {
      subRule.params.value = '';
    }
  } else if (newType === 'setField' || newType === 'appendArray') {
    if (!subRule.params.path) {subRule.params.path = '';}
    if (!subRule.params.value) {subRule.params.value = '';}
  } else if (newType === 'deleteField') {
    if (!subRule.params.path) {subRule.params.path = '';}
  } else if (newType === 'setStatus') {
    if (subRule.params.statusCode === undefined) {
      subRule.params.statusCode = 200;
    }
  }
};
</script>

<style scoped>
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

.subrule-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  margin-bottom: 0;
}

.subrule-form-group label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: block;
}
</style>