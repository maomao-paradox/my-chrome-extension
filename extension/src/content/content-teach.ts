/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-teach.ts
 * @date 2026-02-05T02:38:01.694Z
 */

import { waitForSelector, getElementAbsolutePosition, createEl, PositionStrategy } from '@/utils/element-control';
import { createApp } from 'vue';
import { Requester, get_token } from '@/services/api/mria-api';
import type { Response, ExtMessage, MessageHandler, Tool } from '@/types';
import { QuickLogin } from '@components/index';
import { storage } from '@/stores';
import { whenDomReady } from '@/utils/element-control';
import messenger from '@/message';


export const tools: Tool[] = [];

export default (ctx: AppContext, config = {}) => {

  const roles = Array.from(['医生', '助理医生', '物理师', '定位技师', '治疗技师', '主任医生', '物理主任', '护士'])
    , checkVaild = (value: { string: any }) => value && typeof value === 'object' && Object.keys(value).length > 0
    , _ADMIN = 'admin';

  const handleRequest = (_R: Function, ...args: any) => {
      maLogger.log(_R.name, ...args);
      return new Promise((resolve, reject) => {
        if (!_R || typeof _R !== 'function') {
          reject(new Error(`api[${_R}] not found in serverApi`));
        }
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          _R.name === 'userLogin' || ctx.requester.access_token || ctx.requester.restruct();
          const res = _R.apply(ctx.requester, args);
          resolve(res);
        }
      });
    }
    , handleResponse = (res: Response<any>, condition?: boolean) => {
      maLogger.log(res, condition);
      const timeout = 2000
        , msg = res.msg || res.message || res;
      if ((res.code && res.code === 1e4) || condition) {
        return msg && ctx.message.success(msg as string, timeout)
        , res.data || res;
      } else {
        ctx.message.error(msg as string, timeout);
        throw new Error(msg as string);
      }
    }
    , parasitism = () => {
      function enrichQuickLogin(byElement: HTMLElement, position: {
				position: PositionStrategy | undefined,
				offset: { x?: number, y?: number }
			}): void {
        if (!byElement) {return;}

        // 创建Shadow DOM
        const shadowRoot = ctx.gmod('__SHADOW_DOM');
        if (!shadowRoot) {
          maLogger.error('Shadow DOM 不存在');
          return;
        }

        // 获取元素绝对位置
        const positionInfo = getElementAbsolutePosition(byElement);

        // 创建登录组件容器
        const loginContainer = createEl({
          tag: 'div',
          style: 'width: 180px; height: 20px; ',
          attrs: {
            className: 'quick-login-shadow-container'
          }
        });

        // 将容器添加到Shadow DOM
        shadowRoot.appendChild(loginContainer);

        const app = createApp(QuickLogin, {
          userList: {
            ['mp' + _ADMIN]: { realname: '超级管理员', password: _ADMIN + '123', enabled: !0, role: '管理员' },
            //@ts-ignore
            'PinDuoDuo': { realname: '拼多多', password: '123456', enabled: !0, role: '学生' },
            'app': { realname: '逃课的学生', password: '123456', enabled: !0, role: '学生' }
          }
        });

        app.mount(loginContainer);

        // 使用新的定位方法定位登录组件
        positionInfo.positionElement({
          targetElement: loginContainer,
          strategy: position.position,
          containment: 'inside',
          pinned: true,
          observeReference: true
        });
      }
      // 等待登录表单出现，并在表单内部添加快速登录组件
      location.hash.match('#/login') && waitForSelector({
        selector: '#app > div > div > div.login-form-container > form > div.login-form-title',
        callback: enrichQuickLogin,  // injectVueComponent返回的函数
        callbackArgs: [{ position: 'right' }],
        maxWaitTimes: 10,  // 最多尝试10次查找
        timeout: 5000  // 5秒超时时间
      });

      // 直接固定在页面右上角
      waitForSelector({
        selector: '#app',
        callback: enrichQuickLogin,  // 统一使用新的参数名
        callbackArgs: [{ position: 'top-right' }],
        maxWaitTimes: 10
      });
    }
    , sendRequestToBack = async (requests: any, handleResponse: (response: any) => void) => {
      chrome.runtime.sendMessage(requests, response =>
        chrome.runtime.lastError ? maLogger.log(chrome.runtime.lastError.message) :
          handleResponse ? handleResponse(response) : maLogger.log('Received response from background:', response));
    }

    // 模拟登录API函数，调用指定的登录地址
    , userLogin = async (username: string, password: string) => {
      const response = await fetch('/baseapi/auth/study_center/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account_no: username,
          password,
          hospital_code: 'HOSPITSDZL0018465465',
          action_client_code: 'PC'
        })
      });
      return await response.json();
    }
    , userLogout = async () => {
      const userInfo = storage.page.local.get('user-store')['userInfo'];
      if (!userInfo) {
        maLogger.warn('当前不存在登录状态，直接登录');
        return;
      }
      maLogger.log(userInfo);
      userInfo['action_user_code'] = userInfo['user_code'];
      userInfo['action_client_code'] = 'PC';
      userInfo['user_id'] = userInfo['user_code'];
      userInfo['role_code'] = userInfo['user_role_codes'][0];
      // 模拟登出API
      const response = await fetch('/baseapi/auth/study_center/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userInfo)
      });
      return await response.json();
    };

  // 命令处理器对象，将每个action的处理逻辑提取为单独的方法
  const messageHandlers: MessageHandler = {
    quickLogin: async (data: any) => {
      const { username, password } = data;
      if (!username || !password) {
        ctx.message.error('用户名或密码不能为空');
        return;
      }
      try {
        await handleRequest(userLogout);
        const userInfo = await handleRequest(userLogin, username, password).then((res) => handleResponse(res as Response<any>));
        userInfo['action_user_name'] = userInfo['realname'];
        userInfo['hospital_code'] = 'HOSPITSDZL0018465465';
        storage.page.local.set('user-store', JSON.stringify({ userInfo }));
        document.cookie = 'Manteia-token=' + userInfo['access_token'];
        ctx.requester.restruct();
        location.reload();
      } catch (err) {
        maLogger.error(err);
      }
    }
  };
  // 初始化消息监听器
  const initMessageListener = () => {
    ctx.requester = ctx.requester ?? new Requester();
    messenger.ext.listen((message: ExtMessage, sender, sendResponse: Function) => {
      const { type, payload: data, target } = message;
      maLogger.log('Received request: ', type, data, 'from', sender.tab ? `tab ${sender.tab.id}` : 'background');
      // type
      if (!type || target !== 'content') {return false;}

      const steps = [type];
      let step = steps.shift();
      if (!ctx.requester) {get_token() ? ctx.requester = new Requester() : maLogger.warn('当前内容页不支持Requester实例化');}

      // 处理所有步骤
      while (step) {
        // 查找对应的处理器
        const handler = messageHandlers[step as keyof typeof messageHandlers];
        if (handler) {
          // 执行处理器
          handler(data);
        } else {
          // 处理默认情况
          // maLogger.log(`Received request: `, type, data, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
          return true;
        }
        step = steps.shift();
      }
    });
  };

  const initPageConfig = (pageContext: any) => {
    // 初始化加载配置
    const initConfigKey = ['userInfo'];
    initConfigKey.forEach(async (k) => {
      const config = await storage.ext.local.get(k, {});
      checkVaild(config) && (pageContext[k] = config);
      switch (k) {
        case 'userInfo':
          // 业务代码		
          maLogger.info('初始化默认登录用户', roles);
          var userConfig: Record<string, any> = {};
          if (roles.length > 0) {
            for (const role of roles) {
              const realname = role + 'A';
              messenger.ext.send({ type: 'getPinyin', payload: realname, target: 'background' })
                .then((response: any) => {
                  if (response.success) {
                    userConfig[response.payload] = { 'realname': realname, 'enabled': !0, 'role': role, 'password': '123456' };
                  }
                });
            };
            pageContext[k] = userConfig;
          };
          break;
      }
      storage.page.local.set(k, pageContext[k] || {});
    });
  };
  const updateSidebar = async (tools: Tool[]) => {
    // 侧边栏配置
    try {
      // 只在主页面更新侧边栏，避免iframe中重复创建
      if (ctx.self === ctx.top) {
        const sideBarInstance = ctx.gmod('__MODULE_SIDEBAR');
        maLogger.info('当前sidebar实例:', sideBarInstance);

        // 如果sidebar实例不存在，尝试获取sidebar模块并加载
        if (!sideBarInstance) {
          // 发送消息给content/index.ts，请求加载sidebar并更新工具
          messenger.ext.send({
            type: 'UPDATE_SIDEBAR_TOOLS',
            payload: { tools },
            target: 'content'
          });
        } else {
          // 如果sidebar实例存在，直接调用updateTools
          sideBarInstance.updateTools(tools);
        }
      }
    } catch (error: any) {
      maLogger.error('发送侧边栏工具更新请求失败:', error.message);
    }
  };

  whenDomReady(() => {
    // 注入XHR补丁
    // injectXhrPatch(xhrRules['mria']);
    // 初始化寄生式注入
    parasitism();
    // 初始化侧边栏
    updateSidebar(tools);
  });
  // 初始化消息监听器
  initMessageListener();
  // 初始化页面配置
  initPageConfig(ctx);

  return {
    // 返回可调用的公共API
    createTestUser: messageHandlers.createTestUser
  };
};