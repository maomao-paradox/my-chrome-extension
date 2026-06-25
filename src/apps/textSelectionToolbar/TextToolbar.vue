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
  --toolbar-surface: rgba(255, 255, 255, 0.96);
  --toolbar-surface-hover: #f0fdfa;
  --toolbar-border: rgba(15, 118, 110, 0.18);
  --toolbar-text: #134e4a;
  --toolbar-muted: #475569;
  --toolbar-shadow: 0 18px 42px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(13, 148, 136, 0.12);

  position: relative;
  background: var(--toolbar-surface);
  border: 1px solid var(--toolbar-border);
  border-radius: 10px;
  box-shadow: var(--toolbar-shadow);
  z-index: 999999;
  user-select: none;
  transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(16px) saturate(1.2);
  overflow: visible;
  color: var(--toolbar-text);
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", Arial, sans-serif;

  &::after {
    content: "";
    position: absolute;
    inset: 1px;
    border-radius: 9px;
    pointer-events: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
  }
}

.toolbar-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 5px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(240, 253, 250, 0.92));
  border-radius: 10px;
  position: relative;
  z-index: 1;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 58px;
  height: 32px;
  padding: 0 9px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  color: var(--toolbar-text);
  position: relative;
  overflow: visible;

  &:hover {
    background: var(--toolbar-surface-hover);
    border-color: rgba(13, 148, 136, 0.25);
    color: var(--toolbar-primary-strong);
    box-shadow: 0 7px 18px rgba(13, 148, 136, 0.14);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.12);
  }

  &:focus-visible {
    outline: 2px solid rgba(249, 115, 22, 0.8);
    outline-offset: 2px;
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
  background: #ecfeff;
  border: 1px solid rgba(13, 148, 136, 0.16);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  color: var(--toolbar-muted);
  position: relative;
  overflow: hidden;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: #fff7ed;
    border-color: rgba(249, 115, 22, 0.28);
    color: #c2410c;
    box-shadow: 0 7px 18px rgba(249, 115, 22, 0.14);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid rgba(249, 115, 22, 0.8);
    outline-offset: 2px;
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
