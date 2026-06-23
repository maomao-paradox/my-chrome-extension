<template>
  <div v-if="visible" class="replace-modal-overlay" @click.self="handleClose">
    <div class="replace-modal" :class="{ 'is-shaking': isShaking }">
      <div class="replace-modal__header">
        <div class="replace-modal__title-group">
          <h2 class="replace-modal__title">替换文本</h2>
          <p class="replace-modal__subtitle">（刷新页面后失效）</p>
        </div>
        <button class="replace-modal__close" @click="handleClose">×</button>
      </div>
      <div class="replace-modal__body">
        <div class="replace-modal__input-group">
          <label class="replace-modal__label">查找文本</label>
          <div class="replace-modal__preview">{{ searchText }}</div>
        </div>
        <div class="replace-modal__input-group">
          <label class="replace-modal__label">替换为</label>
          <input ref="inputRef" v-model="replaceText" type="text" class="replace-modal__input" placeholder="请输入替换后的文本"
            @keydown.enter="handleReplace" />
        </div>
        <div class="replace-modal__options">
          <label class="replace-modal__checkbox">
            <input type="checkbox" v-model="caseSensitive" />
            <span class="replace-modal__checkbox-box"></span>
            <span class="replace-modal__checkbox-label">区分大小写</span>
          </label>
          <label class="replace-modal__checkbox">
            <input type="checkbox" v-model="wholeWord" />
            <span class="replace-modal__checkbox-box"></span>
            <span class="replace-modal__checkbox-label">全词匹配</span>
          </label>
        </div>
      </div>
      <div class="replace-modal__footer">
        <button class="replace-modal__btn replace-modal__btn--secondary" @click="handleClose">取消</button>
        <button class="replace-modal__btn replace-modal__btn--primary" @click="handleReplace">替换</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  searchText: string
}>(), {
  title: '替换文本'
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'replace', replaceText: string, options: { caseSensitive: boolean; wholeWord: boolean }): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const replaceText = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const isShaking = ref(false)

watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      inputRef.value?.focus()
    })
    replaceText.value = ''
  }
})

const triggerShake = () => {
  isShaking.value = false
  requestAnimationFrame(() => {
    isShaking.value = true
    setTimeout(() => {
      isShaking.value = false
    }, 420)
  })
}

const handleClose = () => {
  emit('close')
}

const handleReplace = () => {
  if (!replaceText.value.trim()) {
    triggerShake()
    return
  }
  emit('replace', replaceText.value, {
    caseSensitive: caseSensitive.value,
    wholeWord: wholeWord.value
  })
}
</script>

<style scoped>
/* ========== 遮罩层 ========== */
.replace-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999999;
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/* ========== 弹窗容器 ========== */
.replace-modal {
  width: min(440px, calc(100vw - 32px));
  border-radius: 16px;
  backdrop-filter: blur(16px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.replace-modal.is-shaking {
  animation: modalShake 0.42s ease;
}

@keyframes modalShake {

  0%,
  100% {
    transform: translateX(0);
  }

  15% {
    transform: translateX(-6px);
  }

  30% {
    transform: translateX(5px);
  }

  45% {
    transform: translateX(-4px);
  }

  60% {
    transform: translateX(3px);
  }

  75% {
    transform: translateX(-2px);
  }
}

/* ========== 头部 ========== */
.replace-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.replace-modal__title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.replace-modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.01em;
}

.replace-modal__subtitle {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 400;
}

.replace-modal__close {
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.3s ease;
  margin-top: -2px;
}

.replace-modal__close:hover {
  color: #ffffff;
}

/* ========== 内容区 ========== */
.replace-modal__body {
  padding: 20px;
}

.replace-modal__input-group {
  margin-bottom: 16px;
}

.replace-modal__label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.65);
  margin-bottom: 8px;
  letter-spacing: 0.01em;
}

.replace-modal__preview {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  word-break: break-all;
  line-height: 1.5;
}

.replace-modal__input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  outline: none;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.replace-modal__input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.replace-modal__input:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.replace-modal__input:focus {
  border-color: #1e6fe6;
  box-shadow: 0 0 10px rgba(30, 111, 230, 0.35);
  background: rgba(255, 255, 255, 0.06);
}

/* ========== 复选框 ========== */
.replace-modal__options {
  display: flex;
  gap: 24px;
  margin-top: 18px;
}

.replace-modal__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  position: relative;
}

.replace-modal__checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.replace-modal__checkbox-box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: all 0.25s ease;
  flex-shrink: 0;
  position: relative;
}

.replace-modal__checkbox input:checked+.replace-modal__checkbox-box {
  background: #1e6fe6;
  border-color: #1e6fe6;
}

.replace-modal__checkbox input:checked+.replace-modal__checkbox-box::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 4px;
  height: 9px;
  border: solid #ffffff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.replace-modal__checkbox-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  user-select: none;
}

.replace-modal__checkbox:hover .replace-modal__checkbox-box {
  border-color: rgba(255, 255, 255, 0.25);
}

/* ========== 底部按钮 ========== */
.replace-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.replace-modal__btn {
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  letter-spacing: 0.01em;
}

/* 次按钮 - 纯文本样式 */
.replace-modal__btn--secondary {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
}

.replace-modal__btn--secondary:hover {
  color: rgba(255, 255, 255, 0.85);
}

/* 主按钮 - 科技蓝胶囊 */
.replace-modal__btn--primary {
  background: #1e6fe6;
  border: none;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(30, 111, 230, 0.35);
}

.replace-modal__btn--primary:hover {
  background: #2a7af5;
  box-shadow: 0 4px 14px rgba(30, 111, 230, 0.45);
  transform: translateY(-1px);
}

.replace-modal__btn--primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(30, 111, 230, 0.3);
}
</style>