import { storage } from '@/stores';
import type { ContentModuleManager } from './module-manager';
import type { PageTools } from './page-tools';
import { calculatePOW } from './pow-service';
import { applyWebpageMouseTrail } from './mouse-trail';
import { getAssetsAbstractPathSync } from '@/utils';

export type ContentMessageHandler = (
  data: any,
  sendResponse: (response: any) => void,
) => Promise<any> | any | void;

export type ContentMessageHandlers = Record<string, ContentMessageHandler>;

export const createMessageHandlers = (
  ctx: AppContext,
  moduleManager: ContentModuleManager,
  pageTools: PageTools
): ContentMessageHandlers => ({
  EXECUTE_SCRIPT: (data, sendResponse) => {
    maLogger.log('开始执行脚本：', data);
    try {
      const { code } = data;
      if (!code) {
        sendResponse({ error: 'No script code provided' });
        return false;
      }

      const result = new Function(code)();
      maLogger.log('脚本执行结果：', result);
      sendResponse({ result });
    } catch (error) {
      maLogger.error('脚本执行失败：', error);
      sendResponse({
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return false;
  },

  SCRIPT_INJECTION_SUCCESS: (data, sendResponse) => {
    maLogger.log('脚本注入成功：', data);
    ctx.message?.success?.('脚本注入成功');
    sendResponse({ success: true, message: '脚本注入成功' });
    return false;
  },

  SCRIPT_INJECTION_ERROR: (data, sendResponse) => {
    maLogger.error('脚本注入失败：', data);
    ctx.message?.error?.(`脚本注入失败：${data.error}`);
    sendResponse({
      success: false,
      message: '脚本注入失败',
      error: data.error
    });
    return false;
  },

  CONTEXTMENU_INIT: (_data, sendResponse) => {
    sendResponse({ flag: true });
    return false;
  },

  CONFIG_INIT: (_data, sendResponse) => {
    const configKey = 'globalConfig';
    storage.ext.local.get(configKey).then((result) => {
      try {
        sendResponse({
          msg: 'CONFIG_INIT success!',
          data: result[configKey] || {}
        });
      } catch (error: any) {
        maLogger.error('Error in CONFIG_INIT:', error);
        sendResponse({
          msg: `CONFIG_INIT failed:${error.message}`
        });
      }
    });
    return true;
  },

  CONFIG_UPDATE: (data) => {
    moduleManager.applyConfig(data);
    return true;
  },

  TOGGLE_MOUSE_TRAIL: (data, sendResponse) => {
    applyWebpageMouseTrail(data);
    sendResponse({
      success: true,
      msg: data?.enabled ? '鼠标拖尾已启用' : '鼠标拖尾已关闭'
    });
    return false;
  },

  BATCH_REPLACE_TEXT: (data, sendResponse) => {
    sendResponse(pageTools.batchReplaceText(data.oldText, data.newText));
    return false;
  },

  TOGGLE_CONTENT_EDITABLE: (data, sendResponse) => {
    sendResponse(pageTools.toggleContentEditable(data.enabled));
    return false;
  },

  UPDATE_SIDEBAR_TOOLS: async (data, sendResponse) => {
    const { tools } = data;
    try {
      maLogger.log('接收到侧边栏工具更新请求:', tools);
      const updated = await moduleManager.updateModuleTools('sidebar', tools);
      sendResponse(
        updated
          ? { success: true, msg: '侧边栏工具已更新' }
          : { success: false, msg: '侧边栏模块未正确加载或缺少更新方法' }
      );
    } catch (error) {
      maLogger.error('更新侧边栏工具失败:', error);
      sendResponse({
        success: false,
        msg: '更新侧边栏工具失败: ' + (error as Error).message
      });
    }
    return true;
  },

  UPDATE_TOOLBAR_TOOLS: async (data, sendResponse) => {
    const { tools } = data;
    try {
      maLogger.log('接收到文字工具更新请求:', tools);
      const updated = await moduleManager.updateModuleTools(
        'textSelectionToolbar',
        tools
      );
      sendResponse(
        updated
          ? { success: true, msg: '文字工具已更新' }
          : { success: false, msg: '文字工具模块未正确加载或缺少更新方法' }
      );
    } catch (error) {
      maLogger.error('更新文字工具失败:', error);
      sendResponse({
        success: false,
        msg: '更新文字工具失败: ' + (error as Error).message
      });
    }
    return true;
  },

  EXTRACT_LINKS: (_data, sendResponse) => {
    sendResponse(pageTools.extractLinks());
    return false;
  },

  CLEAR_STORAGE: (_data, sendResponse) => {
    sendResponse(pageTools.clearStorage());
    return false;
  },

  GET_LOCAL_STORAGE: (_data, sendResponse) => {
    sendResponse(pageTools.getLocalStorage());
    return false;
  },

  SET_LOCAL_STORAGE: (data, sendResponse) => {
    sendResponse(pageTools.setLocalStorage(data));
    return false;
  },

  GET_PAGE_SOURCE: (_data, sendResponse) => {
    sendResponse(pageTools.getPageSource());
    return false;
  },

  TAKE_SCREENSHOT: (_data, sendResponse) => {
    sendResponse(pageTools.takeScreenshot());
    return false;
  },

  GET_PAGE_VARIABLE: (data, sendResponse) => {
    const { varPath } = data;
    if (!varPath) {
      sendResponse({ success: false, msg: '请提供变量路径' });
      return true;
    }

    try {
      const result = pageTools.getPageVariable(varPath);
      sendResponse(
        result == null
          ? { success: false, msg: '获取页面变量失败: 未找到变量' }
          : { success: true, msg: '获取页面变量成功', data: result }
      );
    } catch (error: any) {
      sendResponse({ success: false, msg: error.message });
    }
    return true;
  },

  SET_PAGE_VARIABLE: (data, sendResponse) => {
    const { path, value } = data;
    if (!path) {
      sendResponse({ success: false, msg: '请提供变量路径' });
      return true;
    }

    pageTools.setPageVariable(path, value).then((result) => {
      sendResponse(result);
    });
    return true;
  },

  CALCULATE_POW: async (data, sendResponse) => {
    maLogger.log('=====计算 POW=====', data);
    maLogger.log('=====计算 POW=====', data);
    try {
      const { challenge } = data;
      if (!challenge) {
        sendResponse({ success: false, msg: '缺少 challenge 参数' });
        return true;
      }

      const powResponse = await calculatePOW(challenge);
      sendResponse({ success: true, powResponse });
    } catch (error) {
      maLogger.error('计算 POW 失败:', error);
      sendResponse({
        success: false,
        msg: '计算 POW 失败: ' + (error as Error).message
      });
    }
    return true;
  },

  POPUP_CAPTURE_HANDSHAKE: (_data, sendResponse) => {
    sendResponse({ success: true, msg: 'content script ready' });
    return false;
  },

  TRIGGER_COMPONENT_CAPTURE: async (_data, sendResponse) => {
    maLogger.log('=====触发组件捕获=====');
    try {
      const module = await moduleManager.getOrLoadModule('componentCapture');
      if (module && typeof module.triggerComponentCapture === 'function') {
        module.triggerComponentCapture();
        sendResponse({ success: true, msg: '组件捕获已启动' });
      } else {
        sendResponse({ success: false, msg: '模块未正确加载或缺少触发方法' });
      }
    } catch (error) {
      maLogger.error('触发组件捕获失败:', error);
      sendResponse({
        success: false,
        msg: '触发组件捕获失败: ' + (error as Error).message
      });
    }
    return true;
  },

  extractAccessibilityTree: async (_data, sendResponse) => {
    try {
      const utilsModule = await import(
        /* @vite-ignore */
        getAssetsAbstractPathSync('js/runtime/accessibility-utils')
      );
      const utils = utilsModule.default || utilsModule;

      const options = _data || {};
      const axTree = await utils.extractAccessibilityTree(
        document.body,
        options
      );
      const markdown = utils.axTreeToMarkdown(axTree);
      const stats = utils.getPageStats(axTree);

      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: document.title,
          axTree: axTree,
          markdown: markdown,
          stats: stats
        }
      });
    } catch (error: any) {
      maLogger.error('提取失败:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  },

  PING: async (_data, sendResponse) => {
    sendResponse({ status: 'ready' });
  }
});
