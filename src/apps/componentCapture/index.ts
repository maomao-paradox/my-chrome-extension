/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @file src/apps/componentCapture/index.ts
 */



import { AppModule } from '@/assets/types'
import { shadowHostId } from '@/config'
import ComponentCaptureApp from './App.vue'
import { createShadowHost, injectCssDom } from '@/utils/shadow-dom'
import { createApp } from 'vue'
import { pinia } from '@/stores'
import { getAssetsAbstractPath, getAssetsAbstractPathSync } from '@/utils/common'
import { addElementToDom } from '@/utils/element-control'
import { bus } from '@/event'


const pluginName = 'componentCapture'

class ComponentCaptureModule implements AppModule {
  _context: any = null
  shadowHostId: string = shadowHostId
  isInjected: boolean = false
  vueContainer: HTMLElement | null = null
  shadowRoot: ShadowRoot | null = null
  appInstance: ReturnType<typeof createApp> | null = null
  isCapturing: boolean = false
  isEnabled: boolean = false

  constructor() {
    maLogger.log('ComponentCaptureModule initialized')
  }

  /**
   * 注入模块
   */
  async inject(): Promise<void> {
    try {
      if (window.self !== window.top) {
        maLogger.log('不是主页面，不注入组件捕获模块')
        return
      }

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

      if (this.isInjected && this.appInstance && this.vueContainer && this.shadowRoot) {
        return
      }

      if (!this.shadowRoot) {
        const { shadowRoot } = createShadowHost(this.shadowHostId, 'open')
        this.shadowRoot = shadowRoot
      }

      if (!this.isInjected) {
        injectCssDom(this.shadowRoot as ShadowRoot, getAssetsAbstractPathSync(`css/${pluginName}`))
        this.isInjected = true
      }

      if (!this.vueContainer && !this.shadowRoot?.getElementById(`shadow-app-${pluginName}`)) {
        this.vueContainer = addElementToDom({
          tag: 'div',
          attrs: {
            id: `shadow-app-${pluginName}`
          },
          style: 'position: fixed; z-index: var(--z-index);'
        })(this.shadowRoot as ShadowRoot)
      }

      if (this.appInstance) {
        this.appInstance.unmount()
        this.appInstance = null
      }

      this.appInstance = createApp(ComponentCaptureApp)
      this.appInstance.use(pinia)
      this.appInstance.mount(this.vueContainer!)

    } catch (error) {
      maLogger.error('注入组件捕获模块失败:', error)
    }
  }

  /**
   * 启用模块
   */
  enable(): void {
    this.inject().catch(error => {
      maLogger.error('启用组件捕获模块失败:', error)
    })
  }

  /**
   * 禁用模块
   */
  disable(): void {
    this.hide()
    this.cleanup()
  }

  /**
   * 触发组件捕获
   */
  async triggerComponentCapture(): Promise<void> {
    try {
      maLogger.log('开始组件捕获...')
      await this.inject()

      // 显示Vue容器
      if (this.vueContainer) {
        this.vueContainer.style.display = 'block'
      }

      // 通过事件总线启动捕获
      bus.emit('start-component-capture')
    } catch (error) {
      maLogger.error('触发组件捕获失败:', error)
    }
  }

  /**
   * 触发组件捕获（别名，保持向后兼容）
   */
  async captureComponent(): Promise<void> {
    return this.triggerComponentCapture()
  }

  /**
   * 隐藏捕获界面
   */
  private hide(): void {
    if (this.vueContainer) {
      this.vueContainer.style.display = 'none'
      this.isCapturing = false
      maLogger.log('组件捕获界面已隐藏')
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.appInstance) {
      this.appInstance.unmount()
      this.appInstance = null
    }

    if (this.vueContainer) {
      try {
        this.vueContainer.remove()
      } catch (error) {
        // 元素可能已经被移除
      }
      this.vueContainer = null
    }

    this.isCapturing = false
  }

  /**
   * 初始化
   */
  async init(context?: any): Promise<void> {
    this._context = context
    maLogger.log('ComponentCaptureModule initialized with context')
  }
}

let moduleInstance: ComponentCaptureModule | null = null

export default (context: AppContext): AppModule => {
  if (!moduleInstance) {
    moduleInstance = new ComponentCaptureModule()
    moduleInstance.init(context)
  }
  return moduleInstance
}

/**
 * 触发组件捕获的快捷函数
 */
export function triggerComponentCapture(): void {
  if (moduleInstance) {
    moduleInstance.captureComponent()
  }
}
