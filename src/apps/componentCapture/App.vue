<template>
  <div class="component-capture-container" ref="captureContainer">
    <!-- 悬浮提示框背景 -->
    <div class="capture-overlay" v-if="isCapturing"></div>

    <!-- 圆形缩小图标 -->
    <div class="minimized-icon" v-if="isCapturing && isMinimized" @click="expandPopup">
      <span>🔍</span>
    </div>

    <!-- 选中元素信息 -->
    <div class="selection-info" v-if="isCapturing && selectedElement && !isMinimized"
      :style="{ top: popupPosition.selectionInfo.top + 'px', left: popupPosition.selectionInfo.left + 'px', transform: 'none' }"
      @mousedown="handleMouseDown($event, 'selectionInfo')">
      <div class="info-header" style="cursor: move;">
        <span class="element-tag">&lt;{{ selectedElement.tagName.toLowerCase() }}&gt;</span>
        <div class="header-buttons">
          <button class="minimize-btn" @click.stop="minimizePopup">−</button>
          <button class="close-btn" @click.stop="exitCapture">✕</button>
        </div>
      </div>
      <div class="info-body">
        <div v-if="selectedElement.id" class="info-item">
          <span class="label">ID:</span>
          <span class="value">#{{ selectedElement.id }}</span>
        </div>
        <div v-if="selectedElement.className" class="info-item">
          <span class="label">Class:</span>
          <span class="value">.{{ selectedElement.className.split(' ').join('.') }}</span>
        </div>
      </div>
      <div class="info-footer">
        <button class="cancel-btn" @click.stop="cancelSelection">取消</button>
        <button class="confirm-btn" @click.stop="confirmSelection">确认捕获</button>
      </div>
    </div>

    <!-- 组件预览和代码展示 -->
    <div class="component-preview" v-if="showPreview && capturedCode"
      :style="{ top: popupPosition.componentPreview.top + 'px', left: popupPosition.componentPreview.left + 'px', transform: 'none' }"
      @mousedown="handleMouseDown($event, 'componentPreview')">
      <div class="preview-header" style="cursor: move;">
        <h3>🎉 组件捕获成功！</h3>
        <button class="close-preview-btn" @click.stop="closePreview">✕</button>
      </div>
      <div class="preview-content">
        <div class="code-section">
          <div class="section-header">
            <span>组件代码</span>
            <button class="copy-btn" @click.stop="copyCode">
              {{ copied ? '已复制 ✓' : '复制代码' }}
            </button>
          </div>
          <textarea class="code-display" readonly :value="capturedCode"></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { eventManager } from '@/event'

// 状态管理
const isCapturing = ref(false)
const selectedElement = ref<Element | null>(null)
const highlightOverlay = ref<HTMLDivElement | null>(null)
const showPreview = ref(false)
const capturedCode = ref('')
const copied = ref(false)
const isMinimized = ref(false)

// 拖动相关状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const popupPosition = ref({
  selectionInfo: { top: 20, left: window.innerWidth / 2 - 200 }, // 200是弹窗宽度的一半
  componentPreview: { top: window.innerHeight / 2 - 250, left: window.innerWidth / 2 - 300 } // 300是弹窗宽度的一半，250是弹窗高度的一半
})

// 拖动目标
const dragTarget = ref<string | null>(null)

/**
 * 创建高亮遮罩层
 */
