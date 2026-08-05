<template>
  <!-- 拖拽遮罩层，用于捕获鼠标事件 -->
  <div v-if="isDragging" class="drag-mask" @mousemove.stop @touchmove.stop @mouseup.stop @touchend.stop
    @touchcancel.stop @mouseleave.stop />
  <div ref="containerRef" :class="['draggable-container', customClass]" :style="containerStyle"
    @mousedown.stop="startDrag" @touchstart.stop="startDrag">
    <slot>
      <!-- 拖拽内容插槽 -->
    </slot>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, useAttrs } from 'vue';

// 定义props类型
export interface DraggableProps {
  /** 自定义类名 */
  customClass?: string;
  /** 初始X坐标 */
  initialX?: number;
  /** 初始Y坐标 */
  initialY?: number;
  /** 预设初始位置：屏幕四个角落、四条边和中间 */
  initialPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left' | 'center';
  /** 边缘检测距离 */
  edgeDistance?: number;
  /** 吸附边距 */
  adsorbMargin?: number;
  /** 是否启用吸附功能 */
  enableAdsorption?: boolean;
  /** 是否允许超出屏幕 */
  canOverflow?: boolean;
  /** 容器样式 */
  containerStyle?: Record<string, any>;
  /** 缓动因子，用于平滑过渡效果，值越大过渡越慢，范围0-1 */
  easeFactor?: number;
  /** 拖拽手柄选择器，只有点击该选择器匹配的元素才会触发拖拽 */
  dragHandle?: string;
}

// 默认props值
const props = withDefaults(defineProps<DraggableProps>(), {
  customClass: '',
  initialX: 0,
  initialY: 0,
  initialPosition: 'center',
  edgeDistance: 50,
  adsorbMargin: 0,
  enableAdsorption: false,
  canOverflow: false,
  containerStyle: () => ({}),
  easeFactor: 0.2, // 默认缓动因子，值越大过渡越慢，范围0-1
  dragHandle: '' // 默认没有拖拽手柄，整个容器都可以拖拽
});

defineOptions({
  name: 'Draggable',
  inheritAttrs: false // 禁用组件的默认属性继承
});

const attrs = useAttrs();
// maLogger.log('attrs:', attrs)
const width = attrs.width as number ?? 45;
const height = attrs.height as number ?? 45;

// 定义事件类型
const emit = defineEmits<{
  /** 拖拽开始事件 */
  (e: 'drag-start', event: MouseEvent | TouchEvent): void;
  /** 拖拽中事件 */
  (e: 'dragging', event: MouseEvent | TouchEvent, x: number, y: number): void;
  /** 拖拽结束事件 */
  (e: 'drag-end', event: MouseEvent | TouchEvent, x: number, y: number): void;
  /** 吸附事件 */
  (e: 'adsorbed', direction: 'left' | 'right' | 'top' | 'bottom'): void;
  /** 点击事件（非拖拽） */
  (e: 'click', event: MouseEvent | TouchEvent): void;
  /** 组件挂载完成事件，返回初始位置 */
  (e: 'move', x: number, y: number): void;
}>();

// 组件引用
const containerRef = ref<HTMLElement | null>(null);

// 拖拽状态
const isDragging = ref(false);
const hasExceededThreshold = ref(false); // 标记是否超过移动阈值
const translateX = ref(props.initialX);
const translateY = ref(props.initialY);
const targetX = ref(props.initialX); // 目标X位置，用于平滑过渡
const targetY = ref(props.initialY); // 目标Y位置，用于平滑过渡
const lastClientX = ref(0);
const lastClientY = ref(0);
const MOVE_THRESHOLD = 10; // 移动阈值，超过则认为是拖拽，增大阈值减少误判
let animationFrameId: number | null = null; // 动画帧ID，用于管理动画
const isPositionInitialized = ref(false); // 标记位置是否已经初始化，防止吸附后重置

// 计算容器样式
const containerStyle = computed<Record<string, any>>(() => ({
  ...props.containerStyle,
  // 使用CSS变量进行定位
  '--translate-x': `${translateX.value}px`,
  '--translate-y': `${translateY.value}px`,
  transform: 'translate(var(--translate-x), var(--translate-y))'
}));

/**
 * 平滑过渡动画函数
 */
