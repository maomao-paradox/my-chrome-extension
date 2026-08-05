<template>
  <div class="handler-section">
    <div class="handler-header">
      <h4>{{ title }}</h4>
      <button class="btn btn-sm btn-secondary" title="添加子规则" @click="onAddSubRule">
        <span class="btn-icon">➕</span>
        添加子规则
      </button>
    </div>

    <div v-if="subRules && subRules.length > 0" class="subrules-list">
      <SubRule 
        v-for="(subRule, index) in subRules" 
        :key="`${handlerType}-${index}`" 
        :index="index"
        :sub-rule="subRule" 
        @remove="onRemoveSubRule(index)" 
      />
    </div>

    <div v-else class="empty-subrules">
      <p>暂无子规则，点击添加按钮创建</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import SubRule from './SubRule.vue';
import type { RuleInstruction } from '@/types/index.js';

// Props
interface Props {
  handlerType: 'open' | 'send' | 'response';
  title: string;
  subRules: RuleInstruction[];
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  addSubRule: [handlerType: 'open' | 'send' | 'response'];
  removeSubRule: [handlerType: 'open' | 'send' | 'response', index: number];
}>();

// Methods
function onAddSubRule() {
  emit('addSubRule', props.handlerType);
}

function onRemoveSubRule(index: number) {
  emit('removeSubRule', props.handlerType, index);
}
</script>

<style scoped>
.handler-section {
  margin-bottom: 24px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.handler-section:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-color: #dee2e6;
}

.handler-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e9ecef;
}

.handler-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  outline: none;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-secondary {
  color: #6c757d;
  background-color: #fff;
  border-color: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  color: #fff;
  background-color: #6c757d;
  border-color: #5a6268;
}

.btn-icon {
  margin-right: 4px;
  font-size: 14px;
  line-height: 1;
}

.subrules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subrules-list > * {
  animation: fadeIn 0.3s ease-in-out;
}

.empty-subrules {
  padding: 20px 12px;
  text-align: center;
  color: #6c757d;
  font-size: 14px;
  background-color: #f1f3f5;
  border-radius: 4px;
}

.empty-subrules p {
  margin: 0;
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

/* 响应式调整 */
@media (max-width: 768px) {
  .handler-section {
    padding: 12px;
    margin-bottom: 16px;
  }
  
  .handler-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-bottom: 12px;
  }
  
  .handler-header h4 {
    font-size: 15px;
  }
}
</style>