function createHighlightOverlay(): HTMLDivElement {
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    border: 2px solid #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    z-index: 999998;
    transition: all 0.1s ease;
    border-radius: 4px;
  `
  return overlay
}

/**
 * 更新高亮位置
 */
function updateHighlight(element: Element): void {
  if (!highlightOverlay.value) return

  const rect = element.getBoundingClientRect()
  highlightOverlay.value.style.left = `${rect.left + window.scrollX}px`
  highlightOverlay.value.style.top = `${rect.top + window.scrollY}px`
  highlightOverlay.value.style.width = `${rect.width}px`
  highlightOverlay.value.style.height = `${rect.height}px`
}

/**
 * 移除高亮
 */
function removeHighlight(): void {
  if (highlightOverlay.value && highlightOverlay.value.parentNode) {
    highlightOverlay.value.parentNode.removeChild(highlightOverlay.value)
    highlightOverlay.value = null
  }
}

/**
 * 检查元素是否是扩展自身的元素
 */
function isExtensionElement(element: Element): boolean {
  // 检查元素本身是否是扩展的shadow host
  if (element.id === 'ma-extension-shadow-host') {
    return true
  }

  // 检查元素是否在扩展的shadow host内
  let current = element
  while (current) {
    if (current.id === 'ma-extension-shadow-host') {
      return true
    }
    current = current.parentElement!
  }

  return false
}

/**
 * 处理鼠标移动
 */
function handleMouseMove(event: MouseEvent): void {
  if (!isCapturing.value) return

  // 禁用鼠标事件的默认行为和冒泡，防止网站的悬浮响应
  event.preventDefault()
  event.stopPropagation()

  try {
    // 使用try-catch防止元素获取失败
    const element = document.elementFromPoint(event.clientX, event.clientY)
    if (element && element !== highlightOverlay.value && !isExtensionElement(element)) {
      updateHighlight(element)
    }
  } catch (error) {
    maLogger.warn('获取元素失败:', error)
  }
}
const captureContainer = useTemplateRef<HTMLDivElement | null>('captureContainer')

/**
 * 处理点击
 */
function handleClick(event: MouseEvent): void {
  // if (!isCapturing.value) return

  const target = event.target as Element

  // 检查是否是弹窗容器或弹窗内的元素
  // if (target === captureContainer.value || captureContainer.value?.contains(target)) {
  //   // 如果是弹窗容器或弹窗内的元素，不阻止事件 
  //   return
  // }

  // 检查点击的是否是高亮层
  if (target === highlightOverlay.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const element = document.elementFromPoint(event.clientX, event.clientY)
  if (element && element !== highlightOverlay.value && !isExtensionElement(element)) {
    selectedElement.value = element
    // 点击后停止鼠标移动监听，避免继续高亮其他元素
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('click', handleClick, true)
    document.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * 处理键盘事件
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (!isCapturing.value) return

  if (event.key === 'Escape') {
    exitCapture()
  }
}

/**
 * 开始拖动
 */
function handleMouseDown(event: MouseEvent, target: string): void {
  isDragging.value = true
  dragTarget.value = target
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY

  // 添加全局鼠标移动和释放事件监听器
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleMouseUp)
}

/**
 * 处理拖动
 */
function handleDragMove(event: MouseEvent): void {
  if (!isDragging.value || !dragTarget.value) return

  const deltaX = event.clientX - dragStartX.value
  const deltaY = event.clientY - dragStartY.value

  // 更新弹窗位置
  if (dragTarget.value === 'selectionInfo') {
    popupPosition.value.selectionInfo.top += deltaY
    popupPosition.value.selectionInfo.left += deltaX
  } else if (dragTarget.value === 'componentPreview') {
    popupPosition.value.componentPreview.top += deltaY
    popupPosition.value.componentPreview.left += deltaX
  }

  // 更新起始位置，用于下一次计算
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
}

/**
 * 结束拖动
 */
function handleMouseUp(): void {
  isDragging.value = false
  dragTarget.value = null

  // 移除全局事件监听器
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

/**
 * 开始捕获
 */
function startCapture(): void {
  isCapturing.value = true
  selectedElement.value = null
  showPreview.value = false
  capturedCode.value = ''
  isMinimized.value = false

  if (!highlightOverlay.value) {
    highlightOverlay.value = createHighlightOverlay()
    document.body.appendChild(highlightOverlay.value)
  }

  // 确保添加事件监听器
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('click', handleClick, true)
  document.addEventListener('keydown', handleKeyDown)

  maLogger.log('组件捕获模式已启动')
}

/**
 * 取消选择
 */
function cancelSelection(): void {
  selectedElement.value = null
  // 取消选择后重新开始监听鼠标移动事件
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('click', handleClick, true)
  document.addEventListener('keydown', handleKeyDown)
}

/**
 * 提取元素的计算样式
 */
function extractElementStyles(element: Element): string {
  const styles = window.getComputedStyle(element)
  let styleStr = ''

  // 提取主要的样式属性
  const importantStyles = [
    'display', 'position', 'top', 'left', 'width', 'height',
    'margin', 'padding', 'border', 'border-radius',
    'background', 'color', 'font-size', 'font-family',
    'text-align', 'line-height', 'box-shadow'
  ]

  importantStyles.forEach(prop => {
    const value = styles[prop as any]
    if (value && value !== 'auto' && value !== 'none') {
      styleStr += `  ${prop}: ${value};
`
    }
  })

  return styleStr
}

/**
 * 提取元素HTML代码和样式
 */
function extractElementCode(element: Element): string {
  const clone = element.cloneNode(true) as Element

  // 移除一些可能包含敏感信息的属性
  const attributesToRemove = ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup']
  attributesToRemove.forEach(attr => {
    clone.removeAttribute(attr)
    // 也检查子元素
    clone.querySelectorAll(`[${attr}]`).forEach(el => el.removeAttribute(attr))
  })

  // 美化HTML
  let html = clone.outerHTML

  // 简单的格式化
  html = html
    .replace(/></g, '>\n<')
    .replace(/\n\s*\n/g, '\n')

  // 提取样式
  const styles = extractElementStyles(element)

  // 组合HTML和样式
  let result = `<template><!-- 组件HTML结构 -->
${html}\n\n<!-- 组件样式 --></template>
<style>
${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className ? `.${element.className.split(' ').join('.')}` : ''} {
${styles}}
</style>`

  return result
}

/**
 * 确认选择
 */
function confirmSelection(): void {
  if (!selectedElement.value) return

  maLogger.log('已选择元素:', selectedElement.value)

  // 提取代码
  capturedCode.value = extractElementCode(selectedElement.value)

  // 显示预览
  showPreview.value = true

  // 发送事件通知
  // bus.emit('component-captured', {
  //   element: selectedElement.value,
  //   code: capturedCode.value
  // })

  exitCapture()
}

/**
 * 缩小弹窗
 */
function minimizePopup(): void {
  isMinimized.value = true
  maLogger.log('组件捕获弹窗已缩小')
}

/**
 * 展开弹窗
 */
function expandPopup(): void {
  isMinimized.value = false
  maLogger.log('组件捕获弹窗已展开')
}

/**
 * 退出捕获模式
 */
function exitCapture(): void {
  isCapturing.value = false
  selectedElement.value = null
  isMinimized.value = false

  removeHighlight()

  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('click', handleClick, true)
  document.removeEventListener('keydown', handleKeyDown)

  maLogger.log('组件捕获模式已退出')
}

/**
 * 关闭预览
 */
function closePreview(): void {
  showPreview.value = false
  capturedCode.value = ''
}

/**
 * 复制代码到剪贴板
 */
async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(capturedCode.value)
    copied.value = true

    setTimeout(() => {
      copied.value = false
    }, 2000)

    maLogger.log('代码已复制到剪贴板')
  } catch (error) {
    maLogger.error('复制代码失败:', error)

    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = capturedCode.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)

    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

const bus = eventManager.useBus('start-component-capture', startCapture)

// 监听启动捕获事件
onMounted(() => {
})

onUnmounted(() => {
  exitCapture()
})

// 暴露方法给外部使用
defineExpose({
  startCapture,
  exitCapture,
  bus
})
</script>

<style scoped>
.component-capture-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 999997;
}

.selection-info,
.waiting-hint,
.component-preview {
  pointer-events: auto;
}

.capture-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 999998;
}

.selection-info {
  position: fixed;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  min-width: 400px;
  z-index: 1000000;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.element-tag {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  color: #3b82f6;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.info-body {
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.value {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.info-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.cancel-btn {
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.confirm-btn {
  padding: 8px 20px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.waiting-hint {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 32px 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  text-align: center;
  z-index: 1000000;
}

.hint-content {
  margin-bottom: 20px;
}

.hint-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.hint-text {
  font-size: 18px;
  color: #e2e8f0;
  font-weight: 600;
  margin-bottom: 8px;
}

.hint-subtext {
  font-size: 14px;
  color: #64748b;
}

.exit-btn {
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.exit-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* 组件预览样式 */
.minimized-icon {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  z-index: 1000000;
  transition: all 0.3s ease;
  pointer-events: auto;
}

.minimized-icon:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
}

.minimized-icon span {
  font-size: 24px;
  color: white;
}

.header-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.minimize-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.minimize-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.hint-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}

.component-preview {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  z-index: 1000001;
  min-width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  pointer-events: auto;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.preview-header h3 {
  margin: 0;
  font-size: 18px;
  color: #e2e8f0;
  font-weight: 600;
}

.close-preview-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-preview-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.preview-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.code-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header span {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.copy-btn {
  padding: 6px 16px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.code-display {
  width: 100%;
  min-height: 300px;
  max-height: 50vh;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e2e8f0;
  resize: vertical;
  overflow: auto;
}

.code-display::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.code-display::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.code-display::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.code-display::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>