function animatePosition() {
  // 计算当前位置到目标位置的距离
  const dx = targetX.value - translateX.value;
  const dy = targetY.value - translateY.value;

  // 如果距离小于阈值，直接设置为目标位置，避免抖动
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
    translateX.value = targetX.value;
    translateY.value = targetY.value;
    return;
  }

  // 使用缓动函数计算新位置
  // 转换为基于60fps的因子，值越大过渡越慢
  // 计算方式：1 - Math.pow(1 - (1 - easeFactor), 60 / 16)
  // 推导：
  // - easeFactor 越大，(1 - easeFactor) 越小
  // - Math.pow(...) 越小
  // - 1 - Math.pow(...) 越小
  // - 位置变化越小，过渡越慢
  const factor = 1 - Math.pow(1 - (1 - props.easeFactor), 60 / 16); // 转换为基于60fps的因子

  // 更新位置
  translateX.value += dx * factor;
  translateY.value += dy * factor;

  // 继续下一帧动画
  animationFrameId = requestAnimationFrame(animatePosition);
}

let initialLeft = 0;
let initialTop = 0;
let startX = 0;
let startY = 0;

/**
 * 开始拖拽
 */
function startDrag(event: MouseEvent | TouchEvent) {
  if (!containerRef.value) {return;}

  // 统一处理鼠标和触摸事件
  const e = 'touches' in event ? event.touches[0] : event;
  const target = e.target as HTMLElement;

  // 检查是否设置了拖拽手柄，如果设置了，只有点击拖拽手柄时才开始拖拽
  if (props.dragHandle) {
    // 检查点击的目标是否是拖拽手柄或其子元素
    const isClickOnHandle = target.closest(props.dragHandle);
    if (!isClickOnHandle) {
      return;
    }
  }

  // 检查是否点击了可交互元素，如果是则不开始拖拽
  if (target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLButtonElement ||
    target.closest('button') ||
    target.closest('input') ||
    target.closest('textarea') ||
    target.closest('.el-input') ||
    target.closest('.el-button')) {
    return;
  }

  const clientX = e.clientX;
  const clientY = e.clientY;

  // 获取当前位置
  const { left, top } = getElementRectPositin();
  initialLeft = left;
  initialTop = top;

  // 初始化状态
  hasExceededThreshold.value = false;
  isDragging.value = true;

  // 暂停MutationObserver，防止拖动时被打断
  mutationObserver.disconnect();

  // 记录初始位置：鼠标位置和当前元素的偏移量
  startX = clientX; // 记录鼠标按下时的X位置
  startY = clientY; // 记录鼠标按下时的Y位置

  // 记录当前元素的偏移量
  lastClientX.value = translateX.value;
  lastClientY.value = translateY.value;

  // 使用window添加事件监听器并启用捕获，解决iframe环境下拖动跟丢问题
  window.addEventListener('mousemove', onDrag, { capture: true, passive: false });
  window.addEventListener('mouseup', endDrag, { capture: true });

  // 防止文本选中和默认行为
  event.preventDefault();
  event.stopPropagation();
}

/**
 * 拖拽中
 */
function onDrag(event: MouseEvent | TouchEvent) {
  if (!containerRef.value) {return;}

  isDragging.value = true;

  // 统一处理鼠标和触摸事件
  const e = 'touches' in event ? event.touches[0] : event;
  const clientX = e.clientX;
  const clientY = e.clientY;

  // 计算鼠标移动距离
  const deltaX = clientX - startX;
  const deltaY = clientY - startY;
  const distance = deltaX ** 2 + deltaY ** 2;

  // 如果移动距离超过阈值，标记为拖拽
  if (distance > MOVE_THRESHOLD ** 2) {
    hasExceededThreshold.value = true;
  }

  // 计算新位置：鼠标移动的距离 + 初始元素偏移量
  let newTranslateX = initialLeft + deltaX; // 初始偏移量 + 移动距离
  let newTranslateY = initialTop + deltaY; // 初始偏移量 + 移动距离

  // 如果不允许超出屏幕，限制元素在屏幕范围内
  if (!props.canOverflow) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const { width: elementWidth, height: elementHeight } = getElementWidthAndHeight();

    // 计算最大和最小translate值
    const maxTranslateX = windowWidth - elementWidth;
    const minTranslateX = 0;
    const maxTranslateY = windowHeight - elementHeight;
    const minTranslateY = 0;

    // 限制在屏幕范围内
    newTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, newTranslateX));
    newTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, newTranslateY));
  }

  // 拖拽过程中直接更新位置，不使用平滑过渡，确保实时响应
  translateX.value = newTranslateX;
  translateY.value = newTranslateY;
  // 同时更新目标位置，确保拖拽结束后平滑过渡能正确开始
  targetX.value = newTranslateX;
  targetY.value = newTranslateY;

  // 防止默认行为，确保拖拽流畅
  event.preventDefault();
  event.stopPropagation();

  // 触发拖拽中事件
  emit('dragging', event, translateX.value, translateY.value);
}

