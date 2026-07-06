<template>
  <HoverMenu :items="localTools" :visible="visible" @click="handleClick" />
  <!-- 独立的上下文菜单 -->
  <!-- <MaCollapse v-model:visible="contextMenuVisible" :title="currentTool?.label || '上下文菜单'"
    :menu-items="currentTool?.children || []" :tool-id="currentTool?.id" @item-click="handleContextMenuClick"
    @close="contextMenuVisible = false" /> -->
  <MACarousel :tools="carouselItems" v-model:visible="contextMenuVisible" @click-tool="handleContextMenuClick" />
</template>

<script setup lang="ts">
import { MACarousel } from '@components/index'
import { ref, watch } from 'vue'
import { Tool } from '@/types/index.js'
import { IconCommunity } from '@icons/index'
import { eventManager } from '@/event'
import HoverMenu from './HoverMenu.vue'


// 上下文菜单相关状态
const contextMenuVisible = ref(false) // 上下文菜单是否可见
const currentTool = ref<Tool | null>(null) // 当前选中的工具
const carouselItems = ref<Tool[]>([]) // 轮播项

// 上下文菜单项点击处理
const handleContextMenuClick = (item: Tool) => {
  // 发送消息到后台脚本
  chrome.runtime.sendMessage({
    type: 'CONTEXT_MENU_CLICK',
    payload: {
      itemId: item.id,
      itemLabel: item.label,
      // toolId: props.toolId
    },
    target: "background"
  })
  // 关闭菜单
  contextMenuVisible.value = false
}

const props = withDefaults(defineProps<{
  tools: Tool[]
  layout?: 'vertical' | 'horizontal' | 'fold'
  drawerDirection?: 'rtl' | 'ltr' | 'ttb' | 'btt'
  visible?: boolean
}>(), {
  tools: () => [
    // 默认工具项
    {
      id: 'zero',
      label: '关于',
      icon: IconCommunity,
      color: "#0ee732ff",
      children: [
        {
          id: 'hello',
          label: '你好~',
          icon: IconCommunity,
          color: "#0ee732ff",
        }
      ]
    }
  ],
  layout: 'vertical',
  visible: true
})

// 使用ref来存储tools，以便可以通过事件总线更新
const localTools = ref<Tool[]>([...props.tools])

// 监听props中的tools变化，同步到localTools
watch(() => props.tools, (newTools) => {
  localTools.value = [...newTools]
}, { deep: true })

// 监听事件总线上的tools更新事件
//@ts-ignore
const bus = eventManager.useBus('update:sidebar:tools', (newTools: Tool[]) => {
  maLogger.log('接收到事件总线更新tools:', newTools)
  localTools.value = [...newTools]
})

const handleClick = (it: Tool) => {
  maLogger.log('点击工具项:', it)
  // 优先调用onClick回调函数
  if (it.onClick && typeof it.onClick === 'function') {
    it.onClick();
  } else {
    currentTool.value = it
    carouselItems.value = it.children || []
    contextMenuVisible.value = true
  }
}
</script>