<template>
  <!-- 只在expanded为true时显示整个菜单容器 -->
  <div class="dock" ref="dockRef">
    <li v-for="(it, i) in items" :key="it.id" class="dock-cell" @mouseenter="onMouseEnter(i)"
      @mouseleave="onMouseLeave()" @click="onClick(i)" :style="{ '--delay': i * 0.12 + 's' }">
      <div class="dock-icon" :class="{ hover: hoverIdx === i }" :style="{ '--c': it.color || getRainbowColor(i) }">
        <component :is="it.icon || IconCommunity" class="ic" />
      </div>
      <div v-if="hoverIdx === i && it.label" class='tip'>{{ it.label }}</div>
    </li>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Tool } from '@/assets/types'
import IconCommunity from '@icons/IconCommunity.vue'
import { eventManager } from '@/event'

// Props定义
const props = defineProps<{
  items: Tool[]
  layout?: 'vertical' | 'horizontal' | 'fold'
  visible?: boolean
}>()

// 彩虹色数组
const rainbowColors = [
  '#FF0000', // 红色
  '#FF7F00', // 橙色
  '#FFFF00', // 黄色
  '#00FF00', // 绿色
  '#0000FF', // 蓝色
  '#4B0082', // 靛蓝色
  '#9400D3'  // 紫色
]

// 根据索引获取彩虹色
const getRainbowColor = (index: number) => {
  // 使用模运算确保索引不会超出数组范围
  return rainbowColors[index % rainbowColors.length]
}

const hoverIdx = ref<number>(-1) // 用于控制悬浮效果和提示文本

// 鼠标进入一级菜单 - 控制悬浮效果和提示文本
const onMouseEnter = (i: number) => {
  hoverIdx.value = i
}

const onMouseLeave = () => {
  hoverIdx.value = -1
}

const emit = defineEmits<{
  'click': [item: Tool]
}>()

// 点击一级菜单 - 控制子菜单显示
const onClick = (i: number) => {
  const item = props.items[i];
  // 发出点击事件
  emit('click', item);
  // 点击已经激活的菜单项，不做任何操作
  if (hoverIdx.value === i) {
    return
  }
}

const dockRef = ref<HTMLDivElement>()

// 显示整个菜单
const show = () => {
  dockRef.value?.classList.add('hover')
}

// 隐藏整个菜单
const hide = () => {
  dockRef.value?.classList.remove('hover')
}

// 处理键盘事件 - 监听Ctrl+Q快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  // 添加调试日志
  maLogger.log('Key pressed:', event.key, 'ctrlKey:', event.ctrlKey)
  // 检查是否按下了Ctrl+Q
  if (event.ctrlKey && event.key.toLowerCase() === 'q') {
    // 阻止默认行为
    event.preventDefault()
    // 显示菜单
    dockRef.value?.classList.toggle('hover')
  }
}

eventManager.useBus({ 'show': show, 'hide': hide })
eventManager.useListener('keydown', handleKeyDown)

// 组件生命周期
onMounted(() => {
  show()
  setTimeout(() => {
    hide()
  }, 500)
})

</script>

<style scoped>
.dock {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  visibility: hidden;
  opacity: 0;
  transition: visibility 0.6s ease, opacity 0.6s ease;
  z-index: 9999;
  visibility: visible;
  opacity: 1;
  transition: visibility 0s, opacity 0.6s ease;
}

.dock::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 100%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 10px 0 0 10px;
  cursor: pointer;
  transition: width 0.3s ease;
  z-index: 1;
  opacity: 0;
}

.dock:hover::after,
.dock.hover::after {
  z-index: 0;
  /* // 鼠标穿透 */
  pointer-events: none;
}

.dock-cell {
  display: flex;
  position: relative;
  flex-direction: row-reverse;
  align-items: flex-start;
  right: -50px;
  transform: translateX(0);
  opacity: 1;
  transition: transform 0.3s ease, opacity 0.3s ease;
  z-index: 0;
  transition-delay: var(--delay, 0s);
}

.dock:hover .dock-cell,
.dock.hover .dock-cell {
  transform: translateX(-120%);
  opacity: 1;
}

.dock-icon {
  width: 40px;
  height: 40px;
  background: var(--c, #409eff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform .25s cubic-bezier(.25, .8, .25, 1), filter .25s;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, .15));
  position: relative;
  border-radius: 20px 0 0 20px;
}

.dock-icon.hover {
  transform: scaleX(1.35) scaleY(1.15);
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, .2));
}

.ic {
  width: 20px;
  height: 20px;
}

.tip {
  position: absolute;
  right: 110%;
  top: 50%;
  transform: translateY(-50%);
  padding: 4px 8px;
  background: rgba(0, 0, 0, .75);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
  border-radius: 4px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.dock-icon.hover+.tip {
  opacity: 1;
}

.arr {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  opacity: .8;
}
</style>