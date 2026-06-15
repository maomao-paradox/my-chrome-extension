<template>
  <div v-if="visible" ref="panelRef" class="translation-panel" :class="{ 'is-shaking': isShaking }" :style="panelStyle">
    <div class="translation-panel__header" :class="{ 'is-dragging': isDragging }" @pointerdown="handlePointerDown">
      <div class="translation-panel__title">{{ title }}</div>
      <button class="translation-panel__close" @pointerdown.stop @click="$emit('close')">×</button>
    </div>
    <div class="translation-panel__body" :class="`is-${status}`">
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

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
  title: '翻译结果',
  status: 'loading',
  position: () => ({
    left: 100,
    top: 100
  }),
  shakeKey: 0
})

defineEmits<{
  (e: 'close'): void
}>()

const panelRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isShaking = ref(false)
const currentPosition = ref<TranslationPosition>({
  left: props.position.left,
  top: props.position.top
})

let startX = 0
let startY = 0
let startLeft = 0
let startTop = 0
let previousUserSelect = ''
let shakeTimer: ReturnType<typeof setTimeout> | null = null

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

const clampPosition = (left: number, top: number): TranslationPosition => {
  const margin = 12
  const panelWidth = panelRef.value?.offsetWidth ?? 560
  const panelHeight = panelRef.value?.offsetHeight ?? 320
  const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin)
  const maxTop = Math.max(margin, window.innerHeight - panelHeight - margin)

  return {
    left: Math.round(clamp(left, margin, maxLeft)),
    top: Math.round(clamp(top, margin, maxTop))
  }
}

const syncPosition = (position: TranslationPosition) => {
  currentPosition.value = clampPosition(position.left, position.top)
}

const stopDragging = () => {
  if (!isDragging.value) {
    return
  }

  isDragging.value = false
  document.body.style.userSelect = previousUserSelect
  window.removeEventListener('pointermove', handlePointerMove, true)
  window.removeEventListener('pointerup', stopDragging, true)
  window.removeEventListener('pointercancel', stopDragging, true)
}

const handlePointerMove = (event: PointerEvent) => {
  if (!isDragging.value) {
    return
  }

  const nextLeft = startLeft + event.clientX - startX
  const nextTop = startTop + event.clientY - startY
  currentPosition.value = clampPosition(nextLeft, nextTop)
}

const handlePointerDown = (event: PointerEvent) => {
  if (event.button !== 0) {
    return
  }

  const target = event.target as HTMLElement | null
  if (target?.closest('button')) {
    return
  }

  event.preventDefault()

  isDragging.value = true
  startX = event.clientX
  startY = event.clientY
  startLeft = currentPosition.value.left
  startTop = currentPosition.value.top
  previousUserSelect = document.body.style.userSelect
  document.body.style.userSelect = 'none'

  window.addEventListener('pointermove', handlePointerMove, true)
  window.addEventListener('pointerup', stopDragging, true)
  window.addEventListener('pointercancel', stopDragging, true)
}

watch(() => props.position, (position) => {
  if (!position || isDragging.value) {
    return
  }

  syncPosition(position)
}, { deep: true, immediate: true })

watch(() => props.visible, (visible) => {
  if (!visible || isDragging.value || !props.position) {
    return
  }

  syncPosition(props.position)
})

const panelStyle = computed(() => ({
  left: `${currentPosition.value.left}px`,
  top: `${currentPosition.value.top}px`
}))

const triggerShake = () => {
  if (shakeTimer) {
    clearTimeout(shakeTimer)
    shakeTimer = null
  }

  isShaking.value = false
  requestAnimationFrame(() => {
    isShaking.value = true
    shakeTimer = window.setTimeout(() => {
      isShaking.value = false
      shakeTimer = null
    }, 420)
  })
}

watch(() => props.shakeKey, (nextValue, previousValue) => {
  if (nextValue === previousValue) {
    return
  }

  triggerShake()
})

onUnmounted(() => {
  stopDragging()
  if (shakeTimer) {
    clearTimeout(shakeTimer)
  }
})
</script>

<style scoped>
.translation-panel {
  position: fixed;
  width: min(560px, calc(100vw - 24px));
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
  z-index: 999999;
  border: 1px solid var(--scifi-border-color);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(8, 14, 24, 0.96), rgba(10, 18, 30, 0.92));
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(59, 130, 246, 0.18);
  backdrop-filter: blur(14px);
  transition: border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
}

.translation-panel.is-shaking {
  animation: translation-panel-shake 0.42s ease;
  border-color: rgba(120, 208, 255, 0.95);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.36), 0 0 0 1px rgba(120, 208, 255, 0.9), 0 0 22px rgba(73, 187, 255, 0.5);
  background: linear-gradient(180deg, rgba(16, 28, 44, 0.98), rgba(9, 34, 58, 0.94));
}

.translation-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid var(--scifi-border-color);
  background: linear-gradient(135deg, rgba(18, 33, 54, 0.96), rgba(12, 21, 36, 0.92));
  transition: background 0.22s ease, border-color 0.22s ease;
}

.translation-panel__header.is-dragging {
  cursor: grabbing;
}

.translation-panel.is-shaking .translation-panel__header {
  border-bottom-color: rgba(120, 208, 255, 0.9);
  background: linear-gradient(135deg, rgba(24, 55, 92, 0.98), rgba(14, 42, 74, 0.95));
}

.translation-panel__title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--scifi-text-primary);
  transition: color 0.22s ease, text-shadow 0.22s ease;
}

.translation-panel.is-shaking .translation-panel__title {
  color: #d9f6ff;
  text-shadow: 0 0 10px rgba(121, 225, 255, 0.6);
}

.translation-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--scifi-border-color);
  border-radius: 6px;
  background: linear-gradient(135deg, var(--scifi-bg-primary), var(--scifi-bg-secondary));
  color: var(--scifi-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.22s ease;
}

.translation-panel.is-shaking .translation-panel__close {
  border-color: rgba(120, 208, 255, 0.95);
  color: #d9f6ff;
  box-shadow: 0 0 0 1px rgba(120, 208, 255, 0.5);
}

.translation-panel__close:hover {
  border-color: var(--scifi-accent-primary);
  box-shadow: 0 0 0 1px var(--scifi-accent-primary);
  transform: translateY(-1px);
}

.translation-panel__body {
  overflow: auto;
  max-height: calc(70vh - 46px);
  padding: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.65;
  font-size: 14px;
  font-family: 'Courier New', Courier, monospace;
  transition: color 0.22s ease, background 0.22s ease;
}

.translation-panel.is-shaking .translation-panel__body {
  background: linear-gradient(180deg, rgba(9, 20, 33, 0.22), rgba(12, 42, 69, 0.18));
}

.translation-panel__body.is-loading {
  color: var(--scifi-text-secondary);
}

.translation-panel__body.is-success {
  color: var(--scifi-text-primary);
}

.translation-panel__body.is-error {
  color: #ff7b7b;
}

@keyframes translation-panel-shake {
  0%, 100% {
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
</style>
