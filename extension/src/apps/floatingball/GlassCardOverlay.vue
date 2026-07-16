<template>
  <!-- <Teleport to="body"> -->
  <Draggable v-if="visible" ref="draggableRef" :initial-position="'center'" :enable-adsorption="false"
    :drag-handle="'.glass-card-header'" :can-overflow="false" :container-style="{ '--z-index': 2147483646 }" width="360"
    height="280" @drag-start="handleDragStart" @drag-end="handleDragEnd">
    <div class="glass-card" :class="{ 'glass-card--expanded': isCardExpanded }" :style="cardStyle" @dblclick="closeCard"
      @mouseenter="isHovered = true" @mouseleave="isHovered = false">
      <div class="glass-card-content">
        <div class="glass-card-header" @dblclick.stop="closeCard">
          <div class="title-block">
            <strong>悬浮毛玻璃卡片</strong>
            <span>拖动标题栏移动，右下角可缩放，双击空白区域关闭</span>
          </div>
          <button type="button" class="close-button" @click.stop="closeCard">关闭</button>
        </div>

        <div class="glass-card-body">
          <!-- <div class="glass-card-preview" @dblclick="closeCard">
              <p>毛玻璃卡片</p>
              <span>颜色、透明度和玻璃风格会实时生效。</span>
            </div> -->

          <div class="glass-card-controls" @dblclick.stop>

            <label class="control-item color-item">
              <div class="control-item-content">
                <span>颜色</span>
                <strong>{{ tint }}</strong>
              </div>
              <input v-model="tint" type="color">
            </label>

            <label class="control-item">
              <div class="control-item-content">
                <span>透明度</span>
                <strong>{{ opacityLabel }}</strong>
              </div>
              <input v-model.number="opacity" type="range" min="0.02" max="0.98" step="0.02">
            </label>

            <label class="control-item">
              <span>玻璃风格</span>
              <select v-model="stylePreset">
                <option value="frosted">柔雾</option>
                <option value="crystal">水晶</option>
                <option value="aurora">极光</option>
                <option value="smoke">烟幕</option>
              </select>
            </label>
          </div>
        </div>

        <div class="glass-card-footer" @dblclick.stop>
          <button type="button" class="ghost-button" @click="resetCard">重置样式</button>
        </div>
      </div>

      <div class="resize-handle resize-handle-nw" @pointerdown.stop.prevent="startResize('nw', $event)"></div>
      <div class="resize-handle resize-handle-ne" @pointerdown.stop.prevent="startResize('ne', $event)"></div>
      <div class="resize-handle resize-handle-sw" @pointerdown.stop.prevent="startResize('sw', $event)"></div>
      <div class="resize-handle resize-handle-se" @pointerdown.stop.prevent="startResize('se', $event)"></div>
    </div>
  </Draggable>
  <!-- </Teleport> -->
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {Draggable} from '@components/index';

interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false
});

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>();

const draggableRef = ref<any>(null);
const width = ref(360);
const height = ref(280);
const tint = ref('#8ec5ff');
const opacity = ref(0.24);
const stylePreset = ref<'frosted' | 'crystal' | 'aurora' | 'smoke'>('frosted');
const isHovered = ref(false);
const isDragging = ref(false);
const isResizing = ref(false);

const MIN_WIDTH = 260;
const MAX_WIDTH = 760;
const MIN_HEIGHT = 220;
const MAX_HEIGHT = 600;
type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se'

let activePointerId: number | null = null;
let resizeState: {
  direction: ResizeDirection
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startLeft: number
  startTop: number
} | null = null;

const presetConfig = computed(() => {
  switch (stylePreset.value) {
    case 'crystal':
      return {
        blur: 22,
        saturate: 180,
        borderAlpha: 0.42,
        shadow: '0 28px 60px rgba(15, 23, 42, 0.2)',
        sheen: 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.08))'
      };
    case 'aurora':
      return {
        blur: 26,
        saturate: 205,
        borderAlpha: 0.3,
        shadow: '0 28px 68px rgba(29, 78, 216, 0.22)',
        sheen: 'linear-gradient(135deg, rgba(255,255,255,0.32), rgba(76, 201, 240, 0.18) 45%, rgba(167, 139, 250, 0.18))'
      };
    case 'smoke':
      return {
        blur: 18,
        saturate: 125,
        borderAlpha: 0.22,
        shadow: '0 24px 52px rgba(15, 23, 42, 0.28)',
        sheen: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(15,23,42,0.14))'
      };
    default:
      return {
        blur: 20,
        saturate: 155,
        borderAlpha: 0.34,
        shadow: '0 24px 56px rgba(15, 23, 42, 0.18)',
        sheen: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.08))'
      };
  }
});

