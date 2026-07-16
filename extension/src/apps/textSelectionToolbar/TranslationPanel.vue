<template>
  <div v-if="visible" ref="panelRef" class="translation-panel" :class="{ 'is-shaking': isShaking }" :style="panelStyle">
    <div class="translation-panel__header" :class="{ 'is-dragging': isDragging }" @pointerdown="handlePointerDown">
      <div class="translation-panel__title">{{ title }}</div>
      <button class="translation-panel__close" type="button" aria-label="关闭翻译结果" @pointerdown.stop
        @click="$emit('close')">×</button>
    </div>
    <div class="translation-panel__body" :class="`is-${status}`" role="status" aria-live="polite">
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';

type TranslationStatus = 'loading' | 'success' | 'error'

interface TranslationPosition {
  left: number
  top: number
}

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  content: string
  status?: TranslationStatus
  position?: TranslationPosition
  shakeKey?: number
}>(), {
  title: 'AI解释',
  status: 'loading',
  position: () => ({
    left: 100,
    top: 100
  }),
  shakeKey: 0
});

defineEmits<{
  (e: 'close'): void
}>();

const panelRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isShaking = ref(false);
const currentPosition = ref<TranslationPosition>({
  left: props.position.left,
  top: props.position.top
});

let startX = 0;
let startY = 0;
let startLeft = 0;
let startTop = 0;
let previousUserSelect = '';
let shakeTimer: ReturnType<typeof setTimeout> | number | null = null;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const clampPosition = (left: number, top: number): TranslationPosition => {
  const margin = 12;
  const panelWidth = panelRef.value?.offsetWidth ?? 560;
  const panelHeight = panelRef.value?.offsetHeight ?? 320;
  const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin);
  const maxTop = Math.max(margin, window.innerHeight - panelHeight - margin);

  return {
    left: Math.round(clamp(left, margin, maxLeft)),
    top: Math.round(clamp(top, margin, maxTop))
  };
};

const syncPosition = (position: TranslationPosition) => {
  currentPosition.value = clampPosition(position.left, position.top);
};

const stopDragging = () => {
  if (!isDragging.value) {
    return;
  }

  isDragging.value = false;
  document.body.style.userSelect = previousUserSelect;
  window.removeEventListener('pointermove', handlePointerMove, true);
  window.removeEventListener('pointerup', stopDragging, true);
  window.removeEventListener('pointercancel', stopDragging, true);
};

const handlePointerMove = (event: PointerEvent) => {
  if (!isDragging.value) {
    return;
  }

  const nextLeft = startLeft + event.clientX - startX;
  const nextTop = startTop + event.clientY - startY;
  currentPosition.value = clampPosition(nextLeft, nextTop);
};

const handlePointerDown = (event: PointerEvent) => {
  if (event.button !== 0) {
    return;
  }

  const target = event.target as HTMLElement | null;
  if (target?.closest('button')) {
    return;
  }

  event.preventDefault();

  isDragging.value = true;
  startX = event.clientX;
  startY = event.clientY;
  startLeft = currentPosition.value.left;
  startTop = currentPosition.value.top;
  previousUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = 'none';

  window.addEventListener('pointermove', handlePointerMove, true);
  window.addEventListener('pointerup', stopDragging, true);
  window.addEventListener('pointercancel', stopDragging, true);
};

watch(() => props.position, (position) => {
  if (!position || isDragging.value) {
    return;
  }

  syncPosition(position);
}, { deep: true, immediate: true });

watch(() => props.visible, (visible) => {
  if (!visible || isDragging.value || !props.position) {
    return;
  }

  syncPosition(props.position);
});

const panelStyle = computed(() => ({
  left: `${currentPosition.value.left}px`,
  top: `${currentPosition.value.top}px`
}));

const triggerShake = () => {
  if (shakeTimer) {
    clearTimeout(shakeTimer);
    shakeTimer = null;
  }

  isShaking.value = false;
  requestAnimationFrame(() => {
    isShaking.value = true;
    shakeTimer = window.setTimeout(() => {
      isShaking.value = false;
      shakeTimer = null;
    }, 420);
  });
};

