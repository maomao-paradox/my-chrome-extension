/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/textSelectionToolbar/index.ts
 * @date 2026-02-05T02:38:01.692Z
 */

import { AppModule } from '@/assets/types'
import { shadowHostId } from '@/config'
import TextSelectionToolbarApp from './App.vue'
import { createShadowHost, injectCssDom } from '@/utils/shadow-dom'
import { storage } from '@/stores'
import { pinia } from '@/stores/index'
import { getElementAbsolutePosition, debounce, ElementPositionInfo, addElementToDom, PositionStrategy } from '@/utils/element-control'
import { createApp } from 'vue'
import { componentManager } from '@/utils/componentManager'
import { TextTool } from '@/assets/types'
import { bus } from '@/event'
import { getAssetsAbstractPath, getAssetsAbstractPathSync } from '@/utils/common'
import { generateId } from '@/utils/base'
import { BookmarkStorage } from '@/services/bookmarkStorage'
import { loadAIConfig } from '@/utils/ai-config'

const appName = 'textSelectionToolbar'

const TRANSLATOR_CONFIG = { role: 'translator' } as const

const createTranslationStreamPort = (messageId: string) => {
  const port = chrome.runtime.connect({ name: `ai-conversation-${messageId}` })
  maLogger.log('创建端口连接成功:', port)
  return port
}

type OnStreamUpdate = (content: string, status: TranslationPanelStatus) => void

const setupTranslationStreamHandlers = (
  port: chrome.runtime.Port,
  messageId: string,
  onUpdate: OnStreamUpdate
): string => {
  let fullTranslation = ''

  const getStatusForType = (type: string): TranslationPanelStatus | null => {
    if (type === 'AI_CONVERSATION_STREAM_DATA') return 'success'
    if (type === 'AI_CONVERSATION_ERROR') return 'error'
    return null
  }

  port.onMessage.addListener((msg) => {
    maLogger.log('收到端口消息:', msg)
    if (msg.payload?.messageId !== messageId) return

    const status = getStatusForType(msg.type)

    if (msg.type === 'AI_CONVERSATION_STREAM_DATA' && status) {
      fullTranslation += msg.payload.content
      maLogger.log('收到流式数据:', msg.payload.content)
      onUpdate(fullTranslation, status)
    } else if (msg.type === 'AI_CONVERSATION_ERROR' && status) {
      maLogger.log('收到错误消息:', msg.payload.error)
      onUpdate(`翻译失败: ${msg.payload.error}`, status)
    } else if (msg.type === 'AI_CONVERSATION_COMPLETE') {
      maLogger.log('收到完成消息')
      port.disconnect()
    }
  })

  port.onDisconnect.addListener(() => maLogger.log('端口已断开连接'))
  return fullTranslation
}

declare interface TextSelectionToolbarOptions {
  enabled?: boolean
  tools?: TextTool[]
}

type TranslationPanelStatus = 'loading' | 'success' | 'error'

interface TranslationPanelPosition {
  left: number
  top: number
}

interface TranslationPanelPayload {
  messageId: string
  content: string
  status?: TranslationPanelStatus
  position?: TranslationPanelPosition
  sourceText?: string
}

