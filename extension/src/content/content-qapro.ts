/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-qapro.ts
 * @date 2026-02-05T02:38:01.694Z
 */

import { waitForSelector, addElementToDom, getElementAbsolutePosition, createEl, PositionStrategy } from '@/utils/element-control';
import { QuickLogin } from '@components/index';
import messenger from '@/message';
import { ExtMessage, MessageHandler } from '@/types';
import { storage } from '@/stores';
import { getQueryParams } from '@/utils/base';
import { injectXhrPatch } from '@/runtime/xhr-patch/xhr_message_handler';
import xhrRules from '@/runtime/xhr-patch/rules';
import { createApp } from 'vue';

const _ADMIN = 'admin';

function struct(ctx: AppContext, config = {}) {

  const userInfo = storage.page.local.get('Manteia-UserInfo');
  const { hospital_code, user_code: action_user_code, realname: action_user_name, access_token } = userInfo;

  const customPayload = {
    'action_client_code': 'PC',
    'hospital_code': hospital_code || 'HOSPITSDZL0018465465',
    'access_token': access_token,
    'action_user_code': action_user_code,
    'action_user_name': action_user_name
  };

  // 登录相关的API处理函数
  const handleRequest = (_R: Function, ...args: any) => {
      maLogger.log(_R.name, ...args);
      return new Promise((resolve, reject) => {
        if (!_R || typeof _R !== 'function') {
          reject(new Error(`api[${_R}] not found in serverApi`));
        }
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          // 直接调用API函数，使用fetch实现
          const res = _R.apply(null, args);
          resolve(res);
        }
      });
    }
    , handleResponse = (res: any, condition?: boolean) => {
      maLogger.log(res, condition);
      const timeout = 2000
        , msg = res.msg || res.message || res;
      if ((res.code && res.code === 1e4) || condition) {
        return msg && ctx.message.success(msg as string, { duration: timeout })
        , res.data || res;
      } else {
        ctx.message.error(msg as string, { duration: timeout });
        throw new Error(msg as string);
      }
    };

  const syncForm = async (): Promise<void> => {
    const formCode = getQueryParams()['form_code'];
    if (!formCode) {
      throw new Error('表单代码参数缺失');
    }

    // 获取表单的任务待办
    const taskResponse = await fetch('/api/qa-pro/info/query_by_form', {
      method: 'POST',
      body: JSON.stringify({
        ...customPayload,
        'form_code': formCode
      }),
      // qa的接口请求要在headers里面添加Access_token，Action_client_code，Action_user_code
      headers: {
        'Access_token': access_token,
        'Action_client_code': 'PC',
        'Action_user_code': action_user_code
      }
    }).then((res) => res.json());
    if (taskResponse.code !== 1e4) {
      throw new Error(taskResponse.msg || taskResponse.message || '获取任务待办失败');
    }
    const taskData = await taskResponse['detail'];

    const jobCodeList = taskData.map((item: any) => item.job_code);

    // 模拟同步表单API
    const response = await fetch('/api/qa-pro/info/sync_by_form', {
      method: 'POST',
      body: JSON.stringify({
        ...customPayload,
        'form_code': formCode,
        'job_code_list': jobCodeList
      }),
      headers: {
        'Access_token': access_token,
        'Action_client_code': 'PC',
        'Action_user_code': action_user_code
      }
    }).then((res) => res.json());
    ctx.message.success(response['msg']);
  };

  // 模拟登录API函数，调用指定的登录地址
  const userLogin = async (username: string, password: string) => {
    const response = await fetch('infoapi/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password,
        hospital_code: 'HOSPITSDZL0018465465',
        action_client_code: 'PC'
      })
    });
    return await response.json();
  };

  const userLogout = async () => {
    // 模拟登出API
    const response = await fetch('infoapi/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return await response.json();
  };

  // 命令处理器对象
  const messageHandlers: MessageHandler = {
    quickLogin: async (data: any) => {
      const { username, password } = data;
      if (!username || !password) {
        ctx.message.error('用户名或密码不能为空', { duration: 2000 });
        return;
      }
      try {
        await handleRequest(userLogout);
        const userInfo = await handleRequest(userLogin, username, password).then((res: any) => handleResponse(res));
        storage.page.local.set('Manteia-UserInfo', JSON.stringify(userInfo));
        document.cookie = 'Manteia-token=' + userInfo['access_token'];

        ctx.location.reload();
      } catch (err) {
        maLogger.error(err);
      }
    }
  };

  function initMessageListener() {
    messenger.ext.listen((message: ExtMessage, sender, sendResponse) => {
      const { type, payload: data, target } = message;

      maLogger.info('Received message: ', type, data, 'from', sender);

      if (!type || target !== 'content') {return false;}

      // 查找对应的处理器
      const handler = messageHandlers[type as keyof typeof messageHandlers];
      if (handler) {
        // 执行处理器
        handler(data);
      }
    });
  }

  function initQaproContent() {
    maLogger.info('QAPRO content script initialized');

    function enrichQuickLogin(byElement: HTMLElement, position: {
            position: PositionStrategy | undefined,
            offset: { x?: number, y?: number }
        }): void {
      // maLogger.log("已经找到了元素", byElement);
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
        style: 'width: 180px; height: 20px;',
        attrs: {
          className: 'quick-login-shadow-container'
        }
      });

      // 将容器添加到Shadow DOM
      shadowRoot.appendChild(loginContainer);

      const app = createApp(QuickLogin, {
        userList: {
          ['mp' + _ADMIN]: { realname: '超级管理员', password: _ADMIN + '123', enabled: !0, role: '管理员' },
          ['AAA']: { realname: 'AAA', password: '15555555551', enabled: !0, role: '质检组长' },
          ['BBB']: { realname: 'BBB', password: '15555555552', enabled: !0, role: '物理师' },
          ['CCC']: { realname: 'CCC', password: '15555555553', enabled: !0, role: '质检师' },
          ['DDD']: { realname: 'DDD', password: '15555555554', enabled: !0, role: '物理师' },
          ['pdd']: { realname: '胖墩墩', password: '15111111111', enabled: !0, role: '质检师' },
          ['ygg']: { realname: '圆滚滚', password: '15222222222', enabled: !0, role: '物理师' }
        }
      });

      app.mount(loginContainer);

      // 使用新的定位方法定位登录组件
      positionInfo.positionElement({
        targetElement: loginContainer,
        observeReference: true,
        pinned: true,
        ...position
      });
    }

    const injectSyncFormButton = (el: HTMLElement, position: string) => {
      // maLogger.log("已经找到了元素", el);
      addElementToDom({
        tag: el,
        attrs: {
          'className': 'el-button mt-button el-button--default mt-button--default',
          'innerHTML': '<span>同步待办</span>'
        },
        style: {
          'width': 'auto',
          'height': '30px',
          'color': 'red'
        },
        eventlistener: {
          click: syncForm
        }
      })(el.parentNode as HTMLElement, position);
    };

    waitForSelector({
      selector: '#app > div > form > div.title',
      callback: enrichQuickLogin,  // 统一使用新的参数名
      callbackArgs: [{ strategy: 'right', containment: 'inside' }],
      maxWaitTimes: 10
    });

    waitForSelector({
      selector: '#app > div > div.navbar > div.right-menu',
      callback: enrichQuickLogin,  // 统一使用新的参数名
      callbackArgs: [{ strategy: 'left', containment: 'outside' }],
      maxWaitTimes: 10
    });

    waitForSelector({
      selector: '#app > div > div.main-container > section > section > div > div > div.formTemp_wrap_top.clearfix > div > button.el-button.mt-button.el-button--primary.mt-button--primary',
      filter: (el: HTMLElement) => el.innerText === '完成编辑',
      once: !0,
      callback: injectSyncFormButton,
      callbackArgs: ['afterbegin']
    });

    initMessageListener();

    // 注入XHR补丁
    injectXhrPatch(xhrRules['qapro']);
  }

  // 初始化脚本
  initQaproContent();

  return {};
};

export { struct as default };