<template>
    <div class="toolbar-root">
        <div v-show="isVisible">
            <button v-if="showRedDot" class="red-dot" type="button" aria-label="展开文本选择工具栏" @click="handleRedDotClick" />
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
        <CommentModal 
            :visible="showCommentModal" 
            :selectedText="currentSelectedText"
            :commentId="editingCommentId"
            :existingComment="editingCommentContent"
            @close="hideCommentModal"
            @save="handleSaveComment"
            @delete="handleDeleteComment"
        />
        <CommentDisplay 
            v-if="selectedComment"
            :visible="showCommentDisplay"
            :comment="selectedComment"
            :position="commentDisplayPosition"
            @close="hideCommentDisplay"
            @edit="handleEditComment"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import TextSelectionToolbar from './TextToolbar.vue'
import TranslationPanel from './TranslationPanel.vue'
import ReplaceModal from './ReplaceModal.vue'
import CommentModal from './CommentModal.vue'
import CommentDisplay from './CommentDisplay.vue'
import { componentManager } from '@/utils/componentManager'
import { TextTool } from '@/types/index.js'
import { eventManager } from "@/event"
import findAndReplaceDOMText, { Finder } from './findAndReplaceDOMText.js'
import { CommentStorage, type Comment } from '@/services/commentStorage'
import { showSuccessMessage } from '@/utils/index.js'

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

const props = withDefaults(defineProps<TextSelectionToolbarProps>(), {
    showCloseBtn: true
})

const STORAGE_KEY = 'textSelectionToolbarState'

const isVisible = ref(false)
const showToolbar = ref(true)
const showRedDot = ref(false)
const toolbarRef = ref<InstanceType<typeof TextSelectionToolbar> | null>(null)
const initialText = ref<string>(props.initialText)
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

// 留言相关状态
const showCommentModal = ref(false)
const showCommentDisplay = ref(false)
const currentSelectedText = ref('')
const selectedComment = ref<Comment | null>(null)
const commentDisplayPosition = ref({ x: 100, y: 100 })
const editingCommentId = ref('')
const editingCommentContent = ref('')
const pageComments = ref<Comment[]>([])
const currentRangeInfo = ref<{
    startContainerXPath: string;
    startOffset: number;
    endContainerXPath: string;
    endOffset: number;
} | null>(null)

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

const show = () => {
    isVisible.value = true
}

const hide = () => {
    isVisible.value = false
}

const handleClose = () => {
    isVisible.value = false
}

const handleRedDotClick = () => {
    showRedDot.value = false
    showToolbar.value = true
    saveState()
}

defineExpose({ show, hide })

const localTools = ref<TextTool[]>([...props.customTools!])

