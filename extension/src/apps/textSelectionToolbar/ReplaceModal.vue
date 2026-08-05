<template>
  <div v-if="visible" class="replace-modal-overlay" @click.self="handleClose">
    <div class="replace-modal" :class="{ 'is-shaking': isShaking }">
      <div class="replace-modal__header">
        <div class="replace-modal__title-group">
          <h2 class="replace-modal__title">替换文本</h2>
          <p class="replace-modal__subtitle">（刷新页面后失效）</p>
        </div>
        <button class="replace-modal__close" type="button" aria-label="关闭替换文本弹窗" @click="handleClose">×</button>
      </div>
      <div class="replace-modal__body">
        <div class="replace-modal__input-group">
          <label class="replace-modal__label">查找文本</label>
          <div class="replace-modal__preview">{{ searchText }}</div>
        </div>
        <div class="replace-modal__input-group">
          <label class="replace-modal__label" for="replace-modal-input">替换为</label>
          <input id="replace-modal-input" ref="inputRef" v-model="replaceText" type="text" class="replace-modal__input"
            placeholder="请输入替换后的文本"
            @keydown.enter="handleReplace" />
        </div>
        <div class="replace-modal__options">
          <label class="replace-modal__checkbox">
            <input v-model="caseSensitive" type="checkbox" />
            <span class="replace-modal__checkbox-box"></span>
            <span class="replace-modal__checkbox-label">区分大小写</span>
          </label>
          <label class="replace-modal__checkbox">
            <input v-model="wholeWord" type="checkbox" />
            <span class="replace-modal__checkbox-box"></span>
            <span class="replace-modal__checkbox-label">全词匹配</span>
          </label>
        </div>
      </div>
      <div class="replace-modal__footer">
        <button class="replace-modal__btn replace-modal__btn--secondary" type="button" @click="handleClose">取消</button>
        <button class="replace-modal__btn replace-modal__btn--primary" type="button" @click="handleReplace">替换</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  searchText: string
}>(), {
  title: '替换文本'
});

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'replace', replaceText: string, options: { caseSensitive: boolean; wholeWord: boolean }): void
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const replaceText = ref('');
const caseSensitive = ref(false);
const wholeWord = ref(false);
const isShaking = ref(false);

watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      inputRef.value?.focus();
    });
    replaceText.value = '';
  }
});

const triggerShake = () => {
  isShaking.value = false;
  requestAnimationFrame(() => {
    isShaking.value = true;
    setTimeout(() => {
      isShaking.value = false;
    }, 420);
  });
};

const handleClose = () => {
  emit('close');
};

const handleReplace = () => {
  if (!replaceText.value.trim()) {
    triggerShake();
    return;
  }
  emit('replace', replaceText.value, {
    caseSensitive: caseSensitive.value,
    wholeWord: wholeWord.value
  });
};
</script>

<style scoped lang="scss">
/* ========== 遮罩层 ========== */
.replace-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999999;
  animation: fadeIn 0.2s ease;
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
  --replace-primary: #0d9488;
  --replace-primary-strong: #0f766e;
  --replace-accent: #f97316;
  --replace-text: #134e4a;
  --replace-muted: #475569;
  --replace-border: rgba(15, 118, 110, 0.18);

  width: min(440px, calc(100vw - 32px));
  border-radius: 12px;
  border: 1px solid var(--replace-border);
  background: rgba(255, 255, 255, 0.98);
  color: var(--replace-text);
  backdrop-filter: blur(18px) saturate(1.2);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.26), 0 4px 18px rgba(13, 148, 136, 0.12);
  overflow: hidden;
  animation: slideUp 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", Arial, sans-serif;
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
  border-bottom: 1px solid rgba(15, 118, 110, 0.12);
  background: linear-gradient(180deg, #ffffff, #f0fdfa);
}

.replace-modal__title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.replace-modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 750;
  color: var(--replace-text);
  letter-spacing: 0;
}

.replace-modal__subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--replace-muted);
  font-weight: 500;
}

.replace-modal__close {
  padding: 0;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(13, 148, 136, 0.16);
  border-radius: 8px;
  background: #ecfeff;
  color: var(--replace-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
  margin-top: -2px;
}

.replace-modal__close:hover {
  background: #fff7ed;
  border-color: rgba(249, 115, 22, 0.28);
  color: #c2410c;
}

.replace-modal__close:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.8);
  outline-offset: 2px;
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
  font-weight: 700;
  color: var(--replace-text);
  margin-bottom: 8px;
  letter-spacing: 0;
}

.replace-modal__preview {
  padding: 10px 14px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid rgba(15, 118, 110, 0.14);
  color: #0f172a;
  font-family: "SF Mono", "Monaco", "Consolas", monospace;
  font-size: 13px;
  word-break: break-all;
  line-height: 1.5;
}

.replace-modal__input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid rgba(15, 118, 110, 0.18);
  color: #0f172a;
  font-family: "SF Mono", "Monaco", "Consolas", monospace;
  font-size: 13px;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
  box-sizing: border-box;
}

.replace-modal__input::placeholder {
  color: #94a3b8;
}

.replace-modal__input:hover {
  border-color: rgba(13, 148, 136, 0.32);
}

.replace-modal__input:focus {
  border-color: var(--replace-primary);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.14);
  background: #ffffff;
}

/* ========== 复选框 ========== */
.replace-modal__options {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 22px;
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
  background: #ffffff;
  border: 1px solid rgba(15, 118, 110, 0.25);
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  flex-shrink: 0;
  position: relative;
}

.replace-modal__checkbox input:checked+.replace-modal__checkbox-box {
  background: var(--replace-primary);
  border-color: var(--replace-primary);
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
  color: var(--replace-muted);
  user-select: none;
}

.replace-modal__checkbox:hover .replace-modal__checkbox-box {
  border-color: var(--replace-primary);
}

.replace-modal__checkbox input:focus-visible+.replace-modal__checkbox-box {
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2);
}

/* ========== 底部按钮 ========== */
.replace-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(15, 118, 110, 0.12);
  background: #ffffff;
}

.replace-modal__btn {
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  letter-spacing: 0;
}

/* 次按钮 - 纯文本样式 */
.replace-modal__btn--secondary {
  background: #f8fafc;
  border: 1px solid rgba(15, 118, 110, 0.12);
  color: var(--replace-muted);
}

.replace-modal__btn--secondary:hover {
  border-color: rgba(13, 148, 136, 0.22);
  color: var(--replace-text);
}

/* 主按钮 - 科技蓝胶囊 */
.replace-modal__btn--primary {
  background: var(--replace-primary);
  border: none;
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(13, 148, 136, 0.22);
}

.replace-modal__btn--primary:hover {
  background: var(--replace-primary-strong);
  box-shadow: 0 10px 22px rgba(13, 148, 136, 0.28);
  transform: translateY(-1px);
}

.replace-modal__btn--primary:active {
  transform: translateY(0);
  box-shadow: 0 5px 14px rgba(13, 148, 136, 0.2);
}

.replace-modal__btn:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.8);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .replace-modal-overlay,
  .replace-modal,
  .replace-modal.is-shaking {
    animation: none;
  }

  .replace-modal__close,
  .replace-modal__input,
  .replace-modal__checkbox-box,
  .replace-modal__btn {
    transition: none;
  }
}
</style>
