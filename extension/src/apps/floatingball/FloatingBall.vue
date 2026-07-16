<!-- src/floatingball/FloatingBall.vue -->
<template>
  <div class="constraints">
    <Draggable ref="draggableRef" v-bind="draggableProps" width="45" height="45"
      @click="handleIconClick" @dragging="handleDragging" @move="handleMove">
      <!-- 悬浮球图标 -->
      <div class="icon" draggable="false">
        <slot name="icon">
          <img :src="icon">
        </slot>
      </div>
      <slot name="content">
        <!-- 默认插槽 -->
      </slot>
    </Draggable>

    <!-- 卫星环绕效果组件 -->
    <!-- <StarOrbit :position="position" :is-visible="showOrbit" /> -->
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { getStaticAbstractPath } from '@/utils/common';
import { shadowHostId } from '@/config';
import { Draggable, type DraggableProps } from '@components/index';

const draggableProps: DraggableProps = {
  initialPosition: 'bottom-right',
  edgeDistance: 50,
  adsorbMargin: 15,
  enableAdsorption: true
};

// 悬浮球位置状态 
const position = ref<{ x: number, y: number }>({ x: 2000, y: 1200 });
// const draggableRef = ref<typeof Draggable>();
const showOrbit = ref(true);

const props = withDefaults(defineProps<{
  icon?: string
  theam?: string
  handleClick?: Function
}>(), {
  icon: getStaticAbstractPath('icons/floatingball.png'),
  handleClick: () => { maLogger.log('我被点击了！'); }
});

const emit = defineEmits<{
  /** 点击事件（非拖拽） */
  (e: 'click', event: MouseEvent | TouchEvent): void;
}>();

/**
 * 处理悬浮球点击事件
 */
function handleIconClick(event: MouseEvent | TouchEvent) {
  if (!event.target) {return;}
  // 检查点击是否在阴影DOM内
  if ((event.target as HTMLElement).closest(`#${shadowHostId}`)) {
    emit('click', event);
    // 切换卫星圆环的显示状态
    // showOrbit.value = !showOrbit.value
  }
}

/**
 * 处理拖拽中事件
 */
function handleDragging(event: MouseEvent | TouchEvent, x: number, y: number) {
  // 实时更新位置状态
  if (!showOrbit.value) {return;}
  // 调整位置，使图标中心对齐
  position.value = { x: x + 22.5, y: y + 22.5 };
}

function handleMove(x: number, y: number) {
  // 调整位置，使图标中心对齐
  position.value = { x: x + 22.5, y: y + 22.5 };
  // maLogger.log('初始位置:', position.value);
  // showOrbit.value = true;
}
</script>

<style scoped>
.constraints {
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none
}

.icon {
  width: 45px;
  height: 45px;
  user-select: none;
  position: fixed;
  z-index: 10;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(145deg, rgba(125, 211, 252, 0.16), rgba(251, 191, 36, 0.08)),
    linear-gradient(160deg, rgba(10, 19, 37, 0.96), rgba(11, 18, 31, 0.84));
  backdrop-filter: blur(16px) saturate(155%);
  -webkit-backdrop-filter: blur(16px) saturate(155%);
  border-radius: 50%;
  box-shadow:
    0 12px 30px rgba(0, 0, 0, 0.32),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 0 22px rgba(125, 211, 252, 0.24);
  opacity: 1;
  will-change: auto;
  touch-action: none;
  overflow: visible;
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

.icon::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px solid rgba(125, 211, 252, 0.18);
  box-shadow: 0 0 18px rgba(125, 211, 252, 0.12);
  animation: iconOrbitPulse 2.8s ease-in-out infinite;
  pointer-events: none;
}

.icon::after {
  content: '';
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #7dd3fc, #fbbf24);
  box-shadow: 0 0 12px rgba(125, 211, 252, 0.4);
  pointer-events: none;
}

.icon :slotted(:first-child) {
  width: 45px;
  height: 45px;
  user-select: none;
  border-radius: 50%;
  padding: 6px;
  box-sizing: border-box;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.2));
}

.icon:active {
  transform: scale(0.96);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 0 18px rgba(125, 211, 252, 0.18);
}

.icon:hover {
  transform: translateY(-1px) scale(1.08);
  box-shadow:
    0 18px 36px rgba(0, 0, 0, 0.34),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 0 28px rgba(125, 211, 252, 0.34);
  border-color: rgba(125, 211, 252, 0.24);
}

@keyframes iconOrbitPulse {

  0%,
  100% {
    opacity: 0.65;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}
</style>