watch(() => props.customTools, (newTools) => {
    localTools.value = [...newTools!]
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

const showReplaceModalFn = (text: string) => {
    replaceSearchText.value = text
    showReplaceModal.value = true
}

const hideReplaceModal = () => {
    showReplaceModal.value = false
    replaceSearchText.value = ''
}

const handleReplace = async (replaceText: string, options: { caseSensitive: boolean; wholeWord: boolean }) => {
    try {
        const searchText = replaceSearchText.value.trim()
        if (!searchText || !replaceText.trim()) {
            return
        }

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
            showSuccessMessage(`成功替换 ${instance.matches.length} 处文本！`)
        }
    } catch (error) {
        maLogger.error('替换失败:', error)
    } finally {
        hideReplaceModal()
    }
}

// XPath 辅助函数
const getXPathForNode = (node: Node): string => {
    if (node.nodeType === Node.DOCUMENT_NODE) {
        return ''
    }
    
    if (node.nodeType === Node.TEXT_NODE) {
        let count = 1
        let sibling = node.previousSibling
        while (sibling) {
            if (sibling.nodeType === Node.TEXT_NODE) {
                count++
            }
            sibling = sibling.previousSibling
        }
        const parentXPath = node.parentNode ? getXPathForNode(node.parentNode) : ''
        if (parentXPath) {
            return `${parentXPath}/text()[${count}]`
        }
        return `/text()[${count}]`
    }
    
    let count = 1
    let sibling = node.previousSibling
    while (sibling) {
        if (sibling.nodeName === node.nodeName) {
            count++
        }
        sibling = sibling.previousSibling
    }
    
    const parentXPath = node.parentNode ? getXPathForNode(node.parentNode) : ''
    const nodeName = node.nodeName.toLowerCase()
    
    if (parentXPath) {
        return `${parentXPath}/${nodeName}[${count}]`
    }
    return `/${nodeName}[${count}]`
}

const getNodeByXPath = (xpath: string): Node | null => {
    try {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        return result.singleNodeValue
    } catch (error) {
        maLogger.error('XPath 查询失败:', error)
        return null
    }
}

// 留言功能相关方法
const loadPageComments = async () => {
    try {
        pageComments.value = await CommentStorage.getCommentsForCurrentPage()
        maLogger.log('加载当前页面留言:', pageComments.value)
        highlightCommentedText()
    } catch (error) {
        maLogger.error('加载留言失败:', error)
    }
}

const highlightCommentedText = () => {
    const existingMarkers = document.querySelectorAll('.comment-highlight-marker')
    existingMarkers.forEach(marker => {
        const textContent = marker.textContent || ''
        const textNode = document.createTextNode(textContent)
        marker.parentNode?.replaceChild(textNode, marker)
    })

    pageComments.value.forEach(comment => {
        if (!comment.text) return

        let range: Range | null = null

        if (comment.rangeInfo) {
            const { startContainerXPath, startOffset, endContainerXPath, endOffset } = comment.rangeInfo
            if (startContainerXPath && endContainerXPath) {
                const startNode = getNodeByXPath(startContainerXPath)
                const endNode = getNodeByXPath(endContainerXPath)
                
                if (startNode && endNode) {
                    try {
                        range = document.createRange()
                        range.setStart(startNode, startOffset || 0)
                        range.setEnd(endNode, endOffset || 0)
                    } catch (e) {
                        maLogger.warn('使用XPath定位失败，回退到文本匹配:', e)
                        range = null
                    }
                }
            }
        }

        if (!range) {
            range = findTextRange(comment.text)
        }

        if (range) {
            const span = document.createElement('span')
            span.className = 'comment-highlight-marker'
            span.dataset.commentId = comment.id
            span.style.cssText = `
                text-decoration: underline;
                text-decoration-color: #0d9488;
                text-decoration-thickness: 2px;
                text-underline-offset: 4px;
                cursor: pointer;
                color: inherit;
                background: rgba(13, 148, 136, 0.12);
                border-radius: 2px;
                transition: all 0.2s ease;
                position: relative;
                z-index: 1;
            `
            span.addEventListener('click', (event) => {
                event.stopPropagation()
                event.preventDefault()
                const rect = span.getBoundingClientRect()
                commentDisplayPosition.value = {
                    x: Math.min(rect.left + rect.width / 2 - 170, window.innerWidth - 360),
                    y: rect.bottom + 10
                }
                selectedComment.value = comment
                showCommentDisplay.value = true
            })
            try {
                range.surroundContents(span)
            } catch (e) {
                maLogger.warn('无法高亮文本:', e)
            }
        }
    })
}

const findTextRange = (searchText: string): Range | null => {
    const treeWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (node.parentElement?.closest('script, style, noscript, iframe')) {
                    return NodeFilter.FILTER_REJECT
                }
                return NodeFilter.FILTER_ACCEPT
            }
        }
    )

    let currentNode: Node | null
    while ((currentNode = treeWalker.nextNode())) {
        const textContent = currentNode.textContent || ''
        const index = textContent.indexOf(searchText)
        if (index !== -1) {
            const range = document.createRange()
            range.setStart(currentNode, index)
            range.setEnd(currentNode, index + searchText.length)
            return range
        }
    }
    return null
}

const highlightTextNode = (textNode: Text, searchText: string, commentId: string) => {
    const content = textNode.textContent || ''
    const index = content.indexOf(searchText)
    
    if (index === -1) return

    const range = document.createRange()
    range.setStart(textNode, index)
    range.setEnd(textNode, index + searchText.length)

    const span = document.createElement('span')
    span.className = 'comment-highlight-marker'
    span.dataset.commentId = commentId
    span.style.cssText = `
        text-decoration: underline;
        text-decoration-color: #0d9488;
        text-decoration-thickness: 2px;
        text-underline-offset: 4px;
        cursor: pointer;
        color: inherit;
        background: rgba(13, 148, 136, 0.12);
        border-radius: 2px;
        transition: all 0.2s ease;
    `

    try {
        range.surroundContents(span)
    } catch (e) {
        maLogger.warn('无法高亮文本节点:', e)
    }
}

