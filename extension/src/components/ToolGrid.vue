<template>
  <div class="tool-grid">
    <div 
      v-for="tool in tools" 
      :key="tool.id" 
      class="tool-item" 
      @click="onClickTool(tool)"
    >
      <div class="tool-icon">
        <component :is="getToolIcon(tool)" />
      </div>
      <span class="tool-label">{{ tool.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import IconCommunity from '../icons/IconCommunity.vue';

// 定义工具类型
interface Tool {
  id: string
  label: string
  icon?: any
}

// Props定义
const props = withDefaults(defineProps<{
  tools: Tool[]
}>(), {
  tools: () => []
});

// Emits定义
const emit = defineEmits<{
  'click': [tool: Tool]
}>();

// 获取工具图标
const getToolIcon = (tool: Tool) => {
  return tool.icon || IconCommunity;
};

// 点击工具项
const onClickTool = (tool: Tool) => {
  emit('click', tool);
};
</script>

<style scoped>
/* 工具网格 */
.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
  padding: 10px 0;
}

/* 工具项 */
.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
}

.tool-item:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

/* 工具图标 */
.tool-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
  border-radius: 12px;
}

/* 工具标签 */
.tool-label {
  font-size: 14px;
  text-align: center;
  color: #e2e8f0;
  margin-top: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 科幻风格特定样式 */
.sci-fi .tool-grid {
  gap: 20px;
}

.sci-fi .tool-item {
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(10px);
}

.sci-fi .tool-item:hover {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}

.sci-fi .tool-icon {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2));
}

.sci-fi .tool-label {
  color: #f8fafc;
}
</style>