// 文本选择工具栏模块
class TextSelectionToolbarModule implements AppModule {
  shadowHostId: string = shadowHostId
  isInjected: boolean = false
  vueContainer: HTMLElement | null = null
  shadowRoot: ShadowRoot | null = null
  appInstance: ReturnType<typeof createApp> | null = null
  isEnabled: boolean = false
  private _context: any = null
  private isVisible: boolean = false
  private positionTimer: ReturnType<typeof setTimeout> | null = null
  private customTools: TextTool[] = []
  private showCloseBtn: boolean = true
  private highlightedElements: HTMLElement[] = []
  private selectedText: string = ''
  private selectionRange: Range | null = null

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  private getTranslationPanelPosition(): TranslationPanelPosition {
    const margin = 12
    const selectionRect = this.selectionRange?.getBoundingClientRect() ?? null
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const panelWidth = Math.min(560, viewportWidth - margin * 2)
    const panelHeight = Math.min(320, viewportHeight - margin * 2)

    let left = 100
    let top = 100

    if (selectionRect) {
      left = selectionRect.left + selectionRect.width / 2 - panelWidth / 2

      const preferredTop = selectionRect.bottom + 12
      const fallbackTop = selectionRect.top - panelHeight - 12
      top = preferredTop + panelHeight + margin <= viewportHeight ? preferredTop : fallbackTop
    }

    const maxLeft = Math.max(margin, viewportWidth - panelWidth - margin)
    const maxTop = Math.max(margin, viewportHeight - panelHeight - margin)

    return {
      left: Math.round(this.clamp(left, margin, maxLeft)),
      top: Math.round(this.clamp(top, margin, maxTop))
    }
  }

  private showTranslationPanel(payload: TranslationPanelPayload): void {
    componentManager.call('TextSelectionToolbar', 'showTranslationPanel', payload)
  }

  private updateTranslationPanel(payload: TranslationPanelPayload): void {
    componentManager.call('TextSelectionToolbar', 'updateTranslationPanel', payload)
  }

  private shakeTranslationPanelBySourceText(sourceText: string): boolean {
    return !!componentManager.call('TextSelectionToolbar', 'shakeTranslationPanelBySourceText', sourceText)
  }

  private createErrorContainer(error: any): HTMLElement {
    const container = document.createElement('div')
    container.style.cssText = `
      background-color: #ffebee;
      border: 1px solid #ffcdd2;
      border-radius: 4px;
      padding: 10px;
      margin-top: 10px;
      font-size: 14px;
      line-height: 1.5;
      max-width: 800px;
      position: fixed;
      z-index: 999999;
      left: 100px;
      top: 100px;
    `

    const content = document.createElement('div')
    content.style.color = '#c62828'
    content.textContent = `翻译失败: ${error instanceof Error ? error.message : String(error)}`
    container.appendChild(content)

    return container
  }

