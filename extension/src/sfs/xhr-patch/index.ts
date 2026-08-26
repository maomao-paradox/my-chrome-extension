/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/patch/xhr-patch/index.ts
 * @date 2026-02-05T02:38:01.696Z
 */

import { XhrRulesMap, XhrRule, XhrResponse, XHR_PATCH_CONFIG, RuleInstruction } from '@/types';


(function () {
  // 存储键名
  const STORAGE_KEY = 'XHR_RULES';
  const LOGIC_SWITCH_KEY = 'XHR_ENABLED';

  // 创建带分组的日志函数
  const createDebugMethod = (consoleMethod: 'log' | 'info' | 'warn' | 'error') => {
    return (...args: any[]) => {
      console.groupCollapsed('XHR-PATCH DEBUG:');
      console[consoleMethod](...args);
      console.groupEnd();
    };
  };

  const debug = {
    log: createDebugMethod('log'),
    info: createDebugMethod('info'),
    warn: createDebugMethod('warn'),
    error: createDebugMethod('error')
  };

  // 创建全局配置对象，用于动态管理和更新规则
  const xhrPatchConfig: XHR_PATCH_CONFIG = {
    rules: {},
    isPatched: false,
    isEnabled: false, // 默认禁用，除非从sidepanel中启用
    originalXHR: window.XMLHttpRequest,

    init: function () {
      // 从localStorage加载逻辑开关状态
      const isEnabledStr = localStorage.getItem(LOGIC_SWITCH_KEY);
      if (isEnabledStr === null) {
        console.info('首次加载，默认禁用XHR补丁');
        localStorage.setItem(LOGIC_SWITCH_KEY, 'false');
      } else {
        this.isEnabled = isEnabledStr !== 'false';
      }
      if (this.loadRulesFromStorage) {this.loadRulesFromStorage();}
    },

    // 从localStorage加载规则 - 适配JSON格式子规则
    loadRulesFromStorage: function () {
      try {
        // 尝试从localStorage加载规则作为备用
        const storedRulesStr = localStorage.getItem(STORAGE_KEY);
        if (storedRulesStr) {
          try {
            const storedRules = JSON.parse(storedRulesStr);
            if (storedRules && typeof storedRules === 'object') {
              this.rules = storedRules;

              // 只要有规则且启用了补丁就应用补丁（内容脚本已通过域名校验）
              if (this.isEnabled && !this.isPatched && Object.keys(this.rules).length > 0) {
                this.applyPatch();
              }
            }
          } catch (parseError) {
            // JSON解析失败，清除错误数据
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        // 静默失败，避免影响页面正常加载
        console.error('从localStorage加载规则失败:', error);
      }
    },

    // 切换启用状态
    toggleEnabled: function (enable: boolean) {
      localStorage.setItem(LOGIC_SWITCH_KEY, enable.toString());
      this.isEnabled = enable;
      if (enable && !this.isPatched && Object.keys(this.rules).length > 0) {
        this.applyPatch();
      } else if (!enable && this.isPatched) {
        this.resetPatch();
      } else {
        // 无需额外处理
      }

      return {
        isEnabled: this.isEnabled,
        isPatched: this.isPatched
      };
    },

    // 获取状态信息
    getStatus: function () {
      return {
        isEnabled: this.isEnabled,
        isPatched: this.isPatched
      };
    },

    // 保存规则到localStorage - 适配JSON格式子规则
    saveRulesToStorage: function () {
      try {
        // 直接保存规则，因为现在都是JSON格式，没有函数需要过滤
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rules));
      } catch (error) {
        // 静默失败，避免影响页面正常加载
        console.error('保存规则到localStorage失败:', error);
      }
    },

    // 更新规则的方法
    updateRules: function (newRules: Record<string, XhrRule>) {
      if (newRules && typeof newRules === 'object') {
        // 直接使用从内容脚本传来的已处理好的函数，并集
        this.rules = { ...this.rules, ...newRules };

        // 保存基本配置，函数部分通过消息通知内容脚本
        if (this.saveRulesToStorage) {this.saveRulesToStorage();}

        // 通知内容脚本更新规则，以便持久化保存函数部分
        try {
          window.postMessage({
            type: 'MRIA_XHR_UPDATE_RULES_FOR_PERSISTENCE',
            rules: this.rules
          }, '*');
        } catch (error) {
          console.error('通知内容脚本更新规则失败:', error);
        }

        // 只要启用了且有规则就应用补丁（内容脚本已通过域名校验）
        if (this.isEnabled && !this.isPatched && Object.keys(this.rules).length > 0) {
          this.applyPatch();
        }
      }
    },

    // 清除所有规则
    clearRules: function () {
      this.rules = {};

      // 保存到localStorage（清空规则）
      localStorage.removeItem(STORAGE_KEY);

      // 通知内容脚本清空规则
      try {
        window.postMessage({
          type: 'MRIA_XHR_CLEAR_RULES_FOR_PERSISTENCE'
        }, '*');
      } catch (error) {
        console.error('通知内容脚本清空规则失败:', error);
      }

      // 如果已应用补丁，重置它
      if (this.isPatched) {
        this.resetPatch();
      }
    },

    // 应用XHR补丁
    applyPatch: function () {
      if (!this.isEnabled) {
        console.log('[XHR Modifier] XHR patching is disabled, skipping');
        return;
      }

      if (this.isPatched) {
        console.log('[XHR Modifier] XHR already patched, skipping');
        return;
      }

      if (Object.keys(this.rules).length === 0) {
        console.log('[XHR Modifier] No rules to apply, skipping patch');
        return;
      }

      try {
        patchXHR(this.rules);
        this.isPatched = true;
        console.log('XHR补丁已应用，当前规则数:', Object.keys(this.rules).length);
      } catch (error) {
        console.error('应用XHR补丁失败:', error);
        this.isPatched = false;
      }
    },

    // 重置XHR补丁
    resetPatch: function () {
      if (!this.isPatched) {
        console.log('[XHR Modifier] XHR not patched, nothing to reset');
        return;
      }

      try {
        console.log('[XHR Modifier] Resetting XHR patch');
        // 恢复原始的XMLHttpRequest
        if (this.originalXHR) {
          window.XMLHttpRequest = this.originalXHR;
          this.isPatched = false;
          console.log('XHR补丁已重置');
        }
      } catch (error) {
        console.error('重置XHR补丁失败:', error);
      }
    },

    // 获取当前规则
    getCurrentRules: function () {
      return { ...this.rules }; // 返回规则的副本
    }
  };

    interface OPERATION_LIBRARY {
        setField: (data: any, params: { path: string; value: any }) => void;
        replaceUrl: (url: string, params: { path: string; value: any }) => string;
    }

    // 预定义操作函数库
    const operationLibs: OPERATION_LIBRARY = {
      // 设置字段值 - 支持数组索引格式 (如 data[0].property)
      setField: (data: any, params: { path: string; value: any }) => {
        const { path, value } = params;
        let current = data;

        // 解析路径，支持数组索引格式
        // 将路径分解为段，处理数组索引
        const pathSegments = path.match(/([^.\[\]]+)(?:\[(\d+)\])?/g) || [];

        for (let i = 0; i < pathSegments.length - 1; i++) {
          const segment = pathSegments[i];
          let key;
          let index;

          // 检查是否是数组索引格式
          const arrayMatch = segment.match(/([^\[\]]+)\[(\d+)\]/);

          if (arrayMatch) {
            key = arrayMatch[1];
            index = parseInt(arrayMatch[2], 10);

            // 确保父对象存在
            if (!current[key]) {
              current[key] = [];
            }

            // 确保数组索引有效
            if (!Array.isArray(current[key])) {
              console.warn(`[XHR Modifier] Expected ${key} to be an array but got ${typeof current[key]}`);
              return data;
            }

            // 确保索引位置有值
            if (current[key][index] === undefined) {
              current[key][index] = {};
            }

            current = current[key][index];
          } else {
            // 普通属性
            if (!current[segment]) {
              current[segment] = {};
            }
            current = current[segment];
          }
        }

        // 处理最后一段
        const lastSegment = pathSegments[pathSegments.length - 1];
        const arrayMatch = lastSegment.match(/([^\[\]]+)\[(\d+)\]/);

        if (arrayMatch) {
          const key = arrayMatch[1];
          const index = parseInt(arrayMatch[2], 10);

          // 确保父对象存在
          if (!current[key]) {
            current[key] = [];
          }

          // 确保数组索引有效
          if (!Array.isArray(current[key])) {
            console.warn(`[XHR Modifier] Expected ${key} to be an array but got ${typeof current[key]}`);
            return data;
          }

          current[key][index] = value;
        } else {
          // 普通属性
          current[lastSegment] = value;
        }

        console.log(`[XHR Modifier] Set field ${path} to ${value}`);

        return data;
      },

      // 替换URL
      replaceUrl: (data: any, params: { search?: string; value: string }) => {
        const { search, value } = params;
        if (typeof data.url === 'string') {
          if (!search) {
            data.url = value;
          } else {
            data.url = data.url.replace(search, value);
          }
        }
        return data;
      }

      // // 追加到数组
      // appendToArray: (data: any, params: { path: string; value: any }) => {
      //     const { path, value } = params;
      //     const keys = path.split('.');
      //     let current = data;

      //     for (let i = 0; i < keys.length; i++) {
      //         if (!current[keys[i]]) {
      //             current[keys[i]] = i === keys.length - 1 ? [] : {};
      //         }
      //         current = current[keys[i]];
      //     }

      //     if (Array.isArray(current)) {
      //         current.push(value);
      //     }
      //     return data;
      // },

      // // 修改数组元素
      // modifyArrayElement: (data: any, params: { path: string; index: number; value: any }) => {
      //     const { path, index, value } = params;
      //     const keys = path.split('.');
      //     let current = data;

      //     for (let i = 0; i < keys.length; i++) {
      //         if (!current[keys[i]]) {
      //             return data; // 路径不存在，直接返回原数据
      //         }
      //         current = current[keys[i]];
      //     }

      //     if (Array.isArray(current) && index >= 0 && index < current.length) {
      //         current[index] = value;
      //     }
      //     return data;
      // },

      // // 替换响应状态码
      // setStatus: (response: any, params: { status: number; statusText?: string }) => {
      //     response.status = params.status;
      //     if (params.statusText) {
      //         response.statusText = params.statusText;
      //     }
      //     return response;
      // },

      // // 完全替换响应数据
      // replaceResponse: (response: any, params: { data: any }) => {
      //     try {
      //         const dataStr = typeof params.data === 'string' ? params.data : JSON.stringify(params.data);
      //         response.response = params.data;
      //         response.responseText = dataStr;
      //     } catch (e) {
      //         console.error('[XHR Modifier] Error in replaceResponse:', e);
      //     }
      //     return response;
      // }
    };

    // 执行指令链
    function executeInstructions(data: any, instructions: RuleInstruction[]): any {
      if (!instructions || !Array.isArray(instructions)) {
        return data;
      }

      let result = data;

      for (const instruction of instructions) {
        const { type, params } = instruction;
        //@ts-ignore
        if (operationLibs[type]) {
          try {
            //@ts-ignore
            result = operationLibs[type](result, params);
          } catch (e) {
            console.error(`[XHR Modifier] Error executing instruction ${type}:`, e);
          }
        } else {
          console.warn(`[XHR Modifier] Unknown operation type: ${type}`);
        }
      }

      return result;
    }

    // 常用工具函数 
    const getApi = (url: string) => {
      // 安全获取URL路径部分，防止URL格式不正确时出现错误
      try {
        const match = url.match(/^https?:\/\/[^/]+(\/[^?#]*)/);
        return match && match[1] ? match[1] : '';
      } catch (e) {
        console.error('[XHR Modifier] Error parsing URL:', e);
        return '';
      }
    };

    // 修改响应数据
    const modifyResponse = (xhr: XMLHttpRequest, instructions: RuleInstruction[]) => {
      try {
        const { status, statusText, responseText, responseType, response, responseXML } = xhr;

        let newXhrResponse: XhrResponse = {
          status: status,
          statusText: statusText,
          responseText: responseText,
          responseType: responseType,
          response: response,
          responseXML: responseXML
        };

        // 尝试解析JSON响应
        if (responseType === 'json' || (responseType === '' && responseText && responseText.startsWith('{') && responseText.endsWith('}'))) {
          try {
            const oriResponse = JSON.parse(responseText);
            newXhrResponse.response = oriResponse;
            newXhrResponse = executeInstructions(newXhrResponse, instructions);
            // console.log(`[XHR Modifier] executeInstructions response:`, newXhrResponse);
            newXhrResponse.responseText = JSON.stringify(newXhrResponse.response);
          } catch (parseError) {
            // 如果解析失败，使用原始响应
            console.warn('[XHR Modifier] Failed to parse JSON response:', parseError);
          }
        }

        // 重写只读属性
        Object.defineProperties(xhr, {
          'responseText': {
            value: newXhrResponse.responseText,
            writable: false
          },
          'response': {
            value: newXhrResponse.response,
            writable: false
          },
          'status': {
            value: newXhrResponse.status,
            writable: false
          },
          'statusText': {
            value: newXhrResponse.statusText,
            writable: false
          }
        });

        console.log(`[XHR Modifier] Modified response for ${xhr.responseURL}: `, newXhrResponse);
      } catch (e) {
        console.error('[XHR Modifier] Error in modifyResponse:', e);
      }
    };

    // 补丁函数
    const patchXHR = (rules?: Record<string, XhrRule>) => {
      // 重写XMLHttpRequest构造函数
      const oldXHR = window.XMLHttpRequest;

      if ('modified' in oldXHR.prototype && oldXHR.prototype.modified) {
        return;
      }

      // 使用正确的类继承方式实现XMLHttpRequest
      class NewXHR extends oldXHR {
        constructor() {
          super();

          // 标记此实例已被修改
          Object.defineProperty(this, 'modified', {
            value: true,
            writable: false
          });

          let requestUrl: string;
          let api: string;

          // 保存原始方法引用
          const originalOpen = this.open;
          const originalSend = this.send;

          // 重写open方法以捕获请求URL
          this.open = function (
            method: string,
            url: string,
            async?: boolean,
            user?: string,
            password?: string
          ) {
            //@ts-ignore 获取最新的规则
            const currentRules: XhrRulesMap = window['XHR_PATCH_MANAGER'].getCurrentRules();

            let params = { method, url, async, user, password };
            requestUrl = url;

            // 检查是否有匹配的规则并执行open指令
            api = getApi(url);
            if (Object.prototype.hasOwnProperty.call(currentRules, api) &&
                        Array.isArray(currentRules[api].openRules)) {
              try {
                //@ts-ignore 执行open指令
                params = executeInstructions(params, currentRules[api].openRules);
                // 更新URL以确保后续处理使用正确的URL
                if (params.url) {
                  requestUrl = params.url;
                }
              } catch (e) {
                console.error(`[XHR Modifier] Error executing open instructions for ${api}:`, e);
              }
            }

            return originalOpen.call(
              this,
              params.method,
              params.url,
              params.async ?? true,
              params.user ?? null,
              params.password ?? null
            );
          };

          // 重写send方法
          this.send = function (body?: any) {
            //@ts-ignore 获取最新的规则
            const currentRules: XhrRulesMap = window['XHR_PATCH_MANAGER'].getCurrentRules();

            // 拦截并打印 cookie
            try {
              const requestHeaders = this.getResponseHeader('Set-Cookie');
              if (requestHeaders) {
                console.log('requestHeaders: ', requestHeaders);
              }
            } catch (e) {
              // 忽略错误
            }

            // 调用send指令（如果有）
            if (Object.prototype.hasOwnProperty.call(currentRules, api)) {
              if (Array.isArray(currentRules[api].sendRules)) {
                try {
                  // 尝试解析body为JSON（如果是字符串）
                  let parsedBody = body;
                  if (typeof body === 'string' && body.startsWith('{') && body.endsWith('}')) {
                    try {
                      parsedBody = JSON.parse(body);
                    } catch (parseError) {
                      // 如果解析失败，使用原始body
                      console.warn('[XHR Modifier] Failed to parse JSON body:', parseError);
                    }
                  }
                  //@ts-ignore 执行send指令
                  const modifiedBody = executeInstructions(parsedBody, currentRules[api].sendRules);

                  // 如果原始body是字符串且修改后是对象，需要重新字符串化
                  if (typeof body === 'string' && typeof modifiedBody === 'object') {
                    body = JSON.stringify(modifiedBody);
                  } else {
                    body = modifiedBody;
                  }
                } catch (e) {
                  console.error(`[XHR Modifier] Error executing send instructions for ${api}:`, e);
                }
              }
              if (Array.isArray(currentRules[api].responseRules)) {
                // 重写 onreadystatechange 方法
                try {
                  // 先保存原始的onreadystatechange处理程序
                  const originalOnReadyStateChange = this.onreadystatechange;
                  const self = this;
                  // 然后再赋值新的处理函数
                  this.onreadystatechange = function () {
                    if (this.readyState === 4) {
                      try {
                        //@ts-ignore 修改响应，使用当前最新的规则
                        const latestRules: XHR_PATCH_CONFIG = window['XHR_PATCH_MANAGER'].getCurrentRules();
                        //@ts-ignore
                        const latestApiRule: XhrRule = latestRules[api];
                        //@ts-ignore
                        modifyResponse(self, latestApiRule.responseRules);

                      } catch (e) {
                        console.error(`[XHR Modifier] Error modifying response for ${api}:`, e);
                      }
                    }

                    // 调用原始处理程序
                    if (originalOnReadyStateChange) {
                      //@ts-ignore
                      originalOnReadyStateChange.apply(this, arguments);
                    }
                  };
                } catch (e) {
                  console.error(`[XHR Modifier] Error executing interceptResponse instructions for ${api}:`, e);
                }
              }
            }

            // 传递可能修改后的body参数
            return originalSend.call(this, body);
          };
        }
      }

      // 复制静态属性
      for (const key in oldXHR) {
        if (oldXHR.hasOwnProperty(key) && typeof (oldXHR as any)[key] !== 'function') {
          (NewXHR as any)[key] = (oldXHR as any)[key];
        }
      }

      // 赋值给window.XMLHttpRequest
      window.XMLHttpRequest = NewXHR as any;
    };

    // 监听来自content script的消息
    window.addEventListener('message', (event: MessageEvent) => {
      // 确保消息来自我们的扩展
      if (event.source !== window) {return;}

      const { type, id, payload: data } = event.data;
      if (!(type && id)) {return;}

      try {
        const curXhrPatch: XHR_PATCH_CONFIG = (window as any).XHR_PATCH_MANAGER;
        if (!curXhrPatch) {
          console.log(' 全局配置对象未初始化');
          return;
        }
        // 处理不同类型的消息
        switch (type) {
          case 'MRIA_XHR_UPDATE_RULES':
            // 更新规则 - 批量
            console.log('从内容脚本接收更新的规则');
            if (data && typeof data === 'object') {
              curXhrPatch.updateRules(data || {});
              // 通知页面更新状态
              window.postMessage({ id, source: 'page' }, window.origin);
            }
            break;

          case 'TOGGLE_XHR_PATCH':
            // 切换XHR补丁状态
            try {
              if (typeof data.enable === 'boolean') {
                curXhrPatch.toggleEnabled(data.enable);
                console.log('XHR补丁状态已切换为:', data.enable);
                const status = curXhrPatch.getStatus();
                // 通知页面更新状态
                window.postMessage({ id, source: 'page', payload: { ...status } }, window.origin);
              }
            } catch (error) {
              console.error('切换XHR补丁状态失败:', error);
            }
            break;

          case 'MRIA_XHR_GET_STATUS':
            // 获取补丁状态并通过回调返回
            try {
              const status = curXhrPatch.getStatus();
              const rules = curXhrPatch.getCurrentRules();
              window.postMessage({ id, source: 'page', payload: { ...status, rules } }, window.origin);
            } catch (error) {
              console.error('获取并返回补丁状态失败:', error);
            }
            break;
        }
      } catch (error) {
        // 静默失败，避免影响页面正常加载
      }
    });

    function initXhrPatch(context: AppContext) {
      // 将配置对象挂载到window上
      // window["XHR_PATCH_MANAGER"] = xhrPatchConfig;
      Object.defineProperty(context, 'XHR_PATCH_MANAGER', {
        value: xhrPatchConfig
      });
      // 执行初始化
      xhrPatchConfig.init();
      // 如果没有规则，等待DOM加载完成后发送初始化消息
      if (Object.keys(xhrPatchConfig.rules).length === 0) {
        console.log('XHR补丁已就绪，请求规则');
        document.dispatchEvent(new CustomEvent('MRIA_XHR_PATCH_READY', {
          detail: {
            version: '1.0',
            message: 'XHR patch is ready to receive rules',
            flag: 0
          }
        }));
      }
      console.log('XHR补丁初始化完成');
    }
    //@ts-ignore
    initXhrPatch(window);
})();