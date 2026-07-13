<template>
  <div ref="toolbarRef" class="text-selection-toolbar" :style="toolbarStyle">
    <div class="toolbar-content">
      <!-- 显示关闭按钮 -->
      <button v-if="showCloseBtn" class="close-btn" type="button" aria-label="收起文本选择工具栏" @click="closeToolbar">
        <CloseBold aria-hidden="true" />
      </button>
      <!-- 分割线 -->
      <div v-if="showCloseBtn && tools.length > 0" class="toolbar-divider"></div>
      <!-- 动态渲染工具按钮 -->
      <button v-for="(tool, index) in tools" :key="index" class="toolbar-btn" type="button" @click="handleToolClick(tool)">
        <span class="tool-icon" aria-hidden="true">
          <span v-if="tool.icon" class="tool-custom-icon">{{ tool.icon }}</span>
          <component :is="getToolIcon(tool)" v-else class="tool-svg" />
        </span>
        <span class="tool-label">{{ tool.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch, type Component } from 'vue'
import {
  ChatDotRound,
  CloseBold,
  CollectionTag,
  CopyDocument,
  EditPen,
  RefreshLeft,
  Search,
  Tools
} from '@element-plus/icons-vue'
import { TextTool } from '@/types'
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

const toolIconMap: Record<string, Component> = {
  bookmark: CollectionTag,
  comment: ChatDotRound,
  copy: CopyDocument,
  replace: RefreshLeft,
  search: Search,
  translate: EditPen
}

const getToolIcon = (tool: TextTool) => {
  return toolIconMap[tool.id] || Tools
}

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

<style scoped lang="scss">
.text-selection-toolbar {
  --toolbar-primary: #0d9488;
  --toolbar-primary-strong: #0f766e;
  --toolbar-accent: #f97316;
  --toolbar-surface: #e8e8e8;
  --toolbar-surface-hover: #f0f0f0;
  --toolbar-border: rgba(255, 255, 255, 0.5);
  --toolbar-text: #2d2d2d;
  --toolbar-muted: #5a5a5a;

  position: relative;
  background: linear-gradient(145deg, #f5f5f5 0%, #e0e0e0 100%);
  border: none;
  border-radius: 14px;
  box-shadow: 
    8px 8px 16px rgba(0, 0, 0, 0.15),
    -4px -4px 12px rgba(255, 255, 255, 0.85),
    inset 1px 1px 2px rgba(255, 255, 255, 0.9),
    inset -1px -1px 2px rgba(0, 0, 0, 0.05);
  z-index: 999999;
  user-select: none;
  transition: opacity 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
  overflow: visible;
  color: var(--toolbar-text);
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", Arial, sans-serif;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 14px;
    pointer-events: none;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, transparent 50%);
  }
}

.toolbar-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: linear-gradient(145deg, #e8e8e8 0%, #d5d5d5 100%);
  border-radius: 12px;
  position: relative;
  z-index: 1;
  box-shadow: 
    inset 2px 2px 4px rgba(0, 0, 0, 0.05),
    inset -1px -1px 3px rgba(255, 255, 255, 0.6);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 58px;
  height: 32px;
  padding: 0 9px;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 50%, #d1d1d1 100%);
  border: none;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #2d2d2d;
  position: relative;
  overflow: visible;
  box-shadow: 
    4px 4px 8px rgba(0, 0, 0, 0.15),
    -2px -2px 6px rgba(255, 255, 255, 0.8),
    inset 1px 1px 2px rgba(255, 255, 255, 0.9),
    inset -1px -1px 2px rgba(0, 0, 0, 0.05);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, transparent 50%);
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  &:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%);
    color: #1a1a1a;
    box-shadow: 
      6px 6px 12px rgba(0, 0, 0, 0.18),
      -3px -3px 8px rgba(255, 255, 255, 0.9),
      inset 1px 1px 3px rgba(255, 255, 255, 0.95),
      inset -1px -1px 3px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);

    &::before {
      opacity: 0.8;
    }
  }

  &:active {
    transform: translateY(0);
    box-shadow: 
      2px 2px 4px rgba(0, 0, 0, 0.12),
      -1px -1px 3px rgba(255, 255, 255, 0.6),
      inset 2px 2px 6px rgba(0, 0, 0, 0.1),
      inset -2px -2px 6px rgba(255, 255, 255, 0.8);
  }

  &:focus-visible {
    outline: 2px solid rgba(13, 148, 136, 0.8);
    outline-offset: 3px;
  }
}

/* 分割线样式 */
.toolbar-divider {
  width: 1px;
  background: rgba(15, 118, 110, 0.16);
  margin: 0 4px;
  height: 22px;
  align-self: center;
}

/* 关闭按钮样式 */
.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 50%, #d1d1d1 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #5a5a5a;
  position: relative;
  overflow: visible;
  box-shadow: 
    4px 4px 8px rgba(0, 0, 0, 0.15),
    -2px -2px 6px rgba(255, 255, 255, 0.8),
    inset 1px 1px 2px rgba(255, 255, 255, 0.9),
    inset -1px -1px 2px rgba(0, 0, 0, 0.05);

  svg {
    width: 14px;
    height: 14px;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, transparent 50%);
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  &:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%);
    color: #1a1a1a;
    box-shadow: 
      6px 6px 12px rgba(0, 0, 0, 0.18),
      -3px -3px 8px rgba(255, 255, 255, 0.9),
      inset 1px 1px 3px rgba(255, 255, 255, 0.95),
      inset -1px -1px 3px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);

    &::before {
      opacity: 0.8;
    }
  }

  &:active {
    transform: translateY(0);
    box-shadow: 
      2px 2px 4px rgba(0, 0, 0, 0.12),
      -1px -1px 3px rgba(255, 255, 255, 0.6),
      inset 2px 2px 6px rgba(0, 0, 0, 0.1),
      inset -2px -2px 6px rgba(255, 255, 255, 0.8);
  }

  &:focus-visible {
    outline: 2px solid rgba(13, 148, 136, 0.8);
    outline-offset: 3px;
  }
}

.tool-icon,
.tool-svg {
  flex-shrink: 0;
}

.tool-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  color: var(--toolbar-primary);
}

.tool-svg {
  width: 15px;
  height: 15px;
}

.tool-custom-icon {
  font-size: 13px;
  line-height: 1;
}

.tool-label {
  white-space: nowrap;
}

@media (max-width: 420px) {
  .toolbar-btn {
    min-width: 36px;
    padding: 0 8px;
  }

  .tool-label {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .text-selection-toolbar,
  .toolbar-btn,
  .close-btn {
    transition: none;
  }
}
</style>
