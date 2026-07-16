/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/web-component/ma-web-extension.ts
 * @date 2026-02-05T02:38:01.699Z
 * @description 自定义元素 ma-web-extension
 */

// 直接导入CSS文件内容，Vite会将其转换为字符串
//@ts-ignore
import shadowThemeCss from '@/assets/styles/shadow-theme.css?raw';
//@ts-ignore
import elementPlusCss from 'element-plus/dist/index.css?raw';
(function () {
  class MaWebExtension extends HTMLElement {
    private _shadowRoot: ShadowRoot | null = null;

    constructor() {
      super();

      // 创建 Shadow Root
      this.setShadowRoot(this.attachShadow({ mode: 'open' }));

      // 注入样式
      this.injectStyles(elementPlusCss, true);
      this.injectStyles(shadowThemeCss);

      // 设置默认样式
      Object.assign(this.style, {
        overflow: 'visible',
        position: 'absolute',
        top: '0px',
        left: '0px',
        display: 'block'
      });
    }

    /**
     * 获取 Shadow Root 实例
     * @returns {ShadowRoot} Shadow Root 实例
     */
    public getShadowRoot(): ShadowRoot | null {
      return this._shadowRoot;
    }

    /**
     * 设置 Shadow Root 实例
     * @returns void
     */
    private setShadowRoot(shadowRoot: ShadowRoot): void {
      this._shadowRoot = shadowRoot;
    }

    /**
     * 向 Shadow DOM 中注入内联样式
     * @param {string} styles - CSS 字符串
     * @param {boolean} replaceRootSelector - 是否将 :root 替换为 :host (默认: false)
     */
    private injectStyles(styles: string, replaceRootSelector: boolean = false): void {
      // 如果需要替换 :root 选择器为 :host
      if (replaceRootSelector) {
        styles = styles.replace(/:root/g, ':host');
      }

      const styleElement = document.createElement('style');
      styleElement.textContent = styles;
      this._shadowRoot?.appendChild(styleElement);
    }

    /**
     * 向 Shadow DOM 中注入外部样式文件
     * @param {string} href - 样式文件URL
     */
    public injectStyleLink(href: string): void {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      this._shadowRoot?.appendChild(link);
    }

    /**
     * 读取CSS文件并注入到Shadow DOM中
     * @param {string} cssUrl - CSS文件URL
     */
    public async injectCssDom(cssUrl: string): Promise<string> {
      try {
        const cssContent = await fetch(cssUrl).then(res => res.text());
        this.injectStyles(cssContent);
        return cssContent;
      } catch (error) {
        console.error('Error reading and injecting CSS:', error);
        throw error;
      }
    }
  }

  // 注册自定义元素
  if (!customElements.get('ma-web-extension')) {
    customElements.define('ma-web-extension', MaWebExtension);
    console.log('ma-web-extension custom element registered');
  }
}());