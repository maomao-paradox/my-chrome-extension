/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/mcp/index.ts
 * @date 2026-02-05T02:38:01.689Z
 */

import { pinia } from '@/stores';
import MCPDialog from './MCPDialog.vue';
import { createApp } from 'vue';
import { $id, addElementToDom } from '@/utils/element-control';
import { createShadowHost } from '@/utils/shadow-dom';
import { AppModule } from '@/types/utils/index.js';

/**
 * MCP浏览器操作助手插件
 * 通过AI对话交互的形式操作浏览器
 * @author yourname
 * @version v1.0.0
 * @license MIT
 */

class MCP implements AppModule {
  private shadowHostId: string = 'mcp-shadow';
  private isInjected: boolean = false;
  private vueContainer: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private appInstance: any | null = null;

  // 自定义事件
  private unloadMCPEvent: CustomEvent;
  private loadMCPEvent: CustomEvent;

  constructor() {
    // 初始化自定义事件
    this.unloadMCPEvent = new CustomEvent('unload-mcp', {
      detail: { message: 'Unload MCP Plugin' },
      bubbles: true,
      cancelable: true
    });

    this.loadMCPEvent = new CustomEvent('load-mcp', {
      detail: { message: 'Load MCP Plugin' },
      bubbles: true,
      cancelable: true
    });
  }

  /**
     * 获取卸载事件
     */
  getUnloadEvent(): CustomEvent {
    return this.unloadMCPEvent;
  }

  /**
     * 获取加载事件
     */
  getLoadEvent(): CustomEvent {
    return this.loadMCPEvent;
  }

  /**
     * 注入MCP插件到页面
     */
  async inject(options?: MCPOptions): Promise<void> {
    try {
      // 只有在主页面才注入
      if (window.self !== window.top) {
        maLogger.log('不是主页面，不注入MCP插件');
        return;
      }

      // 确保DOM准备好
      if (!document.body) {
        await new Promise(resolve => {
          const checkBody = () => {
            if (document.body) {
              resolve(null);
            } else {
              requestAnimationFrame(checkBody);
            }
          };
          checkBody();
        });
      }

      maLogger.log('开始注入MCP插件');

      // 如果已经注入，则不重复注入
      if (this.isInjected && this.appInstance && this.vueContainer && this.shadowRoot && $id(this.shadowHostId)) {
        return;
      }

      if (!this.shadowRoot) {
        // maLogger.log("创建Shadow DOM");
        const { shadowRoot } = createShadowHost(this.shadowHostId, 'open');
        this.shadowRoot = shadowRoot;
      }

      const { visible = true } = options || {};

      this.isInjected = true;

      // 延迟初始化Vue应用，确保DOM已准备好
      if (!this.vueContainer && !this.shadowRoot?.getElementById('shadow-app-mcp')) {
        this.vueContainer = addElementToDom({
          tag: 'div',
          attrs: {
            id: 'shadow-app-mcp'
          },
          style: 'position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; z-index: 999999;'
        })(this.shadowRoot as ShadowRoot);
      }
      // 设置事件监听器
      this.setupEventListeners();

      if (this.appInstance) {
        this.appInstance.unmount();
        this.appInstance = null;
      }
      // 创建并挂载Vue应用
      this.appInstance = createApp(MCPDialog, {
        visible: visible
      });

      this.appInstance.use(pinia);
      this.appInstance.mount(this.vueContainer);

    } catch (error) {
      maLogger.error('注入MCP插件失败:', error);
    }
  }

  /**
     * 设置事件监听器
     */
  private setupEventListeners(): void {
    if (!this.vueContainer) {return;}

    // 监听显示/隐藏事件
    window.addEventListener('unload-mcp', () => {
      if (this.vueContainer) {
        this.vueContainer.style.display = 'none';
      }
    });

    window.addEventListener('load-mcp', () => {
      if (this.vueContainer) {
        this.vueContainer.style.display = 'block';
      }
    });
  }

  /**
     * 启用MCP插件
     */
  async enable(): Promise<void> {
    try {
      // 如果未注入，则先注入
      if (!this.isInjected || !$id(this.shadowHostId)) {
        await this.inject({ visible: true });
      } else {
        window.dispatchEvent(this.loadMCPEvent);
      }

    } catch (error) {
      maLogger.error('启用MCP插件失败:', error);
    }
  }

  /**
     * 禁用MCP插件
     */
  disable(): void {
    try {
      // 触发卸载事件
      window.dispatchEvent(this.unloadMCPEvent);

      // 直接操作DOM，确保组件被隐藏
      if (this.vueContainer) {
        this.vueContainer.style.display = 'none';
        maLogger.info('MCP插件已直接隐藏');
      }
    } catch (error) {
      maLogger.error('禁用MCP插件失败:', error);
    }
  }

  /**
     * 初始化MCP插件
     */
  async init(): Promise<void> {
    try {
      // 初始化为可见状态
      this.enable();
      this.setupEventListeners();
    } catch (error) {
      maLogger.error('初始化MCP插件失败:', error);
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

// 导出接口
export interface MCPOptions {
    visible?: boolean
}

// 导出默认函数，兼容ESMModuleLoader
export default (context: AppContext, options?: any): AppModule => {
  const appInstance = new MCP();
  appInstance.init();
  return appInstance;
};