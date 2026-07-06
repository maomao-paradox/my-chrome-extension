<template>
  <el-drawer v-model="visible" :direction="direction" :resizable="resizable" :title="title" :modal="modal"
    :close-on-click-modal="closeOnClickModal" :custom-class="customClass" :overlay-class="overlayClass"
    @closed="handleClose">
    <slot />
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface DrawerProps {
  visible?: boolean
  title?: string
  direction?: "rtl" | "ltr" | "ttb" | "btt"
  resizable?: boolean
  modal?: boolean
  closeOnClickModal?: boolean
  customClass?: string
  overlayClass?: string
}

// Props定义
const props = withDefaults(defineProps<DrawerProps>(), {
  visible: false,
  title: '',
  direction: 'rtl',
  resizable: false,
  modal: true,
  closeOnClickModal: true,
  customClass: '',
  overlayClass: ''
})

// Emits定义
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'close': []
  'closed': []
}>()

// 响应式数据
const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    emit('update:visible', value)
  }
})

// 处理关闭事件
const handleClose = () => {
  emit('closed')
}
</script>

<style scoped>
/* 无遮罩样式 */
:deep(.el-overlay.no-mask-drawer) {
  pointer-events: none !important;
}

/* 抽屉内容恢复交互 */
:deep(.no-mask-drawer .el-drawer__body) {
  pointer-events: auto;
}

/* 科幻风格抽屉 */
:deep(.sci-fi-drawer) {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5),
    -10px 0 20px rgba(59, 130, 246, 0.2);
  backdrop-filter: blur(10px);
  min-width: 400px;
}

/* 抽屉头部 */
:deep(.sci-fi-drawer .el-drawer__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  background: rgba(15, 23, 42, 0.8);
}

:deep(.sci-fi-drawer .el-drawer__title) {
  color: #f8fafc;
  font-weight: 600;
  font-size: 16px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 关闭按钮 */
:deep(.sci-fi-drawer .el-drawer__headerbtn .el-icon-close) {
  color: #94a3b8;
  transition: all 0.2s ease;
}

:deep(.sci-fi-drawer .el-drawer__headerbtn:hover .el-icon-close) {
  color: #f8fafc;
  transform: scale(1.1);
}

/* 抽屉内容 */
:deep(.sci-fi-drawer .el-drawer__body) {
  padding: 20px;
  color: #e2e8f0;
  background: transparent;
  overflow-y: auto;
  max-height: calc(100vh - 120px);
}
</style>