<template>
  <el-dialog v-model="visible" :title="title" :width="width" :modal="false" :close-on-click-modal="false"
    :close-on-press-escape="true" :draggable="true" :resizable="true" :center="false" custom-class="context-menu-dialog"
    @close="handleClose">
    <!-- 菜单内容 -->
    <!-- 如果 toolId 为 hello，则展示默认欢迎界面 -->
    <Transition name="fade" mode="out-in">
      <div v-if="toolId === 'hello'" key="hello">
        <div class="context-hello">
          <span>这里有一个BUG，好痛！</span>
        </div>
      </div>

      <div v-else key="menu" class="context-menu-content">
        <div class="context-menu-grid">
          <div v-for="item in menuItems" :key="item.id" class="context-menu-block" @click="handleItemClick(item)">
            <component :is="item.icon" v-if="item.icon" class="menu-block-icon" />
            <span class="menu-block-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Tool } from '@/types';

// Props定义
const props = withDefaults(defineProps<{
  visible?: boolean
  title?: string
  width?: string
  menuItems?: Tool[]
  toolId?: string
}>(), {
  visible: false,
  title: '上下文菜单',
  width: '300px',
  menuItems: () => []
});

// Emits定义
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'item-click': [item: Tool]
  'close': []
}>();

// 响应式数据
const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    emit('update:visible', value);
  }
});

// 事件处理
const handleClose = () => {
  emit('close');
};

const handleItemClick = (item: Tool) => {
  // 发送消息到后台脚本
  chrome.runtime.sendMessage({
    type: 'CONTEXT_MENU_CLICK',
    payload: {
      itemId: item.id,
      itemLabel: item.label,
      toolId: props.toolId
    },
    target: 'background'
  });
  emit('item-click', item);
};
</script>

<style scoped>
.context-hello {
  padding: 20px;
  text-align: center;
  font-size: 16px;
  color: #f8fafc;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 科幻风格的上下文菜单 */
.context-menu-dialog {
  background: rgba(15, 23, 42, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(59, 130, 246, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  color: #e2e8f0;
  /* 确保对话框过渡效果正常工作 */
  animation: dialogFadeIn 0.2s ease;
}

/* 对话框淡入动画 */
@keyframes dialogFadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 对话框头部 */
:deep(.el-dialog__header) {
  background: rgba(15, 23, 42, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
}

:deep(.el-dialog__title) {
    color: #f8fafc;
    font-weight: 600;
    font-size: 18px;
    --el-dialog-title-font-size: 18px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    /* 确保字体大小优先级最高 */
    font-size: 18px !important;
}

/* 关闭按钮 */
:deep(.el-dialog__headerbtn .el-icon-close) {
  color: #94a3b8;
  transition: all 0.2s ease;
  font-size: 20px;
}

:deep(.el-dialog__headerbtn:hover .el-icon-close) {
  color: #f8fafc;
  transform: scale(1.2);
  text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

/* 对话框内容 */
:deep(.el-dialog__body) {
  padding: 20px;
  background: transparent;
  overflow: hidden;
}

/* 菜单内容 */
.context-menu-content {
  padding: 10px 0;
  max-height: 500px;
  overflow-y: auto;
}

/* 网格布局 */
.context-menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 10px;
}

/* 组件切换过渡样式 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 菜单方块项 */
.context-menu-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  gap: 8px;
  color: #e2e8f0;
  font-size: 13px;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  backdrop-filter: blur(15px);
  min-height: 80px;
}

.context-menu-block:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

/* 菜单项图标 */
.menu-block-icon {
  width: 32px;
  height: 32px;
  color: #3b82f6;
  transition: all 0.3s ease;
}

.context-menu-block:hover .menu-block-icon {
  transform: scale(1.2);
  color: #60a5fa;
  filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
}

/* 菜单项标签 */
.menu-block-label {
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.context-menu-block:hover .menu-block-label {
  color: #f8fafc;
}

/* 滚动条样式 */
.context-menu-content::-webkit-scrollbar {
  width: 8px;
}

.context-menu-content::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.3);
  border-radius: 4px;
}

.context-menu-content::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.4);
  border-radius: 4px;
  transition: all 0.2s ease;
  border: 2px solid rgba(30, 41, 59, 0.3);
}

.context-menu-content::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

/* 调整大小手柄 */
:deep(.el-dialog__resize-handle) {
  background-image: linear-gradient(45deg, transparent 48%, #3b82f6 48%, #3b82f6 52%, transparent 52%);
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

:deep(.el-dialog__resize-handle:hover) {
  opacity: 1;
}
</style>