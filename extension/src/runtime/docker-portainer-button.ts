/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/web-components/docker-portainer-button.ts
 * @date 2026-03-12
 * @description Docker Portainer 替换按钮自定义元素 - 可爱粉色风格喵~
 */

(function () {
  class DockerPortainerButton extends HTMLElement {
    /**
     * 定义组件观察的属性
     */
    static get observedAttributes() {
      return ['editor-selector'];
    }

    /**
     * 保存 cmContent 引用
     */
    private cmContent: HTMLElement | null = null;

    /**
     * 构造函数
     */
    constructor() {
      super();
      // 开启 Shadow DOM
      this.attachShadow({ mode: 'open' });
    }

    /**
     * 属性变化时调用
     */
    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
      // 目前不需要处理属性变化
    }

    /**
     * 组件挂载到 DOM 时调用
     */
    connectedCallback() {
      console.log('DockerPortainerButton 已挂载到 DOM');
      this.render();
      this.bindEvents();
    }

    /**
     * 组件从 DOM 移除时调用
     */
    disconnectedCallback() {
      console.log('DockerPortainerButton 已从 DOM 移除');
      this.unbindEvents();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
      const button = this.shadowRoot?.querySelector('.docker-portainer-btn');
      if (button) {
        button.addEventListener('click', this.handleClick.bind(this));
      }
    }

    /**
     * 解绑事件监听器
     */
    unbindEvents() {
      const button = this.shadowRoot?.querySelector('.docker-portainer-btn');
      if (button) {
        button.removeEventListener('click', this.handleClick.bind(this));
      }
    }

    /**
     * 显示可爱的提示消息
     */
    showToast(message: string, type: 'success' | 'warning' = 'success') {
      if (!this.shadowRoot) {return;}

      // 移除已存在的 toast
      const existingToast = this.shadowRoot.querySelector('.toast-message');
      if (existingToast) {
        existingToast.remove();
      }

      const toast = document.createElement('div');
      Object.assign(toast.style, {
        position: 'fixed',
        zIndex: '10000',
        top: 'auto'
      });
      toast.className = `toast-message toast-${type}`;
      toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✨' : '🌸'}</span>
        <span class="toast-text">${message}</span>
      `;

      this.shadowRoot.appendChild(toast);

      // 自动消失动画
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
      });

      // 3秒后自动消失
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -20px)';

        // 监听动画结束事件，精确移除元素（替代 setTimeout）
        const handleTransitionEnd = () => {
          if (toast.parentNode === this.shadowRoot) {
            toast.remove();
          }
          toast.removeEventListener('transitionend', handleTransitionEnd);
        };
        toast.addEventListener('transitionend', handleTransitionEnd);
      }, 3000);
    }

    /**
     * 创建弹窗
     */
    createModal() {
      // 移除已存在的弹窗
      const existingModal = this.shadowRoot?.getElementById('docker-portainer-modal');
      if (existingModal) {
        existingModal.remove();
      }

      const modal = document.createElement('div');
      modal.id = 'docker-portainer-modal';
      modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-icon">🌸</span>
                    <h2 class="modal-title">文本替换工具喵~</h2>
                </div>
                
                <div class="form-group">
                    <label class="form-label">
                        🎀 旧文本喵：
                    </label>
                    <input type="text" id="docker-portainer-old-text" placeholder="要替换的文本喵~" class="form-input">
                </div>
                
                <div class="form-group">
                    <label class="form-label">
                        💕 新文本喵：
                    </label>
                    <input type="text" id="docker-portainer-new-text" placeholder="替换后的文本喵~" class="form-input">
                </div>
                
                <div class="modal-buttons">
                    <button id="docker-portainer-replace-btn" class="btn btn-primary">
                        ✨ 替换喵
                    </button>
                    <button id="docker-portainer-cancel-btn" class="btn btn-secondary">
                        💤 取消喵
                    </button>
                </div>
            </div>
        </div>
      `;

      this.shadowRoot?.appendChild(modal);

      // 绑定事件
      const replaceBtn = modal.querySelector('#docker-portainer-replace-btn');
      const cancelBtn = modal.querySelector('#docker-portainer-cancel-btn');
      const oldTextInput = modal.querySelector('#docker-portainer-old-text') as HTMLInputElement;
      const newTextInput = modal.querySelector('#docker-portainer-new-text') as HTMLInputElement;
      const modalOverlay = modal.querySelector('.modal-overlay');

      // 替换按钮点击
      replaceBtn?.addEventListener('click', () => {
        const oldText = oldTextInput?.value;
        const newText = newTextInput?.value;

        if (oldText.trim() === '' || newText.trim() === '') {
          this.showToast('🌸 请输入要替换的文本喵！', 'warning');
          return;
        }

        // 执行文本替换
        if (this.cmContent) {
          this.cmContent.innerText = this.cmContent.innerText.replaceAll(oldText, newText || '');
          this.showToast('✨ 替换成功喵！✨', 'success');

          // 延迟关闭弹窗，让用户看到提示
          // setTimeout(() => {
          //   modal.remove();
          // }, 1500);
        }
      });

      // 取消按钮点击
      cancelBtn?.addEventListener('click', () => {
        modal.remove();
      });

      // 点击背景关闭
      modalOverlay?.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          modal.remove();
        }
      });

      // 聚焦到旧文本输入框
      oldTextInput?.focus();
    }

    /**
     * 处理按钮点击事件
     */
    handleClick() {
      console.log('🌸 按钮被点击了！');

      const editorSelector = this.getAttribute('editor-selector');

      let cmContent: Element | null = null;

      if (editorSelector) {
        const editorElement = this.closest(editorSelector);
        if (editorElement) {
          cmContent = editorElement.querySelector('.cm-content');
        }
      } else {
        cmContent = this.closest('.app-react-components-CodeEditor-CodeEditor-module__root.app-react-components-CodeEditor-CodeEditor-module__codeEditor')?.querySelector('.cm-content')!;
      }

      console.log('🌸 找到 cmContent:', cmContent);

      if (cmContent) {
        this.cmContent = cmContent as HTMLElement;
        this.createModal();
      } else {
        alert('😿 没有找到代码编辑器内容喵！');
      }
    }

    /**
     * 渲染组件
     */
    render() {
      if (!this.shadowRoot) {return;}

      this.shadowRoot.innerHTML = `
        <style>
          /* 按钮样式 */
          .docker-portainer-btn {
            background: linear-gradient(135deg, #ff69b4 0%, #ff1493 100%);
            color: white;
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(255, 105, 180, 0.4);
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
          }
          
          .docker-portainer-btn:hover {
            transform: scale(1.15);
            box-shadow: 0 6px 16px rgba(255, 105, 180, 0.5);
          }

          /* 弹窗样式 */
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 182, 193, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: 'Comic Sans MS', cursive, sans-serif;
          }
          
          .modal-content {
            position: relative;
            background: linear-gradient(135deg, #fff0f5 0%, #ffb6c1 100%);
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 12px 40px rgba(255, 105, 180, 0.4);
            border: 3px solid #ff69b4;
            max-width: 480px;
            width: 90%;
          }
          
          .modal-header {
            text-align: center;
            margin-bottom: 24px;
          }
          
          .modal-icon {
            font-size: 32px;
          }
          
          .modal-title {
            color: #ff1493;
            margin: 12px 0 0 0;
            font-size: 24px;
          }
          
          .form-group {
            margin-bottom: 20px;
          }
          
          .form-group:last-of-type {
            margin-bottom: 24px;
          }
          
          .form-label {
            display: block;
            color: #c71585;
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 16px;
          }
          
          .form-input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #ffb6c1;
            border-radius: 12px;
            font-size: 14px;
            box-sizing: border-box;
            background: #fff;
            color: #c71585;
            outline: none;
            transition: all 0.3s;
          }
          
          .form-input:focus {
            border-color: #ff69b4;
            box-shadow: 0 0 0 3px rgba(255, 105, 180, 0.2);
          }
          
          .modal-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
          }
          
          .btn {
            padding: 12px 32px;
            border-radius: 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            border: none;
          }
          
          .btn-primary {
            background: linear-gradient(135deg, #ff69b4 0%, #ff1493 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(255, 105, 180, 0.4);
          }
          
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 105, 180, 0.5);
          }
          
          .btn-secondary {
            background: linear-gradient(135deg, #fff 0%, #ffe4e1 100%);
            color: #ff69b4;
            border: 2px solid #ff69b4;
          }
          
          .btn-secondary:hover {
            background: linear-gradient(135deg, #ffe4e1 0%, #ffb6c1 100%);
          }

          /* Toast 提示样式 */
          .toast-message {
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translate(-50%, -20px);
            opacity: 0;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 8px 24px rgba(255, 105, 180, 0.4);
            z-index: 1000;
            transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            animation: bounce-in 0.5s ease-out;
          }

          @keyframes bounce-in {
            0% {
              transform: translate(-50%, -20px) scale(0.5);
              opacity: 0;
            }
            50% {
              transform: translate(-50%, 0) scale(1.1);
            }
            100% {
              transform: translate(-50%, 0) scale(1);
              opacity: 1;
            }
          }

          .toast-success {
            background: linear-gradient(135deg, #98fb98 0%, #90ee90 100%);
            color: #228b22;
            border: 2px solid #32cd32;
          }

          .toast-warning {
            background: linear-gradient(135deg, #fffacd 0%, #ffd700 100%);
            color: #b8860b;
            border: 2px solid #ffa500;
          }

          .toast-icon {
            font-size: 24px;
            animation: wiggle 0.6s ease-in-out;
          }

          @keyframes wiggle {
            0%, 100% {
              transform: rotate(0deg);
            }
            25% {
              transform: rotate(-10deg);
            }
            50% {
              transform: rotate(10deg);
            }
            75% {
              transform: rotate(-10deg);
            }
          }

          .toast-text {
            font-family: 'Comic Sans MS', cursive, sans-serif;
          }
        </style>
        <button class="docker-portainer-btn" type="button">🌸</button>
      `;
    }
  };

  // 注册 Web Component
  console.log('准备注册 DockerPortainerButton 组件');
  if (customElements.get('docker-portainer-button')) {
    console.log('组件已存在');
  } else {
    customElements.define('docker-portainer-button', DockerPortainerButton);
    console.log('DockerPortainerButton 组件注册成功');
  }
}());