/**
 * 结束拖拽
 */
function endDrag(event: MouseEvent | TouchEvent) {
  if (!containerRef.value) {return;}

  // 从window移除事件监听器
  window.removeEventListener('mousemove', onDrag, { capture: true });
  window.removeEventListener('mouseup', endDrag, { capture: true });

  // 检测是否为点击事件：只有当从未超过移动阈值时才认为是点击
  if (!hasExceededThreshold.value) {
    // maLogger.log('触发点击事件，冒泡')
    // 延迟触发点击事件，确保拖拽逻辑完全结束
    setTimeout(() => {
      emit('click', event);
    }, 0);
  } else {
    // 如果启用吸附功能，执行吸附逻辑
    props.enableAdsorption && checkAbsorption();
    // 触发拖拽结束事件
    emit('drag-end', event, translateX.value, translateY.value);
  }

  // 重置状态
  isDragging.value = false;
  hasExceededThreshold.value = false;

  // 恢复MutationObserver，继续监听元素变化
  mutationObserver.observe(containerRef.value, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'], // 只监听style和class属性变化
    characterData: false // 关闭文本数据变化监听
  });
}

/**
 * 检查吸附
 */
function checkAbsorption() {
  if (!containerRef.value) {return;}

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // 获取元素的实际位置和尺寸
  const { width: elementWidth, height: elementHeight } = getElementWidthAndHeight();

  const elementRect = containerRef.value.getBoundingClientRect();

  // maLogger.log('元素位置:', elementRect)
  // maLogger.log('窗口尺寸:', { windowWidth, windowHeight })

  // 计算到各边的实际距离
  const leftDistance = elementRect.left;
  const topDistance = elementRect.top;
  const rightDistance = windowWidth - elementRect.right;
  const bottomDistance = windowHeight - elementRect.bottom;

  // maLogger.log('元素距离各边的距离:', { leftDistance, topDistance, rightDistance, bottomDistance })

  // 只有当靠近边缘时才进行吸附
  let shouldAdsorb = false;
  let newTranslateX = translateX.value;
  let newTranslateY = translateY.value;
  let adsorbedDirection: 'left' | 'right' | 'top' | 'bottom' | null = null;

  // X轴吸附逻辑
  if (leftDistance < props.edgeDistance) {
    // 吸附到左侧边缘
    newTranslateX = props.adsorbMargin!;
    shouldAdsorb = true;
    adsorbedDirection = 'left';
  } else if (rightDistance < props.edgeDistance) {
    // 吸附到右侧边缘
    newTranslateX = windowWidth - elementWidth - props.adsorbMargin!;
    shouldAdsorb = true;
    adsorbedDirection = 'right';
  }

  // Y轴吸附逻辑
  if (topDistance < props.edgeDistance) {
    // 吸附到顶部边缘
    newTranslateY = props.adsorbMargin!;
    shouldAdsorb = true;
    adsorbedDirection = 'top';
  } else if (bottomDistance < props.edgeDistance) {
    // 吸附到底部边缘
    newTranslateY = windowHeight - elementHeight - props.adsorbMargin!;
    shouldAdsorb = true;
    adsorbedDirection = 'bottom';
  }

  // 只有需要吸附时才更新位置
  if (shouldAdsorb && adsorbedDirection) {
    translateX.value = newTranslateX;
    translateY.value = newTranslateY;

    // maLogger.log('吸附方向:', adsorbedDirection)
    // maLogger.log('吸附位置:', { x: newTranslateX, y: newTranslateY })

    // 触发吸附事件
    emit('move', translateX.value, translateY.value);
  }
}

/**
 * 计算初始位置 - 确保元素在屏幕内
 */
