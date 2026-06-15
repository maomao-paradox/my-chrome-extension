<template>
  <FloatingBall :icon="icon" @click="handleFloatingBallClick" />
  <GlassCardOverlay v-model:visible="glassCardVisible" />
  <ControlPanel :tools="tools" title="控制面板" :visible="floatingballStore.dialogStat" @clickTool="handleClickTool"
    @close-panel="handleClosePanel" @update:visible="floatingballStore.toggle('dialog', $event)" />
  <ToolDrawer :useMask="true" :direction="drawerDirection" :visible="floatingballStore.drawerStat"
    :activeTool="floatingballStore.activeToolStat" :title="drawerTitle" @close-drawer="handleCloseDrawer"
    @update:visible="floatingballStore.toggle('drawer', $event)" />
</template>

<script setup lang="ts">
import { getStaticAbstractPath } from '@/utils/common'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Tool } from "@/assets/types"
import { appConfigKey } from '@/config'
import { useFloatingballStore } from '@/stores/floatingball'
import { PluginConfigs } from "@/assets/types";
import ToolDrawer  from "./ToolDrawer.vue";
import ControlPanel from "./ControlPanel.vue";
import FloatingBall from "./FloatingBall.vue";
import GlassCardOverlay from "./GlassCardOverlay.vue";


interface floatingballProps {
  icon?: string
  tools?: Tool[]
  menuTitle?: string
  drawerDirection?: "rtl" | "ltr" | "ttb" | "btt"
}

const props = withDefaults(defineProps<floatingballProps>(), {
  icon: getStaticAbstractPath("icons/floatingball.png"),
  tools: () => [{ id: 'script', label: '执行脚本', icon: 'Script' }],
  menuTitle: '小工具箱',
  drawerDirection: 'rtl',
})

// 初始化 store
const floatingballStore = useFloatingballStore()

// 状态管理
// const dialogVisible = ref(false)
// const drawerVisible = ref(false)
// const activeTool = ref<Tool | null>(null)
// const enabled = ref(true)
// const clickBehavior = ref(floatingballStore.clickBehaviorStat)

const drawerDirection = ref(props.drawerDirection)
const glassCardVisible = ref(false)

// 计算属性
const drawerTitle = computed(() => floatingballStore.activeToolStat ? floatingballStore.activeToolStat.label : props.menuTitle ?? "未命名的工具")

// 处理悬浮球点击
const handleFloatingBallClick = () => {
  if (!floatingballStore.enabledStat) {
    return
  }
  try {
    maLogger.log('clickBehavior:', floatingballStore.clickBehaviorStat)
    if (floatingballStore.clickBehaviorStat === 'sidepanel') {
      // 调用 store 中的 toggleSidepanel 方法打开侧边栏
      floatingballStore.toggleSidepanel(true)
    } else {
      // 默认显示弹窗
      floatingballStore.toggle('dialog');
    }
  } catch (error) {
    maLogger.error('处理点击事件失败:', error)
  }
}

// 处理点击工具
const handleClickTool = (tool: Tool) => {
  if (tool.id === 'glass-card') {
    glassCardVisible.value = true
    floatingballStore.changeTool(null)
    floatingballStore.toggle('dialog', false)
    floatingballStore.toggle('drawer', false)
    return
  }

  floatingballStore.changeTool(tool)
  floatingballStore.toggle('dialog', !1);
  floatingballStore.toggle('drawer', !0);
  maLogger.info("点击了工具：", tool.label)
}

// 处理面板关闭
const handleClosePanel = () => {
  floatingballStore.toggle('dialog', !1);
  floatingballStore.toggle('drawer', !1);
}

// 处理关闭抽屉
const handleCloseDrawer = () => {
  floatingballStore.changeTool(null)
  floatingballStore.toggle('drawer', !1);
  // 延迟打开对话框，确保DOM更新完成
  setTimeout(() => {
    floatingballStore.toggle('dialog', !0);
  }, 100)
}

// 监听配置变化
const setupConfigListener = (changes: { [key: string]: chrome.storage.StorageChange; }, namespace: string) => {
  if (namespace === 'local' && changes[appConfigKey]) {
    maLogger.log('应用配置变化:', changes[appConfigKey])
    const newConfig: PluginConfigs = changes[appConfigKey].newValue as PluginConfigs
    if (newConfig && newConfig.floatingball) {
      const behavior = newConfig.floatingball.type || 'dialog'
      floatingballStore.setClickBehavior(behavior)
      floatingballStore.setEnabled(newConfig.floatingball.value !== false)
    }
  }
}

// 组件挂载时初始化
onMounted(() => {
  chrome.storage.onChanged.addListener(setupConfigListener)
  // 加载配置
  floatingballStore.loadConfig()
})

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(setupConfigListener)
})
</script>