  /**
   * 处理翻译功能
   */
  private async handleTranslation(): Promise<void> {
    const textToTranslate = this.selectedText.trim()
    if (!textToTranslate) return
    if (this.shakeTranslationPanelBySourceText(textToTranslate)) {
      maLogger.log('命中已存在的翻译面板，触发抖动提示:', textToTranslate)
      return
    }

    const messageId = generateId()
    maLogger.log('翻译开始执行，文本:', textToTranslate)

    try {
      this.showTranslationPanel({
        messageId,
        content: '正在翻译...',
        status: 'loading',
        position: this.getTranslationPanelPosition(),
        sourceText: textToTranslate
      })

      const port = createTranslationStreamPort(messageId)

      setupTranslationStreamHandlers(port, messageId, (content, status) => {
        this.updateTranslationPanel({ messageId, content, status })
      })

      const aiConfig = await loadAIConfig()

      port.postMessage({
        type: 'START_AI_CONVERSATION',
        payload: {
          prompt: `请将以下文本翻译成中文，并附带简短的解释：\n\n${textToTranslate}`,
          ...TRANSLATOR_CONFIG,
          provider: aiConfig.provider,
          model: aiConfig.modelId,
          apiKey: aiConfig.apiKey,
          apiBaseUrl: aiConfig.apiBaseUrl
        }
      })
      maLogger.log('翻译请求已发送')
    } catch (error) {
      maLogger.error('翻译失败:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      const isConnectError = String(error).includes('端口') || String(error).includes('connect')
      const panelUpdate = { messageId, content: `${isConnectError ? '连接' : '翻译'}失败: ${errorMsg}`, status: 'error' } as const
      isConnectError
        ? this.updateTranslationPanel(panelUpdate)
        : this.showTranslationPanel({ ...panelUpdate, position: this.getTranslationPanelPosition() })
    }
  }

  /**
   * 处理书签功能
   */
  private async handleBookmark(sourceText?: string): Promise<void> {
    const text = (sourceText || this.selectedText).trim();
    maLogger.log('书签开始执行，文本:', text);

    try {
      if (!text || text.trim().length === 0) {
        maLogger.warn('书签保存失败：文本为空');
        return;
      }

      // 获取当前网页信息
      const url = window.location.href;
      const title = document.title;
      const scrollPosition = {
        x: window.pageXOffset || document.documentElement.scrollLeft,
        y: window.pageYOffset || document.documentElement.scrollTop
      };

      maLogger.log('保存书签信息:', { text, url, title, scrollPosition });

      // 保存书签
      const bookmark = await BookmarkStorage.saveBookmark({
        text,
        url,
        title,
        scrollPosition
      });

      maLogger.log('书签保存成功:', bookmark);

      // 显示保存成功的反馈
      this.showBookmarkSuccess();
    } catch (error) {
      maLogger.error('书签保存失败:', error);
      // 显示错误信息
      const errorContainer = this.createErrorContainer(error);
      document.body.appendChild(errorContainer);
    }
  }

  /**
   * 显示书签保存成功的反馈
   */
  private showBookmarkSuccess(): void {
    const successContainer = document.createElement('div');
    successContainer.style.cssText = `
      background-color: #e8f5e8;
      border: 1px solid #c8e6c9;
      border-radius: 4px;
      padding: 10px;
      margin-top: 10px;
      font-size: 14px;
      line-height: 1.5;
      max-width: 300px;
      position: fixed;
      z-index: 999999;
      right: 20px;
      top: 20px;
      animation: slideIn 0.3s ease-out;
    `;

    successContainer.innerHTML = `<div style="color: #2e7d32;">书签保存成功！</div>`;

    // 添加动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(successContainer);

    // 3秒后自动移除
    setTimeout(() => {
      successContainer.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        try {
          document.body.removeChild(successContainer);
          document.head.removeChild(style);
        } catch (error) {
          // 元素可能已经被移除
        }
      }, 300);
    }, 3000);
  }

  constructor(options?: TextSelectionToolbarOptions) {
    //@ts-ignore 初始化自定义工具配置    
    this.customTools = options?.tools || [
      {
        id: 'copy',
        label: '复制',
        handler: (text: string) => {
          const textToCopy = text || this.selectedText;
          navigator.clipboard.writeText(textToCopy).catch(err => {
            maLogger.error('复制失败:', err);
          });
        }
      },
      {
        id: 'light',
        label: '高亮',
        handler: () => {
          // 功能开发中，敬请期待
        }
      },
      {
        id: 'search',
        label: '搜索',
        handler: (text: string) => {
          const textToSearch = text || this.selectedText;
          window.open(`https://www.google.com/search?q=${encodeURIComponent(textToSearch)}`, '_blank')
        }
      },
      {
        id: 'translate',
        label: '翻译',
        handler: () => this.handleTranslation()
      },
      {
        id: 'bookmark',
        label: '书签',
        handler: (text: string) => this.handleBookmark(text)
      },
      {
        id: 'replace',
        label: '替换',
        handler: (text: string) => {
          const textToReplace = text || this.selectedText;
          componentManager.call('TextSelectionToolbar', 'showReplaceModal', textToReplace);
        }
      }
    ]
  }

  /**
   * 显示并定位组件
   */
  private showAndPositionComponent = (targetElement: HTMLElement | Node) => {
    if (!this.shadowRoot || !this.vueContainer) {
      maLogger.error("Shadow DOM 或 Vue 容器不存在");
      return;
    }

    // 获取元素绝对位置
    const positionInfo = getElementAbsolutePosition(targetElement);

    // 使用新的定位方法定位组件
    positionInfo.positionElement({
      targetElement: this.vueContainer,
      strategy: PositionStrategy.Down,
      alignment: 'center',
      offset: { x: 0, y: 10 },
      observeReference: false,
      pinned: true
    });

    // 清除之前的定时器
    this.clearPositionTimer();

    componentManager.call('TextSelectionToolbar', 'show')
  }

  /**
   * 隐藏组件
   */
  private hideComponent = () => {
    if (!this.vueContainer) return;

    componentManager.call('TextSelectionToolbar', 'hide')
  }

  /**
   * 清理组件资源
   */
  private cleanupComponent = () => {
    // 清除定时器
    this.clearPositionTimer();

    // 卸载Vue应用
    if (this.appInstance) {
      this.appInstance.unmount();
      this.appInstance = null;
    }

    // 移除容器元素
    if (this.vueContainer) {
      try {
        this.vueContainer.remove();
      } catch (error) {
        // 元素可能已经被移除
      }
      this.vueContainer = null;
    }
  }

  /**
   * 清除位置定时器
   */
  private clearPositionTimer(): void {
    if (this.positionTimer) {
      clearTimeout(this.positionTimer);
      this.positionTimer = null;
    }
  }

  /**
   * 创建临时元素用于定位
   */
  private createTempElement(x: number, y: number, width: number = 10, height: number = 10): HTMLElement {
    const tempElement = document.createElement('span');
    tempElement.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${width}px;
      height: ${height}px;
      pointer-events: none;
    `;
    document.body.appendChild(tempElement);
    return tempElement;
  }

  /**
   * 移除临时元素
   */
  private removeTempElement(element: HTMLElement): void {
    setTimeout(() => {
      try {
        document.body.removeChild(element);
      } catch (error) {
        // 元素可能已经被移除
      }
    }, 1000);
  }

  /**
   * 处理文本选择事件
   */
  // 防抖处理的文本选择事件
  private handleSelectionChange = debounce(() => {
    const selection = window.getSelection()
    if (!selection) return

    const text = selection.toString().trim()
    this.selectedText = text
    componentManager.call('TextSelectionToolbar', 'updateText', text)

    if (text.length > 0) {
      maLogger.log('用户选中了文本:', text)
      // 可以获取选区的位置信息
      try {
        const range = selection.getRangeAt(0)
        this.selectionRange = range
        const rect = range.getBoundingClientRect()
        maLogger.log('选中文本的位置:', rect)

        const positionInfo = new ElementPositionInfo({
          rect,
          zIndex: 0,
          scrollX: window.pageXOffset || document.documentElement.scrollLeft,
          scrollY: window.pageYOffset || document.documentElement.scrollTop,
          viewportWidth: window.innerWidth || document.documentElement.clientWidth,
          viewportHeight: window.innerHeight || document.documentElement.clientHeight
        })

        // 使用新的定位方法定位组件
        positionInfo.positionElement({
          targetElement: this.vueContainer!,
          strategy: PositionStrategy.Down,
          alignment: 'center',
          offset: { x: 0, y: 10 },
          observeReference: false,
          pinned: true
        });

        // 清除之前的定时器
        this.clearPositionTimer();

        componentManager.call('TextSelectionToolbar', 'show')
      } catch (error) {
        maLogger.error('获取选区位置失败:', error)
      }
    } else {
      // 当文本取消选择时，立即隐藏工具栏
      maLogger.log('用户取消选择文本')
      this.selectionRange = null
      this.hideComponent()
    }
  }, 500) // 500ms 防抖延迟

  /**
   * 处理双击事件
   */
  private handleDoubleClick = (event: MouseEvent) => {
    maLogger.log('用户双击了鼠标:', event)
    // 获取双击位置的文本
    const selection = window.getSelection()
    if (selection) {
      const text = selection.toString().trim()
      this.selectedText = text
      if (text.length > 0) {
        maLogger.log('双击选中的文本:', text)
        try {
          const range = selection.getRangeAt(0)
          this.selectionRange = range
        } catch (error) {
          maLogger.error('获取双击选区失败:', error)
        }

        // 创建临时元素用于定位
        const tempElement = this.createTempElement(event.clientX - 5, event.clientY - 5)

        // 显示并定位组件
        this.showAndPositionComponent(tempElement)

        // 移除临时元素
        this.removeTempElement(tempElement)
      }
    }
  }

  /**
   * 处理来自iframe的选择事件
   */
  private handleIframeSelectionChange = debounce((event: CustomEvent) => {
    maLogger.log('收到来自iframe的选择事件:', event)
    const { text, selectionRect } = event.detail
    this.selectedText = text
    if (text && text.length > 0 && selectionRect) {
      maLogger.log('iframe中选中的文本:', text)
      maLogger.log('选中文本的位置:', selectionRect)

      // 创建临时元素用于定位
      const tempElement = this.createTempElement(selectionRect.left, selectionRect.top, selectionRect.width, selectionRect.height)

      // 显示并定位组件
      this.showAndPositionComponent(tempElement)

      // 调用组件的showWithIframeText方法保存选中文本
      componentManager.call('TextSelectionToolbar', 'showWithIframeText', text)

      // 为iframe选择创建一个临时的Range对象
      // 由于iframe是独立文档，我们无法直接获取其Range
      // 但我们可以在主页面创建一个临时的Range来模拟
      try {
        const range = document.createRange()
        // 将Range定位到临时元素的位置
        range.selectNode(tempElement)
        this.selectionRange = range
        maLogger.log('为iframe选择创建临时Range:', range)
      } catch (error) {
        maLogger.error('创建iframe选择的临时Range失败:', error)
      }

      // 移除临时元素
      setTimeout(() => {
        try {
          document.body.removeChild(tempElement)
          // 当临时元素被移除时，清除selectionRange
          this.selectionRange = null
        } catch (error) {
          // 元素可能已经被移除
        }
      }, 1000)
    }
  }, 300)

  /**
   * 注入文本选择工具栏到页面
   */
  async inject(): Promise<void> {
    try {
      // 只有在主页面才注入
      if (window.self !== window.top) {
        maLogger.log('不是主页面，不注入文本选择工具栏')
        return
      }

      // 确保DOM准备好
      if (!document.body) {
        await new Promise(resolve => {
          const checkBody = () => {
            if (document.body) {
              resolve(null)
            } else {
              requestAnimationFrame(checkBody)
            }
          }
          checkBody()
        })
      }

      // maLogger.log("开始注入文本选择工具栏")

      // 如果已经注入，则不重复注入
      if (this.isInjected && this.appInstance && this.vueContainer && this.shadowRoot && document.getElementById(this.shadowHostId)) {
        return
      }

      if (!this.shadowRoot) {
        // maLogger.log("创建Shadow DOM")
        const { shadowRoot } = createShadowHost(this.shadowHostId, 'open')
        this.shadowRoot = shadowRoot
      }

      if (!this.isInjected) {
        // 注入样式
        // maLogger.log("注入悬浮球样式");
        injectCssDom(this.shadowRoot!, getAssetsAbstractPathSync(`css/${appName}`));
        this.isInjected = true
      }

      // 创建Vue容器
      if (!this.vueContainer && !this.shadowRoot?.getElementById(`shadow-app-${appName}`)) {
        this.vueContainer = addElementToDom({
          tag: 'div',
          attrs: {
            id: `shadow-app-${appName}`
          },
          style: 'position: fixed; z-index: var(--z-index);'
        })(this.shadowRoot!)
      }

      // 创建并挂载Vue应用
      if (this.appInstance) {
        this.appInstance.unmount()
        this.appInstance = null
      }

      // 使用TextSelectionToolbarApp组件
      this.appInstance = createApp(TextSelectionToolbarApp, {
        customTools: this.customTools,
        showCloseBtn: this.showCloseBtn
      })
      this.appInstance.use(pinia)
      this.appInstance.mount(this.vueContainer!)

    } catch (error) {
      maLogger.error('注入文本选择工具栏失败:', error)
    }
  }

  /**
   * 启用文本选择工具栏
   */
  enable(): void {
    try {
      // 确保ShadowRoot存在
      if (!this.shadowRoot) {
        // maLogger.log("创建Shadow DOM")
        const { shadowRoot } = createShadowHost(this.shadowHostId, 'open')
        this.shadowRoot = shadowRoot
      }

      // 如果未注入，则先注入
      if (!this.isInjected || !document.getElementById(this.shadowHostId)) {
        this.inject().catch(error => {
          maLogger.error('注入文本选择工具栏失败:', error)
        })
      }

      // maLogger.log("脚本注入完成，启用文本选择工具栏")

      //@ts-ignore 添加事件监听
      document.addEventListener('selectionchange', this.handleSelectionChange)
      document.addEventListener('dblclick', this.handleDoubleClick)
      //@ts-ignore  监听来自iframe的选择事件
      window.addEventListener('iframe-selectionchange', this.handleIframeSelectionChange)

      this.isEnabled = true
      maLogger.log('文本选择工具栏已启用')
    } catch (error) {
      maLogger.error('启用文本选择工具栏失败:', error)
    }
  }

  /**
   * 禁用文本选择工具栏
   */
  disable(): void {
    try {
      //@ts-ignore 移除事件监听
      document.removeEventListener('selectionchange', this.handleSelectionChange)
      document.removeEventListener('dblclick', this.handleDoubleClick)
      //@ts-ignore  移除来自iframe的选择事件监听
      window.removeEventListener('iframe-selectionchange', this.handleIframeSelectionChange)

      // 隐藏组件
      this.hideComponent()

      // 清理组件资源
      this.cleanupComponent()

      this.isEnabled = false
      maLogger.log('文本选择工具栏已禁用')
    } catch (error) {
      maLogger.error('禁用文本选择工具栏失败:', error)
    }
  }

  /**
   * 初始化文本选择工具栏
   */
  async init(context?: any, options?: TextSelectionToolbarOptions): Promise<void> {
    try {
      this._context = context;
      // 更新工具列表
      if (options?.tools) {
        this.customTools = [...options.tools]
      }

      // 可以从存储中加载配置
      const config = await storage.ext.local.get('appConfig')
      if (config && config.appConfig && config.appConfig.textSelectionToolbar !== false) {
        this.enable()
      }
    } catch (error) {
      maLogger.error('初始化文本选择工具栏失败:', error)
    }
  }

  /**
   * 根据设置更新状态
   */
  updateStatus(enabled: boolean): void {
    if (enabled) {
      this.enable()
    } else {
      this.disable()
    }
  }

  /**
   * 更新工具列表
   * @param tools 新的工具列表
   */
  // public updateTools(tools: TextTool[]): void {
  //   try {
  //     maLogger.log('开始更新文本选择工具栏工具列表', tools)

  //     if (!tools || tools.length === 0) {
  //       maLogger.warn('更新文本选择工具栏工具列表：工具列表为空')
  //       return
  //     }

  //     // 更新内部工具列表
  //     this.customTools = [...tools]
  //     maLogger.log('已更新内部工具列表', this.customTools)

  //     // 使用事件总线发送更新事件
  //     maLogger.log('通过事件总线发送tools更新事件');
  //     bus.emit('update:toolbar:tools', this.customTools);
  //   } catch (error) {
  //     maLogger.error('更新文本选择工具栏工具列表失败:', error)
  //   }
  // }
}

// 导出接口，兼容ESMModuleLoader
export default (ctx: AppContext, options?: any): AppModule => {
  const appInstance = new TextSelectionToolbarModule(options)
  appInstance.init(ctx)
  return appInstance
}
