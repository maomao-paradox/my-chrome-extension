<template>
  <div ref="toolbarRef" class="text-selection-toolbar" :style="toolbarStyle">
    <div class="toolbar-content">
      <!-- 显示关闭按钮 -->
      <button v-if="showCloseBtn" class="close-btn" @click="closeToolbar">X</button>
      <!-- 分割线 -->
      <div v-if="showCloseBtn && tools.length > 0" class="toolbar-divider"></div>
      <!-- 动态渲染工具按钮 -->
      <button v-for="(tool, index) in tools" :key="index" class="toolbar-btn" @click="handleToolClick(tool)">
        <span v-if="tool.icon" class="tool-icon">{{ tool.icon }}</span>
        <span>{{ tool.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { TextTool } from '@/assets/types'
import { componentManager } from '@/utils/componentManager'

// 组件props
const props = defineProps<{
  // 自定义工具配置
  initialText?: string;
  customTools?: TextTool[];
  showCloseBtn?: boolean;
}>()

// 定义事件
const emit = defineEmits<{
  // 关闭工具栏事件
  (e: 'close'): void;
}>()

// 工具栏引用
const toolbarRef = ref<HTMLElement | null>(null)
// AI对话窗口可见性
const aiChatVisible = ref(false)
// 初始文本（选中文本）
const initialText = ref<string>(props.initialText || '')

watch(() => props.initialText, (nextText) => {
  initialText.value = nextText || ''
})

const closeToolbar = () => {
  // 触发close事件，让父组件处理关闭逻辑
  emit('close')
}

// 合并默认工具和自定义工具
const tools = computed(() => {
  if (props.customTools && props.customTools.length > 0) {
    // maLogger.log("合并后的工具:", [...props.customTools])
    return [...props.customTools]
  }
  return []
})

// 计算工具栏样式
const toolbarStyle = computed(() => {
  return {
    left: '0px',
    top: '0px'
  }
})

// 工具点击处理
const handleToolClick = (tool: TextTool) => {
  maLogger.log('工具点击:', tool.id, tool.label)

  if (tool.handler && typeof tool.handler === 'function') {
    maLogger.log('执行工具handler:', tool.id)

    Promise.resolve(tool.handler(initialText.value))
      .then(() => {
        maLogger.log('工具执行完成:', tool.id)
      })
      .catch((error) => {
        maLogger.error('工具执行失败:', error)
      })
  } else {
    maLogger.log('handler不存在:', { hasText: !!initialText, hasHandler: !!tool.handler, isFunction: typeof tool.handler === 'function' })
  }
}

onUnmounted(() => {
  componentManager.unregister('TextSelectionToolbar');
})
</script>

<style scoped>
.text-selection-toolbar {
  position: fixed;
  background: var(--scifi-bg-secondary) !important;
  border: 1px solid var(--scifi-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--scifi-glow-color), 0 0 0 1px var(--scifi-border-color);
  z-index: 999999;
  user-select: none;
  transition: opacity 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
  backdrop-filter: blur(10px);
  overflow: visible;
  position: relative;
}

.toolbar-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: var(--scifi-bg-secondary) !important;
  border-radius: 8px;
  position: relative;
  z-index: 1;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: linear-gradient(135deg, var(--scifi-bg-primary), var(--scifi-bg-secondary));
  border: 1px solid var(--scifi-border-color);
  border-radius: 6px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--scifi-text-primary);
  position: relative;
  overflow: hidden;
  height: 28px;
}

/* 分割线样式 */
.toolbar-divider {
  width: 1px;
  background: var(--scifi-border-color);
  margin: 0 8px;
  height: 24px;
  align-self: center;
}

/* 关闭按钮样式 */
.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: linear-gradient(135deg, var(--scifi-bg-primary), var(--scifi-bg-secondary));
  border: 1px solid var(--scifi-border-color);
  border-radius: 6px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--scifi-text-primary);
  position: relative;
  overflow: hidden;
}

.close-btn:hover {
  background: linear-gradient(135deg, var(--scifi-bg-secondary), var(--scifi-accent-primary));
  border-color: var(--scifi-accent-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--scifi-glow-color), 0 0 0 1px var(--scifi-accent-primary);
}

.close-btn:active {
  transform: translateY(0);
  box-shadow: 0 0 0 1px var(--scifi-accent-primary);
}

/* 按钮发光效果 */
.toolbar-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
  transition: left 0.3s ease;
  z-index: 0;
}

.toolbar-btn:hover {
  background: linear-gradient(135deg, var(--scifi-bg-secondary), var(--scifi-accent-primary));
  border-color: var(--scifi-accent-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--scifi-glow-color), 0 0 0 1px var(--scifi-accent-primary);
}

.toolbar-btn:hover::before {
  left: 100%;
}

.toolbar-btn:active {
  transform: translateY(0);
  box-shadow: 0 0 0 1px var(--scifi-accent-primary);
}

.toolbar-btn svg {
  flex-shrink: 0;
  color: var(--scifi-accent-primary);
  position: relative;
  z-index: 1;
}

.toolbar-btn .tool-icon {
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  font-size: 14px;
}

.toolbar-btn span {
  position: relative;
  z-index: 1;
}

.toolbar-btn:hover svg {
  color: var(--scifi-text-primary);
  filter: drop-shadow(0 0 2px var(--scifi-accent-primary));
}

.toolbar-btn:hover .tool-icon {
  filter: drop-shadow(0 0 2px var(--scifi-accent-primary));
}

/* 科幻风格动画 */
@keyframes scifiScanline {
  0% {
    left: -100%;
  }

  100% {
    left: 100%;
  }
}
</style>
