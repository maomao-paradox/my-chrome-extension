<template>
  <el-dialog 
    v-model="visible" 
    :title="title" 
    :width="width" 
    :modal="modal" 
    :show-close="showClose"
    :close-on-click-modal="closeOnClickModal" 
    :append-to-body="appendToBody" 
    :lock-scroll="lockScroll" 
    :draggable="draggable"
    :custom-class="customClass"
    @closed="handleClose"
  >
    <slot />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

// Props定义
const props = withDefaults(defineProps<{
  title?: string
  width?: string | number
  visible?: boolean
  modal?: boolean
  showClose?: boolean
  closeOnClickModal?: boolean
  appendToBody?: boolean
  lockScroll?: boolean
  draggable?: boolean
  customClass?: string
}>(), {
  title: '对话框',
  width: '50%',
  modal: true,
  showClose: true,
  closeOnClickModal: true,
  appendToBody: true,
  lockScroll: true,
  draggable: false,
  customClass: ''
});

// Emits定义
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'close': []
  'closed': []
}>();

// 响应式数据
const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    emit('update:visible', value);
  }
});

// 处理关闭事件
const handleClose = () => {
  emit('closed');
};
</script>

<style scoped>
/* 科幻风格对话框样式 */
:deep(.sci-fi-dialog) {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 
              0 0 0 1px rgba(59, 130, 246, 0.1),
              0 0 20px rgba(59, 130, 246, 0.3);
  backdrop-filter: blur(10px);
}

:deep(.sci-fi-dialog .el-dialog__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  background: rgba(15, 23, 42, 0.8);
}

:deep(.sci-fi-dialog .el-dialog__title) {
  color: #f8fafc;
  font-weight: 600;
  font-size: 16px;
}

:deep(.sci-fi-dialog .el-dialog__headerbtn .el-icon-close) {
  color: #94a3b8;
  transition: all 0.2s ease;
}

:deep(.sci-fi-dialog .el-dialog__headerbtn:hover .el-icon-close) {
  color: #f8fafc;
  transform: scale(1.1);
}

:deep(.sci-fi-dialog .el-dialog__body) {
  padding: 20px;
  color: #e2e8f0;
  background: transparent;
}
</style>