/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/menu/index.ts
 * @date 2026-02-05T02:38:01.689Z
 */

import { pinia } from '@/stores';
import MenuApp from './App.vue';
import { createApp } from 'vue';
import { $id, addElementToDom, createShadowHost, injectCssDom, getAssetsAbstractPathSync } from '@/utils';
import { Tool, AppModule } from '@/types';
import { storage } from '@/stores';
import { appConfigKey, shadowHostId } from '@/config';

/**
 * @author 月光下的牧师
 * @version v1.0.0
 * @license MIT
 * @sequence Ⅲ 牧师
 */

// export const shadowHostId = "floating-shadow"

// 定义菜单选项接口
declare interface MenuOptions {
    tools?: Tool[],
    visible?: boolean
}

const waitForBodyReady = async (): Promise<void> => {
  if (document.body) {return;}
  await new Promise<void>(resolve => {
    const check = () => document.body ? resolve() : requestAnimationFrame(check);
    check();
  });
};

class Menu implements AppModule {
  _context: any = null;
  _name: string = 'menu';
  shadowHostId: string = shadowHostId;
  isInjected: boolean = false;
  vueContainer: HTMLElement | null = null;
  shadowRoot: ShadowRoot | null = null;
  appInstance: any | null = null;
  isEnabled: boolean = false;
  // 自定义工具配置
  private customTools: Tool[] = [
    { id: 'glass-card', label: '悬浮毛玻璃卡片', details: '创建一个可拖动、可调宽高和透明度的毛玻璃悬浮卡片，双击空白区域即可关闭', icon: 'ai-chat' },
    { id: 'image', label: '下载图片', details: '下载当前页面的所有图片，包括base64编码的图片，src属性中的图片和svg矢量图', icon: 'ai-chat' },
    { id: 'ai-chat', label: 'AI聊天', details: '与AI进行聊天，支持中文、英文等语言', icon: 'ai-chat' },
    { id: 'autoClick', label: '自动点击元素', details: '自动点击页面上的元素', icon: 'ai-chat' }
  ];

  // 自定义事件
  private unloadFloatingballEvent: CustomEvent;
  private loadFloatingballEvent: CustomEvent;

  constructor() {
    // 初始化自定义事件
    this.unloadFloatingballEvent = new CustomEvent('unload-menu', {
      detail: { message: 'Hello, World!' },
      bubbles: true,
      cancelable: true
    });

    this.loadFloatingballEvent = new CustomEvent('load-menu', {
      detail: { message: 'Hello, World!' },
      bubbles: true,
      cancelable: true
    });
  }

  /**
     * 获取卸载事件
     */
  getUnloadEvent(): CustomEvent {
    return this.unloadFloatingballEvent;
  }

  /**
     * 获取加载事件
     */
  getLoadEvent(): CustomEvent {
    return this.loadFloatingballEvent;
  }

  /**
     * 注入菜单到页面
     */
  async inject(options?: MenuOptions): Promise<void> {
    try {
      if (window.self !== window.top) {return maLogger.log('不是主页面，不注入固定菜单'), void 0;}
      await waitForBodyReady();
      if (this.isInjected && this.appInstance && this.vueContainer && this.shadowRoot && $id(this.shadowHostId)) {return;}

      if (!this.shadowRoot) {
        const { shadowRoot } = createShadowHost(this.shadowHostId, 'open');
        this.shadowRoot = shadowRoot;
      }

      const { tools, visible = true } = options || {};

      if (!this.isInjected) {
        injectCssDom(this.shadowRoot as ShadowRoot, getAssetsAbstractPathSync(`css/${this._name}`));
        this.isInjected = true;
      }

      if (!this.vueContainer && !this.shadowRoot?.getElementById(`shadow-app-${this._name}`)) {
        this.vueContainer = addElementToDom({
          tag: 'div',
          attrs: { id: `shadow-app-${this._name}` },
          style: 'position: fixed; z-index: var(--z-index);'
        })(this.shadowRoot as ShadowRoot);
      }

      this.setupEventListeners();

      if (this.appInstance) {
        this.appInstance.unmount();
        this.appInstance = null;
      }

      this.appInstance = createApp(MenuApp, {
        tools: tools || this.customTools,
        visible
        // icon: icon || getStaticAbstractPath("icons/floatingball.png"),
      });

      this.appInstance.use(pinia);
      this.appInstance.mount(this.vueContainer);

    } catch (error) {
      maLogger.error('注入固定菜单失败:', error);
    }
  }

  /**
     * 设置事件监听器
     */
  private setupEventListeners(): void {
    if (!this.vueContainer) {return;}

    // 监听显示/隐藏事件
    window.addEventListener(`unload-${this._name}`, () => {
      if (this.vueContainer) {
        this.vueContainer.style.display = 'none';
      }
    });

    window.addEventListener(`load-${this._name}`, () => {
      if (this.vueContainer) {
        this.vueContainer.style.display = 'block';
      }
    });
  }

  /**
     * 启用固定菜单
     */
  async enable(): Promise<void> {
    try {
      // 如果未注入，则先注入
      if (!this.isInjected || !$id(this.shadowHostId)) {
        await this.inject({ visible: true });
      } else {
        window.dispatchEvent(this.loadFloatingballEvent);
      }

    } catch (error) {
      maLogger.error('启用固定菜单失败:', error);
    }
  }

  /**
     * 禁用固定菜单
     */
  disable(): void {
    try {
      // 触发卸载事件
      window.dispatchEvent(this.unloadFloatingballEvent);

      // 直接操作DOM，确保组件被隐藏
      if (this.vueContainer) {
        this.vueContainer.style.display = 'none';
        maLogger.info('固定菜单已直接隐藏');
      }
    } catch (error) {
      maLogger.error('禁用固定菜单失败:', error);
    }
  }

  /**
     * 初始化固定菜单
     */
  async init(): Promise<void> {
    try {
      // 可以从存储中加载配置
      const config = await storage.ext.local.get(appConfigKey);
      if (config && config.floatingBall && config.floatingBall.value !== false) {
        this.enable();
      }
      this.setupEventListeners();
    } catch (error) {
      maLogger.error('初始化固定菜单失败:', error);
    }
  }

  /**
     * 根据设置更新状态
     */
  updateStatus(enabled: boolean): void {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
}

// 导出默认函数，兼容ESMModuleLoader
export default (ctx: AppContext, options?: any): AppModule => {
  const appInstance = new Menu();
  appInstance.init();
  return appInstance;
};
