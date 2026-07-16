/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/patch/zentao-content-replace.ts
 * @date 2026-02-05T02:38:01.696Z
 */

(function () {
  class ZentaoContentReplace extends HTMLElement {
    /**
     * 定义组件观察的属性
     */
    // public _shadowRoot: ShadowRoot;
    public _oldText: string;
    static get observedAttributes() {
      return ['old-text'];
    }

    /**
     * 构造函数
     */
    constructor() {
      super();

      // 创建 Shadow DOM
      // this._shadowRoot = this.attachShadow({ mode: 'open' });

      // 初始化状态
      this._oldText = '';

      // 渲染组件
      // this.render();
    }

    /**
     * 属性变化时调用
     */
    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
      if (name === 'old-text' && oldValue !== newValue) {
        this._oldText = newValue;
        this.updateOldTextInput();
      }
    }

    /**
     * 组件挂载到 DOM 时调用
     */
    connectedCallback() {
      console.log('ZentaoContentReplace 已挂载到 DOM');
      this.render();
      this.bindEvents();
      this.updateOldTextInput();
    }

    /**
     * 组件从 DOM 移除时调用
     */
    disconnectedCallback() {
      console.log('ZentaoContentReplace 已从 DOM 移除');
      this.unbindEvents();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
      const confirmButton = this.querySelector('#wmx_confirm');
      if (confirmButton) {
        confirmButton.addEventListener('click', this.handleConfirm.bind(this));
      }
    }

    /**
     * 解绑事件监听器
     */
    unbindEvents() {
      const confirmButton = this.querySelector('#wmx_confirm');
      if (confirmButton) {
        confirmButton.removeEventListener('click', this.handleConfirm.bind(this));
      }
    }

    /**
     * 更新原文本输入框
     */
    updateOldTextInput() {
      const oldTextInput = this.querySelector<HTMLInputElement>('#wmx_old_text');
      if (oldTextInput && this._oldText) {
        oldTextInput.value = this._oldText;
      }
    }

    /**
     * 处理确定按钮点击
     */
    handleConfirm() {
      const oldTextInput = this.querySelector<HTMLInputElement>('#wmx_old_text');
      const newTextInput = this.querySelector<HTMLInputElement>('#wmx_new_text');

      if (!oldTextInput || !newTextInput) {
        console.error('输入框未找到');
        return;
      }

      const zentao_old_text = oldTextInput.value || '';
      const zentao_new_text = newTextInput.value || '';

      console.log(`批量替换：原文本='${zentao_old_text}', 替换为='${zentao_new_text}'`);

      // 查找 iframe
      const iframeElement = window.top ? (window.top.document.getElementById('appIframe-qa') || window.top.document.getElementById('appIframe')) : null;
      const iframeDom = iframeElement && (iframeElement as HTMLIFrameElement).contentWindow?.document;

      if (!iframeDom) {
        console.error('未找到 iframe 或其内容窗口不可用');
        return;
      }

      // 执行替换
      this.replaceTextInIframe(iframeDom, zentao_old_text, zentao_new_text);

      // 触发替换完成事件
      this.dispatchEvent(new CustomEvent('replace-complete', {
        bubbles: true,
        composed: true,
        detail: {
          oldText: zentao_old_text,
          newText: zentao_new_text
        }
      }));
    }

    /**
     * 在 iframe 中替换文本
     */
    replaceTextInIframe(iframeDom: Document, oldText: any, newText: any) {
      if (!oldText) {return;}

      const selectors = ['#title', '#precondition', '.form-control.autosize', 'textarea', 'input[type="text"]'];

      selectors.forEach(selector => {
        const elements = iframeDom.querySelectorAll<HTMLInputElement>(selector);
        console.log(`找到 ${elements.length} 个匹配元素: ${selector}`);

        elements.forEach(element => {
          if (element.value) {
            const oldValue = element.value;
            element.value = element.value.replaceAll(oldText, newText);
            // console.log(`替换输入框内容: ${oldValue} -> ${element.value}`);
          } else if (element.innerHTML) {
            const oldHTML = element.innerHTML;
            element.innerHTML = element.innerHTML.replaceAll(oldText, newText);
            // console.log(`替换元素内容: ${oldHTML.substring(0, 50)}... -> ${element.innerHTML.substring(0, 50)}...`);
          }
        });
      });
    }

    /**
     * 渲染组件
     */
    render() {
      // 加载模板文件
      this.innerHTML = `<div class="detail-title">批量替换</div>
    <table class="table table-form">
      <tbody>
        <tr>
          <th>查找</th>
          <td><input type="text" id="wmx_old_text" placeholder="请输入要替换的原文本" value="" class="form-control"
              autocomplete="off"></td>
        </tr>
        <tr>
          <th>替换</th>
          <td>
            <div class="input-group">
              <input type="text" id="wmx_new_text" placeholder="请输入替换后的文本" value="" class="form-control"
                autocomplete="off">
              <span class="input-group-btn">
                <button type="button" title="替换" class="btn btn-icon" id="wmx_confirm"
                  style="border-radius: 0px 2px 2px 0px; border-left-color: transparent;">
                  <i class="icon icon-refresh"></i>
                </button>
              </span>
              <style>
                #contactListMenu_chosen {
                  width: 100px !important;
                }

                #contactListMenu+.chosen-container {
                  min-width: 100px;
                }

                td>#mailto+.chosen-container .chosen-choices {
                  border-radius: 2px 2px 0 0;
                }

                td>#mailto+.chosen-container+#contactListMenu+.chosen-container>.chosen-single {
                  border-radius: 0 0 2px 2px;
                  border-top-width: 0;
                  padding-top: 6px;
                }

                #contactListMenu+.chosen-container.chosen-container-active>.chosen-single {
                  border-top-width: 1px !important;
                  padding-top: 5px !important;
                }
              </style>
            </div>
          </td>
        </tr>
      </tbody>
    </table>`;
    }
  };

  // 注册 Web Component
  console.log('准备注册ZentaoContentReplace组件');
  if (customElements.get('zentao-content-replace')) {
    console.log('组件已存在');
  } else {
    customElements.define('zentao-content-replace', ZentaoContentReplace);
    console.log('ZentaoContentReplace组件注册成功');
  }
  // const currentScript = document.currentScript;
  // // console.log("currentScript:", currentScript);
  // if (currentScript) {
  //   const el = document.createElement('zentao-content-replace');
  //   if (currentScript.parentElement?.classList.contains('cell')) {
  //     el.classList.add('detail');
  //   }
  //   Object.assign(el.style, {
  //     display: 'block',
  //     unicodeBidi: 'isolate',
  //     minWidth: '500px'
  //   });
  //   currentScript.parentElement?.insertAdjacentElement('afterbegin', el);
  // }
}());