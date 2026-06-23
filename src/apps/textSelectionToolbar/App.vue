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
        <ReplaceModal :visible="showReplaceModal" :searchText="replaceSearchText" @close="hideReplaceModal"
            @replace="handleReplace" />
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import TextSelectionToolbar from './TextToolbar.vue'
import TranslationPanel from './TranslationPanel.vue'
import ReplaceModal from './ReplaceModal.vue'
import { componentManager } from '@/utils/componentManager'
import { TextTool } from '@/assets/types'
import { eventManager } from "@/event"
import findAndReplaceDOMText, { Finder } from './findAndReplaceDOMText'

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
// 替换弹窗相关
const showReplaceModal = ref(false)
const replaceSearchText = ref('')
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

// 显示替换弹窗
const showReplaceModalFn = (text: string) => {
    replaceSearchText.value = text
    showReplaceModal.value = true
}

// 隐藏替换弹窗
const hideReplaceModal = () => {
    showReplaceModal.value = false
    replaceSearchText.value = ''
}

// 处理替换操作
const handleReplace = async (replaceText: string, options: { caseSensitive: boolean; wholeWord: boolean }) => {
    try {
        const searchText = replaceSearchText.value.trim()
        if (!searchText || !replaceText.trim()) {
            return
        }

        // const findAndReplaceDOMText = await import('./findAndReplaceDOMText.js').then(m => m.default)

        let regexPattern = searchText.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&')

        if (options.wholeWord) {
            regexPattern = `\\b${regexPattern}\\b`
        }

        const flags = options.caseSensitive ? 'g' : 'gi'
        const regex = new RegExp(regexPattern, flags)

        const instance: Finder = findAndReplaceDOMText(document.body, {
            find: regex,
            replace: replaceText,
            preset: 'prose'
        })

        maLogger.log('替换完成，共替换:', instance.matches.length, '处')

        if (instance.matches.length > 0) {
            showReplaceSuccess(instance.matches.length)
        }
    } catch (error) {
        maLogger.error('替换失败:', error)
    } finally {
        hideReplaceModal()
    }
}

// 显示替换成功提示
const showReplaceSuccess = (count: number) => {
    const successContainer = document.createElement('div')
    successContainer.style.cssText = `
        background: rgba(20, 24, 33, 0.9);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(46, 191, 92, 0.3);
        border-radius: 12px;
        padding: 14px 18px;
        font-size: 14px;
        line-height: 1.5;
        max-width: 280px;
        position: fixed;
        z-index: 9999999;
        right: 20px;
        top: 20px;
        box-shadow: 
            0 8px 24px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(46, 191, 92, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        animation: slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    `

    successContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ebf5c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span style="color: rgba(255, 255, 255, 0.9); font-weight: 500;">成功替换 ${count} 处文本！</span>
        </div>
    `

    const style = document.createElement('style')
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%) scale(0.95);
                opacity: 0;
            }
            to {
                transform: translateX(0) scale(1);
                opacity: 1;
            }
        }
    `
    document.head.appendChild(style)

    document.body.appendChild(successContainer)

    setTimeout(() => {
        successContainer.style.animation = 'slideIn 0.3s cubic-bezier(0.55, 0, 1, 1) reverse'
        setTimeout(() => {
            try {
                document.body.removeChild(successContainer)
                document.head.removeChild(style)
            } catch (error) {
                // 元素可能已经被移除
            }
        }, 300)
    }, 3500)
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
        hideTranslationPanel,
        showReplaceModal: showReplaceModalFn
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
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    background: linear-gradient(135deg, #ff4757, #ff6b7a);
    border-radius: 50%;
    cursor: pointer;
    pointer-events: auto;
    box-shadow:
        0 0 0 2px rgba(255, 255, 255, 0.1),
        0 0 12px rgba(255, 71, 87, 0.5);
    animation: pulse 2s infinite;
    z-index: 999999;
    transition: transform 0.2s ease;
}

.red-dot:hover {
    transform: scale(1.15);
}

/* 红点脉冲动画 */
@keyframes pulse {
    0% {
        box-shadow:
            0 0 0 2px rgba(255, 255, 255, 0.1),
            0 0 12px rgba(255, 71, 87, 0.5);
    }

    50% {
        box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.15),
            0 0 20px rgba(255, 71, 87, 0.7),
            0 0 30px rgba(255, 71, 87, 0.3);
    }

    100% {
        box-shadow:
            0 0 0 2px rgba(255, 255, 255, 0.1),
            0 0 12px rgba(255, 71, 87, 0.5);
    }
}
</style>
