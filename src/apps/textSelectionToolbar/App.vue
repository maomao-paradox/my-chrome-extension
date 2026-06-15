<template>
    <div class="toolbar-root">
        <div v-show="isVisible">
            <div v-if="showRedDot" class="red-dot" @click="handleRedDotClick" />
            <div v-show="showToolbar" class="animation-container show">
                <TextSelectionToolbar ref="toolbarRef" :initialText="initialText" :customTools="localTools"
                    :showCloseBtn="showCloseBtn" @close="handleClose" />
            </div>
        </div>
        <TranslationPanel v-for="panel in translationPanels" :key="panel.messageId" :visible="true"
            :content="panel.content" :status="panel.status" :position="panel.position" :shake-key="panel.shakeKey"
            @close="hideTranslationPanel(panel.messageId)" />
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import TextSelectionToolbar from './TextToolbar.vue'
import TranslationPanel from './TranslationPanel.vue'
import { componentManager } from '@/utils/componentManager'
import { TextTool } from '@/assets/types'
import { eventManager } from "@/event"

interface TextSelectionToolbarProps {
    initialText: string;
    customTools?: TextTool[];
    showCloseBtn?: boolean;
}

type TranslationStatus = 'loading' | 'success' | 'error'

interface TranslationPosition {
    left: number;
    top: number;
}

interface TranslationPanelPayload {
    messageId: string;
    content: string;
    status?: TranslationStatus;
    position?: TranslationPosition;
    sourceText?: string;
}

// 接收props
const props = withDefaults(defineProps<TextSelectionToolbarProps>(), {
    showCloseBtn: true
})

// 存储键名
const STORAGE_KEY = 'textSelectionToolbarState'

// 控制组件显示和隐藏
const isVisible = ref(false)
const showToolbar = ref(true)
// 控制红点显示
const showRedDot = ref(false)
// 工具栏组件引用
const toolbarRef = ref<InstanceType<typeof TextSelectionToolbar> | null>(null)
const initialText = ref<string>(props.initialText)
const translationPanels = ref<Array<{
    messageId: string;
    content: string;
    status: TranslationStatus;
    position: TranslationPosition;
    sourceText: string;
    shakeKey: number;
}>>([])

// 从存储中加载状态
const loadState = () => {
    try {
        const storedState = localStorage.getItem(STORAGE_KEY)
        if (storedState) {
            const state = JSON.parse(storedState)
            showRedDot.value = state.showRedDot
            showToolbar.value = state.showToolbar
        }
    } catch (error) {
        maLogger.error('加载工具栏状态失败:', error)
    }
}

// 保存状态到存储
const saveState = () => {
    try {
        const state = {
            showRedDot: showRedDot.value,
            showToolbar: showToolbar.value
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
        maLogger.error('保存工具栏状态失败:', error)
    }
}

// 暴露控制方法给父组件
const show = () => {
    isVisible.value = true
}

const hide = () => {
    isVisible.value = false
}

// 处理工具栏关闭事件
const handleClose = () => {
    showToolbar.value = false
    showRedDot.value = true
    saveState()
}

// 处理红点点击事件
const handleRedDotClick = () => {
    showRedDot.value = false
    showToolbar.value = true
    saveState()
}

// 监听isVisible变化，自动隐藏
watch(isVisible, (newValue) => {
    if (newValue) {
        // 3秒后自动隐藏
        setTimeout(() => {
            isVisible.value = false
        }, 3000)
    }
})

defineExpose({ show, hide })

//@ts-ignore
const localTools = ref<TextTool[]>([...props.customTools])

watch(() => props.customTools, (newTools) => {
    localTools.value = [...newTools]
}, { deep: true })

eventManager.useBus('update:toolbar:tools', (newTools: TextTool[]) => {
    maLogger.log('接收到事件总线更新tools:', newTools)
    localTools.value = [...newTools]
})

const updateText = (text: string) => {
    initialText.value = text
}

const showWithIframeText = (text: string) => {
    initialText.value = text
    isVisible.value = true
}

const showTranslationPanel = (payload: TranslationPanelPayload) => {
    const nextPanel = {
        messageId: payload.messageId,
        content: payload.content,
        status: payload.status || 'loading',
        sourceText: payload.sourceText || '',
        shakeKey: 0,
        position: payload.position || {
            left: 100,
            top: 100
        }
    }

    const panelIndex = translationPanels.value.findIndex(panel => panel.messageId === payload.messageId)
    if (panelIndex === -1) {
        translationPanels.value = [...translationPanels.value, nextPanel]
        return
    }

    translationPanels.value = translationPanels.value.map((panel, index) => {
        return index === panelIndex ? nextPanel : panel
    })
}

const updateTranslationPanel = (payload: Partial<TranslationPanelPayload> & { messageId: string }) => {
    const panelIndex = translationPanels.value.findIndex(panel => panel.messageId === payload.messageId)
    if (panelIndex === -1) {
        return
    }

    translationPanels.value = translationPanels.value.map((panel, index) => {
        if (index !== panelIndex) {
            return panel
        }

        return {
            ...panel,
            content: payload.content ?? panel.content,
            status: payload.status ?? panel.status,
            position: payload.position ?? panel.position,
            sourceText: payload.sourceText ?? panel.sourceText
        }
    })
}

const shakeTranslationPanelBySourceText = (sourceText: string) => {
    const normalizedText = sourceText.trim()
    if (!normalizedText) {
        return false
    }

    const panelIndex = translationPanels.value.findIndex(panel => panel.sourceText === normalizedText)
    if (panelIndex === -1) {
        return false
    }

    const targetPanel = translationPanels.value[panelIndex]
    const bumpedPanel = {
        ...targetPanel,
        shakeKey: targetPanel.shakeKey + 1
    }

    translationPanels.value = [
        ...translationPanels.value.filter((_, index) => index !== panelIndex),
        bumpedPanel
    ]

    return true
}

const hideTranslationPanel = (messageId?: string) => {
    if (!messageId) {
        translationPanels.value = []
        return
    }

    translationPanels.value = translationPanels.value.filter(panel => panel.messageId !== messageId)
}

onMounted(() => {
    // 加载保存的状态
    loadState()
    componentManager.register('TextSelectionToolbar', {
        show,
        hide,
        updateText,
        showWithIframeText,
        showTranslationPanel,
        updateTranslationPanel,
        shakeTranslationPanelBySourceText,
        hideTranslationPanel
    })
})

onUnmounted(() => {
    componentManager.unregister('TextSelectionToolbar')
})
</script>

<style scoped>
.toolbar-root {
    position: relative;
}

.animation-container {
    position: fixed;
    pointer-events: none;
    z-index: 999998;
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.animation-container.show {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}

/* 红点指示器样式 */
.red-dot {
    position: absolute;
    top: -5px;
    right: -5px;
    width: 10px;
    height: 10px;
    background-color: #ff4757;
    border-radius: 50%;
    cursor: pointer;
    pointer-events: auto;
    box-shadow: 0 0 0 2px white;
    animation: pulse 2s infinite;
    z-index: 999999;
}

/* 红点动画 */
@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.7);
    }

    70% {
        box-shadow: 0 0 0 10px rgba(255, 71, 87, 0);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(255, 71, 87, 0);
    }
}
</style>
