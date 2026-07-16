! function () {
  let formRightElement = document.querySelector('#app > div > div.form-area > div.form-right')
    , vueInstance = formRightElement.children[0].__vue__
    , formData = {
      ...vueInstance.form
    }
    , hasChangedCode = !1;
  const originalCode = formData.code
    , getElementById = (id) => document.getElementById(id)
    , createElement = (tag, attrs, children) => {
      const element = document.createElement(tag);
      if (typeof attrs === 'object' && Object.keys(attrs).length > 0) {
        for (const key in attrs) {
          if (attrs.hasOwnProperty(key)) {
            if (typeof attrs[key] === 'object') {
              for (const subKey in attrs[key]) {
                if (attrs[key].hasOwnProperty(subKey)) {
                  element[key][subKey] = attrs[key][subKey];
                }
              }
            } else {
              element[key] = attrs[key];
            }
          }
        }
        if (Array.isArray(children) && children.length > 0) {
          for (const child of children) {
            typeof child === 'string' ? element.appendChild(createElement('span', { innerText: child })) : element.appendChild(child);
          }
        }
        return element;
      }
    }
    , deepUpdateFormList = form => {
      const formList = document.querySelector('#app > div.form-design > div.form-area > div.form-main > form').__vue__.$parent.formList;

      for (let i = 0; i < formList.length; i++) {
        if (formList[i].code === originalCode) {
          formList[i] = form;
          return formList;
        }
        if (formList[i].children && formList[i].children.length > 0) {
          const childFormList = formList[i].children;
          for (let y = 0; y < childFormList.length; y++) {
            if (childFormList[y].code === originalCode) {
              childFormList[y] = form;
              return formList;
            }
          }
        }
      }
    }
    , handleSaveConfig = () => {
      // 如果组件code改了，需要使用deepUpdate来更新
      console.log(vueInstance, formData), hasChangedCode || (formData.code !== originalCode) ? deepUpdateFormList(formData) : vueInstance.$emit('change', formData);
    }
    , rightAttributePanel = createElement('div', {
      className: 'form-right',
      id: 'jsonDisplayContainer',
      style: 'width: 300px; border: 1px solid #e1e3e7; background-color: #fff; overflow-y: auto;'
    }, [createElement('button', {
      className: 'el-button el-button--default el-button--small el-button--primary',
      style: 'width: auto; height: 30px; margin: 10px;',
      innerText: '以文本格式编辑',
      onclick: function () {
        document.body.appendChild(createElement('div', {
          className: 'v-modal',
          id: 'v-shadow',
          tabindex: '0',
          style: 'z-index: 2002;'
        })), document.body.appendChild(jsonModal), getElementById('jsonText').value = JSON.stringify(formData, null, 2);
      }
    }), createElement('div', {
      style: 'font-size: 16px;margin: 15px;'
    }, [createElement('div', {
      id: 'jsonDisplay', style: 'margin-left:-20px'
    }), createElement('div', {
      style: 'width: 100%; text-align: center; margin-top: inherit;'
    }, [createElement('button', {
      className: 'el-button mt-button el-button--primary mt-button--primary',
      style: 'width: auto;height: 30px;',
      innerText: '保存配置',
      onclick: handleSaveConfig
    })])])])
    , renderFormConfig = (value, container) => {
      // 先清空容器
      // container.innerHTML = '';
      const parentDataset = container.dataset || container.parentNode.dataset;
      if (Object.keys(parentDataset).length === 0) {
        parentDataset.depth = 0, parentDataset.path = '';
      };
      // console.log(parentDataset)
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0) {
        // 解析json对象
        for (const key in value) {
          if (value.hasOwnProperty(key)) {
            const { depth, path } = parentDataset;
            const objDiv = createElement('div', {
                className: 'json-item',
                style: 'margin-left:20px;text-align:left;width:100%;',
                dataset: {
                  'depth': parseInt(depth) + 1,
                  'path': `${path}.${key}`
                }
              }, [
                createElement('label', {
                  className: 'el-form-item__label',
                  style: 'text-align:left;width:100%;',
                  innerText: key
                })
              ])
              , objVal = value[key];
            renderFormConfig(objVal, objDiv), container.appendChild(objDiv);
          }
        }
      } else if (Array.isArray(value) && value.length > 0) {
        // 解析列表
        value.forEach((item, index) => {
          let { depth, path } = parentDataset
            , arrDiv = createElement('div', {
              className: 'json-item',
              style: 'margin-left:20px;text-align:left;width:100%;',
              dataset: {
                'depth': parseInt(depth) + 1,
                'path': `${path}.${index}`
              }
            }, [
              createElement('label', {
                className: 'el-form-item__label',
                style: 'text-align:left;width:100%;',
                innerText: `[${index}]`
              })
            ]);
          renderFormConfig(item, arrDiv), container.appendChild(arrDiv);
        });
      } else if (typeof value === 'boolean') {

        // bool类型
        const checkboxInput = createElement('input', {
          type: 'checkbox',
          className: 'el-switch__input',
          name: '',
          checked: value,
          'true-value': 'true'
        }, []);

        // 创建左侧标签
        const leftLabel = createElement('span', {
          className: 'el-switch__label el-switch__label--left',
          'aria-hidden': 'true'
        }, ['false']);

        // 创建滑块核心
        const core = createElement('span', {
          className: 'el-switch__core',
          style: { width: '40px' }
        }, []);

        // 创建右侧标签
        const rightLabel = createElement('span', {
          className: 'el-switch__label el-switch__label--right'
        }, ['true']);

        value ? rightLabel.classList.add('is-active') : leftLabel.classList.add('is-active');

        const switchElement = createElement('div', {
          className: 'el-switch switch',
          role: 'switch',
          'aria-checked': value
        }, [leftLabel, checkboxInput, core, rightLabel]);
        value && switchElement.classList.add('is-checked');

        // 创建表单项目内容
        container.appendChild(createElement('div', {
          className: 'el-form-item__content'
        }, [switchElement]));
        // 添加点击事件监听器以切换开关状态
        switchElement.addEventListener('click', function (event) {
          this.classList.toggle('is-checked');
          const ariaChecked = this.getAttribute('aria-checked');
          this.setAttribute('aria-checked', !ariaChecked);
          rightLabel.classList.toggle('is-active');
          leftLabel.classList.toggle('is-active');

          if (this.classList.contains('is-checked')) {
            leftLabel.setAttribute('aria-hidden', 'true');
            rightLabel.removeAttribute('aria-hidden');
          } else {
            rightLabel.setAttribute('aria-hidden', 'true');
            leftLabel.removeAttribute('aria-hidden');
          }

          // 切换复选框状态
          checkboxInput.checked = !checkboxInput.checked;
          updateFormData(event);
        });
      } else {
        // 解析基本类型
        container.appendChild(createElement('input', {
          type: 'text',
          value: value,
          className: 'el-input__inner',
          onchange: updateFormData
        }));
      }
    }
    , updateFormData = event => {
      let targetElement = event.target || event.currentTarget
        , value = targetElement.type === 'checkbox' ? targetElement.checked : targetElement.value
        , paths = (targetElement.dataset.path || targetElement.parentNode.dataset.path || targetElement.parentNode.parentNode.dataset.path).split('.')
        , currentData = formData
        , firstPath = paths.shift()
        , lastKey = paths.pop();
      if (!firstPath) {
        while (paths.length) {
          currentData = currentData[paths.shift()];
        };
        // var lastKey = paths.shift();
        lastKey === 'code' ? (hasChangedCode = true) : currentData[lastKey] = value;

        console.log(currentData);
      }
    }
    , closeJsonModal = () => {
      getElementById('jsonModal').remove(), getElementById('v-shadow').remove();
    }
    , jsonModal = createElement('div', {
      id: 'jsonModal',
      className: 'el-dialog__wrapper',
      style: 'z-index: 2003;'
    }, [createElement('div', {
      className: 'el-dialog',
      role: 'dialog',
      'aria-modal': true,
      style: 'width: 800px; height: 600px; margin: 0 auto; padding: 0; border-radius: 4px; background-color: #fff;'
    }, [createElement('div', {
      className: 'el-dialog__header'
    }, [createElement('span', {
      className: 'el-dialog__title',
      textContent: '配置编辑器'
    }), createElement('button', {
      type: 'button',
      className: 'el-dialog__headerbtn',
      'aria-label': 'Close',
      style: 'margin-left: auto;',
      onclick: closeJsonModal
    }, [createElement('i', {
      className: 'el-dialog__close el-icon el-icon-close'
    })])]), createElement('div', {
      className: 'el-dialog__body',
      style: 'padding: 0;width:auto;height:450px;overflow-y: inherit;'
    }, [createElement('textarea', {
      id: 'jsonText',
      className: 'el-textarea__inner',
      style: 'width: 100%; height: 100%; border: none; resize: none; padding: 10px; font-size: 14px; line-height: 1.5;',
      value: JSON.stringify(formData, null, 2),
      onchange: function (e) {
        try {
          formData = JSON.parse(e.target.value.replace(/[\r\n]/g, ''));
        } catch (error) {
          alert(error);
        }
      }
    })]), createElement('div', {
      className: 'el-dialog__footer',
      style: 'text-align: center; padding: 10px;'
    }, [createElement('button', {
      className: 'el-button el-button--default el-button--small el-button--primary',
      style: 'width: auto;height: 30px;',
      innerText: '保存',
      onclick: function () {
        handleSaveConfig(), (jsonDisplayElement.innerHTML = ''), renderFormConfig(formData, jsonDisplayElement), closeJsonModal();
      }
    }), createElement('button', {
      className: 'el-button mt-button el-button--submain mt-button--submain',
      style: 'width: auto;height: 30px;',
      innerText: '取消',
      onclick: closeJsonModal
    })])])]);
  formRightElement.parentNode.appendChild(rightAttributePanel), console.log(formData);
  const jsonDisplayElement = getElementById('jsonDisplay');
  renderFormConfig(formData, jsonDisplayElement);
}();