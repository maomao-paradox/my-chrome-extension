<template>
  <div v-if="visible" class="scifi-dialog-overlay" @click.self="handleCancel">
    <div class="scifi-dialog">
      <!-- 装饰性发光条 -->
      <div class="scifi-dialog__decoration-top"></div>

      <div class="scifi-dialog__header">
        <h3 class="scifi-dialog__title">
          <i class="iconfont icon-info-circle"></i> {{ title }}
        </h3>
        <button class="scifi-dialog__close-btn" @click="handleCancel">
          <i class="iconfont icon-close">
            <IconClose />
          </i>
        </button>
      </div>

      <div class="scifi-dialog__body">
        <p class="scifi-dialog__content">{{ message }}</p>
      </div>

      <div class="scifi-dialog__footer">
        <button class="scifi-dialog__btn scifi-dialog__btn--cancel" @click="handleCancel">
          {{ cancelText }}
        </button>
        <button class="scifi-dialog__btn scifi-dialog__btn--confirm" @click="handleConfirm" :disabled="loading">
          <span v-if="loading" class="scifi-dialog__btn--loading">
            <IconLoading />
          </span>
          {{ loading ? loadingText : confirmText }}
        </button>
      </div>

      <!-- 科幻风格装饰元素 -->
      <div class="scifi-dialog__grid"></div>
      <div class="scifi-dialog__scanline"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { eventManager } from "@/event"
import { IconClose, IconLoading } from '@/assets/icons'

interface SciFiConfirmDialogProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
}

// Props
const props = withDefaults(defineProps<SciFiConfirmDialogProps>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  loadingText: 'Loading...'
})

const visible = defineModel('visible', {
  type: Boolean,
  default: false
})

// Emits
const emit = defineEmits<{
  confirm: []
  cancel: []
  close: []
}>()

// State
const loading = ref(false)

// Methods
const handleConfirm = async () => {
  loading.value = true

  // 模拟异步操作，与之前的行为保持一致
  setTimeout(() => {
    loading.value = false
    emit('confirm')
    emit('close')
  }, 500)
}

const handleCancel = () => {
  loading.value = false
  emit('cancel')
  emit('close')
}

// Keyboard events
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleCancel()
  } else if (event.key === 'Enter' && !loading.value) {
    handleConfirm()
  }
}

eventManager.useListener(window, 'keydown', handleKeydown)

</script>

<style scoped>
/* 科幻风格对话框样式 */
.scifi-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(5, 10, 20, 0.9);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  animation: scifiFadeIn 0.2s ease-out;
}