const showCommentModalFn = (text: string, rangeInfo?: {
    startContainerXPath: string;
    startOffset: number;
    endContainerXPath: string;
    endOffset: number;
}) => {
    currentSelectedText.value = text
    editingCommentId.value = ''
    editingCommentContent.value = ''
    currentRangeInfo.value = rangeInfo || null
    showCommentModal.value = true
}

const hideCommentModal = () => {
    showCommentModal.value = false
    currentSelectedText.value = ''
    editingCommentId.value = ''
    editingCommentContent.value = ''
}

const hideCommentDisplay = () => {
    showCommentDisplay.value = false
    selectedComment.value = null
}

const handleSaveComment = async (data: { text: string; comment: string; commentId?: string }) => {
    try {
        const url = window.location.href
        const hash = window.location.hash || '#'
        
        if (data.commentId) {
            await CommentStorage.updateComment(data.commentId, { comment: data.comment })
            maLogger.log('更新留言成功:', data.commentId)
        } else {
            await CommentStorage.saveComment({
                text: data.text,
                comment: data.comment,
                url,
                hash,
                rangeInfo: currentRangeInfo.value || undefined
            })
            maLogger.log('保存留言成功')
        }

        hideCommentModal()
        currentRangeInfo.value = null
        await loadPageComments()
        showSuccessMessage('留言保存成功！')
    } catch (error) {
        maLogger.error('保存留言失败:', error)
    }
}

const handleDeleteComment = async (commentId: string) => {
    try {
        await CommentStorage.deleteComment(commentId)
        maLogger.log('删除留言成功:', commentId)
        hideCommentModal()
        await loadPageComments()
        showSuccessMessage('留言删除成功！')
    } catch (error) {
        maLogger.error('删除留言失败:', error)
    }
}

const handleEditComment = () => {
    if (selectedComment.value) {
        editingCommentId.value = selectedComment.value.id
        editingCommentContent.value = selectedComment.value.comment
        currentSelectedText.value = selectedComment.value.text
        showCommentDisplay.value = false
        showCommentModal.value = true
    }
}

const handleHashChange = () => {
    loadPageComments()
}

onMounted(() => {
    loadState()
    loadPageComments()
    
    window.addEventListener('hashchange', handleHashChange)
    
    componentManager.register('TextSelectionToolbar', {
        show,
        hide,
        updateText,
        showWithIframeText,
        showTranslationPanel,
        updateTranslationPanel,
        shakeTranslationPanelBySourceText,
        hideTranslationPanel,
        showReplaceModal: showReplaceModalFn,
        showCommentModal: showCommentModalFn
    })
})

onUnmounted(() => {
    window.removeEventListener('hashchange', handleHashChange)
    componentManager.unregister('TextSelectionToolbar')
})
</script>

<style scoped lang="scss">
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

.red-dot {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 2px solid rgba(255, 255, 255, 0.94);
    background: linear-gradient(135deg, #f97316, #0d9488);
    border-radius: 50%;
    cursor: pointer;
    pointer-events: auto;
    box-shadow:
        0 6px 16px rgba(15, 23, 42, 0.18),
        0 0 0 4px rgba(13, 148, 136, 0.14);
    animation: pulse 2s infinite;
    z-index: 999999;
    transition: transform 0.2s ease;
}

.red-dot:hover {
    transform: scale(1.15);
}

.red-dot:focus-visible {
    outline: 2px solid rgba(249, 115, 22, 0.8);
    outline-offset: 3px;
}

@keyframes pulse {
    0% {
        box-shadow:
            0 6px 16px rgba(15, 23, 42, 0.18),
            0 0 0 4px rgba(13, 148, 136, 0.14);
    }

    50% {
        box-shadow:
            0 8px 18px rgba(15, 23, 42, 0.2),
            0 0 0 7px rgba(13, 148, 136, 0.1),
            0 0 0 11px rgba(249, 115, 22, 0.08);
    }

    100% {
        box-shadow:
            0 6px 16px rgba(15, 23, 42, 0.18),
            0 0 0 4px rgba(13, 148, 136, 0.14);
    }
}

@media (prefers-reduced-motion: reduce) {
    .animation-container,
    .red-dot {
        animation: none;
        transition: none;
    }
}
</style>