watch(() => props.shakeKey, (nextValue, previousValue) => {
  if (nextValue === previousValue) {
    return;
  }

  triggerShake();
});

onUnmounted(() => {
  stopDragging();
  if (shakeTimer) {
    clearTimeout(shakeTimer);
  }
});
</script>

<style scoped lang="scss">
.translation-panel {
  --panel-primary: #0d9488;
  --panel-primary-strong: #0f766e;
  --panel-accent: #f97316;
  --panel-surface: rgba(255, 255, 255, 0.97);
  --panel-surface-muted: #f8fafc;
  --panel-border: rgba(15, 118, 110, 0.18);
  --panel-text: #134e4a;
  --panel-muted: #475569;

  position: fixed;
  width: min(560px, calc(100vw - 24px));
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
  z-index: 999999;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--panel-surface);
  box-shadow: 0 22px 50px rgba(15, 23, 42, 0.22), 0 4px 16px rgba(13, 148, 136, 0.12);
  backdrop-filter: blur(18px) saturate(1.2);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  color: var(--panel-text);
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", Arial, sans-serif;
}

.translation-panel.is-shaking {
  animation: translation-panel-shake 0.42s ease;
  border-color: rgba(249, 115, 22, 0.55);
  box-shadow: 0 22px 54px rgba(15, 23, 42, 0.24), 0 0 0 2px rgba(249, 115, 22, 0.16);
}

.translation-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px 10px 14px;
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid rgba(15, 118, 110, 0.14);
  background: linear-gradient(180deg, #ffffff, #f0fdfa);
  transition: background 0.22s ease, border-color 0.22s ease;
}

.translation-panel__header.is-dragging {
  cursor: grabbing;
}

.translation-panel.is-shaking .translation-panel__header {
  border-bottom-color: rgba(249, 115, 22, 0.24);
  background: linear-gradient(180deg, #fff7ed, #ffffff);
}

.translation-panel__title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--panel-text);
  transition: color 0.22s ease, text-shadow 0.22s ease;
}

.translation-panel.is-shaking .translation-panel__title {
  color: #9a3412;
  text-shadow: none;
}

.translation-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(13, 148, 136, 0.16);
  border-radius: 8px;
  background: #ecfeff;
  color: var(--panel-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.translation-panel.is-shaking .translation-panel__close {
  border-color: rgba(249, 115, 22, 0.28);
  color: #c2410c;
}

.translation-panel__close:hover {
  border-color: rgba(249, 115, 22, 0.3);
  background: #fff7ed;
  color: #c2410c;
}

.translation-panel__close:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.8);
  outline-offset: 2px;
}

.translation-panel__body {
  overflow: auto;
  max-height: calc(70vh - 46px);
  padding: 15px 16px 16px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  font-size: 14px;
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", Arial, sans-serif;
  transition: color 0.22s ease, background 0.22s ease;
  background: linear-gradient(180deg, #ffffff, var(--panel-surface-muted));
}

.translation-panel.is-shaking .translation-panel__body {
  background: linear-gradient(180deg, #ffffff, #fff7ed);
}

.translation-panel__body.is-loading {
  color: var(--panel-muted);
}

.translation-panel__body.is-success {
  color: #0f172a;
}

.translation-panel__body.is-error {
  color: #b91c1c;
}

@keyframes translation-panel-shake {

  0%,
  100% {
    transform: translateX(0);
  }

  15% {
    transform: translateX(-8px);
  }

  30% {
    transform: translateX(7px);
  }

  45% {
    transform: translateX(-6px);
  }

  60% {
    transform: translateX(5px);
  }

  75% {
    transform: translateX(-3px);
  }
}

@media (prefers-reduced-motion: reduce) {

  .translation-panel,
  .translation-panel__header,
  .translation-panel__close,
  .translation-panel__body {
    transition: none;
  }

  .translation-panel.is-shaking {
    animation: none;
  }
}
</style>