function calculateInitialPosition() {
  if (!containerRef.value) {return;}

  // 如果位置已经初始化，不再执行初始位置计算，防止吸附后重置
  if (isPositionInitialized.value) {return;}

  const windowWidth = window.innerWidth; // 1920
  const windowHeight = window.innerHeight; //911
  const { width: elementWidth, height: elementHeight } = getElementWidthAndHeight(); //45,45
  // maLogger.log('首次加载的元素尺寸:', { width: elementWidth, height: elementHeight })
  let newX = translateX.value;
  let newY = translateY.value;

  // 优先处理预设位置
  if (props.initialPosition) {
    switch (props.initialPosition) {
      case 'top-left':
        newX = props.adsorbMargin;
        newY = props.adsorbMargin;
        break;
      case 'top-right':
        newX = windowWidth - elementWidth - props.adsorbMargin;
        newY = props.adsorbMargin;
        break;
      case 'bottom-left':
        newX = props.adsorbMargin;
        newY = windowHeight - elementHeight - props.adsorbMargin;
        break;
      case 'bottom-right':
        newX = windowWidth - elementWidth - props.adsorbMargin;
        newY = windowHeight - elementHeight - props.adsorbMargin;
        break;
      case 'top':
        newX = (windowWidth - elementWidth) / 2;
        newY = props.adsorbMargin;
        break;
      case 'right':
        newX = windowWidth - elementWidth - props.adsorbMargin;
        newY = (windowHeight - elementHeight) / 2;
        break;
      case 'bottom':
        newX = (windowWidth - elementWidth) / 2;
        newY = windowHeight - elementHeight - props.adsorbMargin;
        break;
      case 'left':
        newX = props.adsorbMargin;
        newY = (windowHeight - elementHeight) / 2;
        break;
      case 'center':
        newX = (windowWidth - elementWidth) / 2;
        newY = (windowHeight - elementHeight) / 2;
        break;
    }
  }

  // 计算初始位置的最大和最小值
  const maxTranslateX = windowWidth - elementWidth;
  const minTranslateX = 0;
  const maxTranslateY = windowHeight - elementHeight;
  const minTranslateY = 0;

  // 确保初始位置在屏幕范围内
  newX = Math.max(minTranslateX, Math.min(maxTranslateX, newX));
  newY = Math.max(minTranslateY, Math.min(maxTranslateY, newY));

  // 更新目标位置，使用平滑过渡
  targetX.value = newX;
  targetY.value = newY;

  // 启动平滑过渡动画
  animatePosition();

  // 标记位置已经初始化，防止后续被重置
  isPositionInitialized.value = true;
  // 触发组件挂载完成事件，返回初始位置
  emit('move', translateX.value, translateY.value);
}

function getElementWidthAndHeight() {
  if (!containerRef.value) {return { width: 0, height: 0 };}
  // maLogger.log('containerRef.value', containerRef.value)
  const children = containerRef.value.children;
  let elementWidth = 0;
  let elementHeight = 0;

  // 计算所有子元素的总宽高
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const rect = child.getBoundingClientRect();
    elementWidth = Math.max(elementWidth, rect.width);
    elementHeight = Math.max(elementHeight, rect.height);
    // maLogger.log('elementWidth', elementWidth)
    // maLogger.log('elementHeight', elementHeight)
  }
  return {
    width: elementWidth < width ? width : elementWidth,
    height: elementHeight < height ? height : elementHeight
  };
}

function getElementRectPositin() {
  if (!containerRef.value) {return { left: 0, top: 0, width: 0, height: 0 };}
  const rect = containerRef.value.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

/**
 * 获取当前位置
 */
function getCurrentPosition() {
  return {
    x: translateX.value,
    y: translateY.value
  };
}

/**
 * 设置位置
 */
function setPosition(x: number, y: number) {
  // 更新目标位置，使用平滑过渡
  targetX.value = x;
  targetY.value = y;

  // 启动平滑过渡动画
  animatePosition();
}

function setPositionImmediate(x: number, y: number) {
  targetX.value = x;
  targetY.value = y;
  translateX.value = x;
  translateY.value = y;
}

const mutationObserver = new MutationObserver(() => {
  calculateInitialPosition();
});

onMounted(() => {
  nextTick(() => {
    calculateInitialPosition();
  });
  mutationObserver.observe(containerRef.value!, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'], // 只监听style和class属性变化
    characterData: false // 关闭文本数据变化监听
  });
});

onUnmounted(() => {
  mutationObserver.disconnect();
});

// 暴露公共方法
defineExpose({
  getCurrentPosition,
  setPosition,
  setPositionImmediate
});
</script>

<style scoped>
/* 拖拽容器样式 */
.draggable-container {
  cursor: pointer;
  position: fixed;
  z-index: var(--z-index, 9999);
  user-select: none;
  will-change: transform;
  touch-action: none;
  contain: layout size style;
  backface-visibility: hidden;
  perspective: 1000px;
  transform: translateZ(0);
  pointer-events: auto;
  transition: none;
}

.draggable-container:active {
  cursor: grabbing;
}

/* 拖拽遮罩层样式，用于捕获鼠标事件 */
.drag-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: calc(var(--z-index, 9999) - 1);
  pointer-events: all;
  background: transparent;
  cursor: grabbing;
  user-select: none;
  touch-action: none;
  contain: strict;
  will-change: transform;
  transform: translateZ(0);
  transition: none;
}
</style>