const opacityLabel = computed(() => `${Math.round(opacity.value * 100)}%`);
const isCardExpanded = computed(() => isHovered.value || isDragging.value || isResizing.value);

const cardStyle = computed<Record<string, string>>(() => {
  const rgb = hexToRgb(tint.value);
  const panelOpacity = opacity.value;
  const opacityProgress = clamp((panelOpacity - 0.02) / 0.96, 0, 1);
  const blurStrength = 0.4 + presetConfig.value.blur * opacityProgress;
  const saturateStrength = 100 + (presetConfig.value.saturate - 100) * opacityProgress;
  const borderOpacity = Math.min(panelOpacity + presetConfig.value.borderAlpha, 0.9);

  return {
    width: `${width.value}px`,
    height: `${height.value}px`,
    background: `${presetConfig.value.sheen}, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${panelOpacity})`,
    border: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
    boxShadow: presetConfig.value.shadow,
    backdropFilter: `blur(${blurStrength.toFixed(2)}px) saturate(${saturateStrength.toFixed(0)}%)`,
    WebkitBackdropFilter: `blur(${blurStrength.toFixed(2)}px) saturate(${saturateStrength.toFixed(0)}%)`
  };
});

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized;

  const value = Number.parseInt(safeHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function closeCard() {
  emit('update:visible', false);
}

function resetCard() {
  width.value = 360;
  height.value = 280;
  tint.value = '#8ec5ff';
  opacity.value = 0.24;
  stylePreset.value = 'frosted';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCurrentPosition() {
  if (!draggableRef.value?.getCurrentPosition) {
    return { x: 0, y: 0 };
  }

  return draggableRef.value.getCurrentPosition() as { x: number, y: number };
}

function setCurrentPosition(x: number, y: number) {
  if (draggableRef.value?.setPositionImmediate) {
    draggableRef.value.setPositionImmediate(x, y);
    return;
  }

  if (!draggableRef.value?.setPosition) {
    return;
  }

  draggableRef.value.setPosition(x, y);
}

function startResize(direction: ResizeDirection, event: PointerEvent) {
  const position = getCurrentPosition();
  resizeState = {
    direction,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: width.value,
    startHeight: height.value,
    startLeft: position.x,
    startTop: position.y
  };

  isResizing.value = true;
  activePointerId = event.pointerId;
  window.addEventListener('pointermove', handleResizeMove, { capture: true });
  window.addEventListener('pointerup', stopResize, { capture: true });
  window.addEventListener('pointercancel', stopResize, { capture: true });
  document.body.style.userSelect = 'none';
}

function handleResizeMove(event: PointerEvent) {
  if (!resizeState || activePointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - resizeState.startX;
  const deltaY = event.clientY - resizeState.startY;

  let nextWidth = resizeState.startWidth;
  let nextHeight = resizeState.startHeight;
  let nextLeft = resizeState.startLeft;
  let nextTop = resizeState.startTop;

  if (resizeState.direction.includes('e')) {
    nextWidth = clamp(resizeState.startWidth + deltaX, MIN_WIDTH, MAX_WIDTH);
  }

  if (resizeState.direction.includes('s')) {
    nextHeight = clamp(resizeState.startHeight + deltaY, MIN_HEIGHT, MAX_HEIGHT);
  }

  if (resizeState.direction.includes('w')) {
    nextWidth = clamp(resizeState.startWidth - deltaX, MIN_WIDTH, MAX_WIDTH);
    nextLeft = resizeState.startLeft + (resizeState.startWidth - nextWidth);
  }

  if (resizeState.direction.includes('n')) {
    nextHeight = clamp(resizeState.startHeight - deltaY, MIN_HEIGHT, MAX_HEIGHT);
    nextTop = resizeState.startTop + (resizeState.startHeight - nextHeight);
  }

  nextLeft = clamp(nextLeft, 0, Math.max(window.innerWidth - nextWidth, 0));
  nextTop = clamp(nextTop, 0, Math.max(window.innerHeight - nextHeight, 0));

  width.value = nextWidth;
  height.value = nextHeight;
  setCurrentPosition(nextLeft, nextTop);
  event.preventDefault();
}

function stopResize(event?: PointerEvent) {
  if (event && activePointerId !== event.pointerId) {
    return;
  }

  isResizing.value = false;
  activePointerId = null;
  resizeState = null;
  window.removeEventListener('pointermove', handleResizeMove, { capture: true });
  window.removeEventListener('pointerup', stopResize, { capture: true });
  window.removeEventListener('pointercancel', stopResize, { capture: true });
  document.body.style.userSelect = '';
}

function handleDragStart() {
  isDragging.value = true;
}

function handleDragEnd() {
  isDragging.value = false;
}

watch(() => props.visible, visible => {
  if (!visible) {
    isHovered.value = false;
    isDragging.value = false;
    isResizing.value = false;
    stopResize();
  }
});

onBeforeUnmount(() => {
  stopResize();
});
</script>

<style scoped>
.glass-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-width: 260px;
  min-height: 220px;
  max-width: min(760px, calc(100vw - 32px));
  max-height: min(600px, calc(100vh - 32px));
  overflow: hidden;
  border-radius: 8px;
  color: #eff6ff;
  cursor: default;
  user-select: none;
}

.glass-card-content {
  position: relative;
  z-index: 1;
  height: 100%;
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.22s ease;
}

.glass-card--expanded .glass-card-content {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.35), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 28%);
  pointer-events: none;
}