.scifi-dialog {
  background: var(--scifi-card-bg, #0a1122);
  border: 1px solid var(--scifi-border, #2563eb);
  border-radius: 12px;
  box-shadow:
    0 0 30px rgba(59, 130, 246, 0.3),
    0 0 60px rgba(59, 130, 246, 0.1);
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow: hidden;
  animation: scifiSlideIn 0.3s ease-out;
  position: relative;
  backdrop-filter: blur(10px);
}

/* 装饰性发光条 */
.scifi-dialog__decoration-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--scifi-primary, #3b82f6), var(--scifi-secondary, #8b5cf6), transparent);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.7);
  z-index: 10;
  animation: scifiGlowPulse 3s ease-in-out infinite;
}

.scifi-dialog__header {
  padding: 20px 25px 15px;
  border-bottom: 1px solid rgba(37, 99, 235, 0.3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.scifi-dialog__header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--scifi-primary, #3b82f6), transparent);
  animation: scifiGlowPulse 3s ease-in-out infinite;
}

.scifi-dialog__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(90deg, var(--scifi-primary, #3b82f6) 0%, var(--scifi-secondary, #8b5cf6) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: flex;
  align-items: center;
  gap: 8px;
  text-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
}

.scifi-dialog__title i {
  color: var(--scifi-primary, #3b82f6);
  text-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
  font-size: 20px;
  animation: scifiGlowPulse 2s ease-in-out infinite;
}

.scifi-dialog__close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(10, 17, 34, 0.8);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  color: var(--scifi-text-secondary, #a5b4fc);
}

.scifi-dialog__close-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s ease;
}

.scifi-dialog__close-btn:hover::before {
  left: 100%;
}

.scifi-dialog__close-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: var(--scifi-primary, #3b82f6);
  transform: scale(1.1);
  color: var(--scifi-primary, #3b82f6);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

.scifi-dialog__body {
  padding: 25px;
  position: relative;
}

.scifi-dialog__content {
  margin: 0;
  color: var(--scifi-text-secondary, #a5b4fc);
  font-size: 16px;
  line-height: 1.6;
  text-shadow: 0 0 5px rgba(59, 130, 246, 0.1);
}

.scifi-dialog__footer {
  padding: 15px 25px 20px;
  border-top: 1px solid rgba(37, 99, 235, 0.3);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  position: relative;
}

.scifi-dialog__footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.2), transparent);
}

.scifi-dialog__btn {
  padding: 10px 20px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.scifi-dialog__btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.2), transparent);
  transition: left 0.5s ease;
}

.scifi-dialog__btn:hover::before {
  left: 100%;
}

.scifi-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.scifi-dialog__btn:not(:disabled):hover {
  transform: translateY(-2px);
}

.scifi-dialog__btn--cancel {
  background: rgba(10, 17, 34, 0.8);
  border-color: rgba(37, 99, 235, 0.5);
  color: var(--scifi-text, #e0e7ff);
}

.scifi-dialog__btn--cancel:hover:not(:disabled) {
  border-color: var(--scifi-primary, #3b82f6);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
  transform: translateY(-2px);
  background: linear-gradient(135deg, rgba(10, 17, 34, 0.9) 0%, rgba(15, 23, 42, 0.8) 100%);
}

.scifi-dialog__btn--confirm {
  background: linear-gradient(135deg, var(--scifi-primary, #3b82f6) 0%, var(--scifi-secondary, #8b5cf6) 100%);
  border-color: var(--scifi-primary, #3b82f6);
  color: white;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.5), 0 0 24px rgba(59, 130, 246, 0.3);
}

.scifi-dialog__btn--confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--scifi-secondary, #8b5cf6) 0%, var(--scifi-primary, #3b82f6) 100%);
  border-color: var(--scifi-secondary, #8b5cf6);
  box-shadow: 0 0 16px rgba(139, 92, 246, 0.6), 0 0 32px rgba(139, 92, 246, 0.4);
  transform: translateY(-2px);
  animation: scifiPulse 2s ease-in-out infinite;
}

.scifi-dialog__btn--loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.scifi-dialog__spinner {
  animation: rotate 1s linear infinite;
}

/* 网格背景装饰 */
.scifi-dialog__grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: 0 0;
  pointer-events: none;
  opacity: 0.5;
  animation: scifiGridMove 10s linear infinite;
  z-index: 0;
}

/* 扫描线效果 */
.scifi-dialog__scanline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 4px rgba(59, 130, 246, 0.9);
  animation: scifiScanline 6s linear infinite;
  pointer-events: none;
  z-index: 50;
}

/* 动画 */
@keyframes scifiFadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes scifiSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes scifiGlowPulse {

  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

@keyframes scifiPulse {
  0% {
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.5), 0 0 24px rgba(59, 130, 246, 0.3);
  }

  50% {
    box-shadow: 0 0 16px rgba(59, 130, 246, 0.7), 0 0 32px rgba(59, 130, 246, 0.5);
  }

  100% {
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.5), 0 0 24px rgba(59, 130, 246, 0.3);
  }
}

@keyframes scifiGridMove {
  0% {
    background-position: 0px 0px;
  }

  100% {
    background-position: 50px 50px;
  }
}

@keyframes scifiScanline {
  0% {
    transform: translateY(-100%);
  }

  100% {
    transform: translateY(100%);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .scifi-dialog {
    width: 95%;
    margin: 0 10px;
  }

  .scifi-dialog__header,
  .scifi-dialog__body,
  .scifi-dialog__footer {
    padding: 15px 20px;
  }

  .scifi-dialog__title {
    font-size: 16px;
  }

  .scifi-dialog__btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .scifi-dialog {
    width: 98%;
  }

  .scifi-dialog__header,
  .scifi-dialog__body,
  .scifi-dialog__footer {
    padding: 12px 15px;
  }

  .scifi-dialog__footer {
    flex-direction: column-reverse;
  }

  .scifi-dialog__btn {
    width: 100%;
  }
}
</style>

<style>
/* 全局样式变量，确保在shadow DOM中也能正常工作 */
:root {
  --scifi-primary: #3b82f6;
  --scifi-secondary: #8b5cf6;
  --scifi-accent: #10b981;
  --scifi-danger: #ef4444;
  --scifi-bg: #050a14;
  --scifi-card-bg: #0a1122;
  --scifi-text: #e0e7ff;
  --scifi-text-secondary: #a5b4fc;
  --scifi-border: #2563eb;
  --scifi-glow: 0 0 8px rgba(59, 130, 246, 0.5);
  --scifi-glow-secondary: 0 0 12px rgba(139, 92, 246, 0.5);
}
</style>