.glass-card-header,
.glass-card-body,
.glass-card-footer {
  position: relative;
  z-index: 1;
}

.glass-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
  cursor: grab;
}

.glass-card-header:active {
  cursor: grabbing;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 16px;
}

.title-block strong {
  font-size: 16px;
  line-height: 1.2;
}

.title-block span {
  font-size: 12px;
  line-height: 1.4;
  color: rgba(239, 246, 255, 0.82);
}

.close-button,
.ghost-button {
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  color: #eff6ff;
  background: rgba(15, 23, 42, 0.28);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.close-button:hover,
.ghost-button:hover {
  background: rgba(15, 23, 42, 0.42);
  transform: translateY(-1px);
}

.glass-card-body {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  padding: 16px 18px;
}

.glass-card-preview {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-height: 88px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.glass-card-preview p {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.glass-card-preview span {
  font-size: 13px;
  color: rgba(239, 246, 255, 0.88);
}

.glass-card-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.control-item span {
  font-size: 12px;
  color: rgba(239, 246, 255, 0.82);
}

.control-item strong {
  font-size: 12px;
  color: #f8fafc;
}

.control-item input[type='range'],
.control-item select,
.control-item input[type='color'] {
  width: 100%;
}

.control-item select {
  border: none;
  border-radius: 12px;
  padding: 8px 10px;
  color: #eff6ff;
  background: rgba(15, 23, 42, 0.3);
  outline: none;
}

.control-item input[type='color'] {
  height: 25px;
  width: 25px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.control-item-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

.glass-card-footer {
  display: flex;
  justify-content: flex-end;
  padding: 0 18px 18px;
}

.resize-handle {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
  z-index: 2;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  opacity: 0;
  pointer-events: none;
  transform: scale(0.72);
  transition: opacity 0.18s ease, transform 0.22s ease;
}

.glass-card--expanded .resize-handle {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
}

.resize-handle-nw {
  top: 8px;
  left: 8px;
  cursor: nwse-resize;
}

.resize-handle-ne {
  top: 8px;
  right: 8px;
  cursor: nesw-resize;
}

.resize-handle-sw {
  bottom: 8px;
  left: 8px;
  cursor: nesw-resize;
}

.resize-handle-se {
  right: 8px;
  bottom: 8px;
  cursor: nwse-resize;
}

@media (max-width: 640px) {
  .glass-card {
    max-width: calc(100vw - 20px);
    max-height: calc(100vh - 20px);
  }

  .glass-card-controls {
    grid-template-columns: 1fr;
  }

  .close-button {
    padding: 7px 10px;
  }
}
</style>
