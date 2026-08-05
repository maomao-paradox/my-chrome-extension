import type { BackgroundMessageHandler, Bookmark, ResponseMessage } from '@/types';
import type { DevToolsPortManager } from './devtools-port-manager';
import { openBookmark } from './bookmarks';
import { createTabAndWaitForLoad, sendRequestToActiveTab, type TabWaitUntil } from './chrome-tabs';
import { postJsonFromBackground } from './http';
import { fetchImageFromAPI } from './image-api';
import FileMapDecryptor from '@/utils/fileMapDecryptor';
import type { AutomationStep } from '@/types/automation';
import { attachToTab, detachFromTab, ensureAttachedTab, getPageSnapshot } from '../automation/tab-runtime';
import { runStep, runSteps } from '../automation/step-runner';
import { startRecorder, stopRecorder } from '../automation/recorder';

type SidePanelWithClose = typeof chrome.sidePanel & {
	close?: (options: { tabId?: number }) => Promise<void>;
};

let fileMap: Map<string, string> | null = null;
let fileMapLoadPromise: Promise<Map<string, string>> | null = null;

export const getFileMap = (): Map<string, string> | null => fileMap;

type ExtensionScriptWorld = 'ISOLATED' | 'MAIN';

interface CreateTabWithScriptPayload {
	url?: string;
	scriptPath?: string;
	scriptSrc?: string;
	path?: string;
	data?: {
		url?: string;
		scriptPath?: string;
		scriptSrc?: string;
		path?: string;
	};
	active?: boolean;
	allFrames?: boolean;
	world?: ExtensionScriptWorld;
	timeoutMs?: number;
	waitUntil?: TabWaitUntil;
}

interface NormalizedCreateTabWithScriptPayload {
	url: string;
	scriptPath: string;
	active: boolean;
	allFrames: boolean;
	world: ExtensionScriptWorld;
	timeoutMs: number;
	waitUntil: TabWaitUntil;
}

const DEFAULT_CREATE_TAB_TIMEOUT_MS = 30000;

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const FILE_MAP_KEY = viteEnv?.VITE_FILE_MAP_KEY || 'mria_extension_default_key_32bytes_1234567890abcdef';
const backgroundFileMapDecryptor = new FileMapDecryptor(FILE_MAP_KEY);
const RECORDED_STEPS_STORAGE_KEY = 'automationRecordedSteps';

const normalizeExtensionPath = (path: string): string => {
  return path
    .replace(/^chrome-extension:\/\/[^/]+\//, '')
    .replace(/^\//, '')
    .replace(/^dist\//, '');
};

const stripScriptExtension = (path: string): string => path.replace(/\.(?:m?js|ts)$/, '');

const createScriptPathCandidates = (scriptPath: string): string[] => {
  const normalizedPath = normalizeExtensionPath(scriptPath.trim());
  const withoutExtension = stripScriptExtension(normalizedPath);
  const withoutSourcePrefix = stripScriptExtension(normalizedPath.replace(/^src\//, ''));
  const candidates = [
    normalizedPath,
    withoutExtension,
    withoutSourcePrefix,
    withoutSourcePrefix.startsWith('js/') ? withoutSourcePrefix : `js/${withoutSourcePrefix}`
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
};

const ensureBackgroundFileMap = async (): Promise<Map<string, string>> => {
  if (fileMap) {
    return fileMap;
  }

  if (!fileMapLoadPromise) {
    fileMapLoadPromise = backgroundFileMapDecryptor.decryptAndLoad(chrome.runtime.getURL('file-map.json'))
      .then(map => {
        fileMap = new Map(Object.entries(map));
        console.log('background 懒加载 file_map 成功，条目数:', fileMap.size);
        return fileMap;
      })
      .finally(() => {
        fileMapLoadPromise = null;
      });
  }

  return fileMapLoadPromise;
};

const resolveScriptPath = async (scriptPath: string): Promise<string> => {
  const candidates = createScriptPathCandidates(scriptPath);

  try {
    const map = await ensureBackgroundFileMap();
    for (const candidate of candidates) {
      const mappedPath = map.get(candidate);
      if (mappedPath) {
        return mappedPath;
      }
    }
  } catch (error) {
    console.warn('解析 file_map 失败，尝试直接使用脚本路径:', error);
  }

  return candidates[0];
};

const isSupportedScriptWorld = (world: unknown): world is ExtensionScriptWorld => {
  return world === 'ISOLATED' || world === 'MAIN';
};

const isSupportedWaitUntil = (waitUntil: unknown): waitUntil is TabWaitUntil => {
  return waitUntil === 'loading' || waitUntil === 'complete';
};

const normalizeCreateTabWithScriptPayload = (payload: CreateTabWithScriptPayload | undefined): NormalizedCreateTabWithScriptPayload => {
  const data = payload?.data || {};
  const url = typeof payload?.url === 'string' ? payload.url.trim() : (data.url || '').trim();
  const scriptPath = typeof payload?.scriptPath === 'string'
    ? payload.scriptPath.trim()
    : typeof payload?.scriptSrc === 'string'
      ? payload.scriptSrc.trim()
      : typeof payload?.path === 'string'
        ? payload.path.trim()
        : typeof data.scriptPath === 'string'
          ? data.scriptPath.trim()
          : typeof data.scriptSrc === 'string'
            ? data.scriptSrc.trim()
            : typeof data.path === 'string'
              ? data.path.trim()
              : '';

  if (!url) {
    throw new Error('缺少 url 参数');
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error('url 仅支持 http 或 https 页面');
  }

  if (!scriptPath) {
    throw new Error('缺少 scriptPath 参数');
  }

  const timeoutMs = typeof payload?.timeoutMs === 'number' && payload.timeoutMs > 0
    ? payload.timeoutMs
    : DEFAULT_CREATE_TAB_TIMEOUT_MS;

  return {
    url,
    scriptPath,
    active: payload?.active ?? true,
    allFrames: payload?.allFrames ?? false,
    world: isSupportedScriptWorld(payload?.world) ? payload.world : 'ISOLATED',
    timeoutMs,
    waitUntil: isSupportedWaitUntil(payload?.waitUntil) ? payload.waitUntil : 'loading'
  };
};

const createTabWithScript = async (payload: CreateTabWithScriptPayload | undefined): Promise<{
	tabId: number;
	scriptPath: string;
	resolvedScriptPath: string;
	injectionTime: number;
	results: chrome.scripting.InjectionResult[];
}> => {
  const options = normalizeCreateTabWithScriptPayload(payload);
  const resolvedScriptPath = await resolveScriptPath(options.scriptPath);
  const tabId = await createTabAndWaitForLoad(options.url, {
    active: options.active,
    timeoutMs: options.timeoutMs,
    waitUntil: options.waitUntil
  });
  const injectionStart = Date.now();
  const results = await chrome.scripting.executeScript({
    target: {
      tabId,
      allFrames: options.allFrames
    },
    files: [resolvedScriptPath],
    world: options.world,
    injectImmediately: true
  });

  return {
    tabId,
    scriptPath: options.scriptPath,
    resolvedScriptPath,
    injectionTime: Date.now() - injectionStart,
    results
  };
};

const appendRecordedStep = async (tabId: number | undefined, step: AutomationStep, page: unknown): Promise<void> => {
  const stored = await chrome.storage.local.get(RECORDED_STEPS_STORAGE_KEY);
  const current = Array.isArray(stored[RECORDED_STEPS_STORAGE_KEY])
    ? stored[RECORDED_STEPS_STORAGE_KEY]
    : [];
  const entry = {
    id: `recorded_${Date.now()}`,
    tabId,
    step,
    page,
    createdAt: new Date().toISOString()
  };
  await chrome.storage.local.set({
    [RECORDED_STEPS_STORAGE_KEY]: [...current, entry].slice(-200)
  });
  chrome.runtime.sendMessage({
    target: 'sidepanel',
    type: 'AUTOMATION_RECORDED_ACTION',
    payload: entry
  });
};

export function createBackgroundMessageHandlers(
  devToolsPortManager: DevToolsPortManager
): BackgroundMessageHandler {
  return {
    AUTOMATION_ATTACH: async (payload, _sender, sendResponse) => {
      try {
        const tabId = typeof payload?.tabId === 'number' ? payload.tabId : undefined;
        const result = await attachToTab(tabId);
        sendResponse?.({ success: true, payload: result });
      } catch (error) {
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },

    AUTOMATION_DETACH: (_payload, _sender, sendResponse) => {
      detachFromTab();
      sendResponse?.({ success: true });
      return true;
    },

    AUTOMATION_HEALTH: async (_payload, _sender, sendResponse) => {
      try {
        const tabId = await ensureAttachedTab();
        const page = await getPageSnapshot(tabId);
        sendResponse?.({ success: true, payload: { tabId, page } });
      } catch (error) {
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },

    AUTOMATION_RUN_STEP: async (payload, _sender, sendResponse) => {
      try {
        const tabId = await ensureAttachedTab();
        const step = payload?.step as AutomationStep | undefined;
        if (!step) {
          sendResponse?.({ success: false, error: '缺少 step' });
          return true;
        }
        const result = await runStep(tabId, step, { allowRisky: payload?.allowRisky === true });
        sendResponse?.({ success: true, payload: result });
      } catch (error) {
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },

    AUTOMATION_RUN_STEPS: async (payload, _sender, sendResponse) => {
      try {
        const tabId = await ensureAttachedTab();
        const steps = Array.isArray(payload?.steps) ? payload.steps as AutomationStep[] : [];
        if (steps.length === 0) {
          sendResponse?.({ success: false, error: '缺少 steps' });
          return true;
        }
        const result = await runSteps(tabId, steps, { allowRisky: payload?.allowRisky === true });
        sendResponse?.({ success: true, payload: result });
      } catch (error) {
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },

    AUTOMATION_RECORD_START: async (_payload, _sender, sendResponse) => {
      try {
        const tabId = await ensureAttachedTab();
        await startRecorder(tabId);
        sendResponse?.({ success: true, payload: { tabId } });
      } catch (error) {
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },

    AUTOMATION_RECORD_STOP: async (_payload, _sender, sendResponse) => {
      try {
        const tabId = await ensureAttachedTab();
        await stopRecorder(tabId);
        sendResponse?.({ success: true, payload: { tabId } });
      } catch (error) {
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },

    AUTOMATION_RECORDED_ACTION: async (payload, sender, sendResponse) => {
      try {
        const step = payload?.step as AutomationStep | undefined;
        if (!step) {
          sendResponse?.({ success: false, error: '缺少录制步骤' });
          return true;
        }
        await appendRecordedStep(sender?.tab?.id, step, payload?.page);
        sendResponse?.({ success: true });
      } catch (error) {
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },

    AUTOMATION_RECORDED_STEPS_CLEAR: async (_payload, _sender, sendResponse) => {
      await chrome.storage.local.set({ [RECORDED_STEPS_STORAGE_KEY]: [] });
      sendResponse?.({ success: true });
      return true;
    },

    INIT_FILE_MAP: (payload, _sender, sendResponse) => {
      try {
        if (!payload || typeof payload !== 'object') {
          sendResponse?.({ success: false, error: '无效的 file_map 数据' });
          return true;
        }

        fileMap = new Map(Object.entries(payload));
        fileMapLoadPromise = null;
        backgroundFileMapDecryptor.clearCache();
        console.log('file_map 已初始化，条目数:', fileMap.size);
        sendResponse?.({ success: true });
      } catch (error) {
        console.error('初始化 file_map 失败:', error);
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },
    OPEN_BOOKMARK: (payload, _sender, sendResponse) => {
      try {
        const bookmark = { ...payload } as Bookmark;
        if (bookmark.url === undefined || bookmark.url === '') {
          sendResponse?.({ success: false, error: '缺少必要的书签信息' });
          return true;
        }

        void openBookmark(bookmark);
        sendResponse?.({ success: true });
      } catch (error) {
        console.error('打开书签失败:', error);
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
        return true;
      }
    },

    CREATE_TAB_WITH_SCRIPT: async (payload, _sender, sendResponse) => {
      try {
        const result = await createTabWithScript(payload);
        sendResponse?.({
          success: true,
          payload: result
        });
      } catch (error) {
        console.error('创建标签页并注入脚本失败:', error);
        sendResponse?.({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return true;
    },

    TEST_DINGTALK_WEBHOOK: async (payload, _sender, sendResponse) => {
      try {
        const webhookUrl = typeof payload?.webhookUrl === 'string' ? payload.webhookUrl.trim() : '';
        const content = typeof payload?.content === 'string' ? payload.content.trim() : '';

        if (!webhookUrl) {
          sendResponse?.({ success: false, error: '缺少 Webhook 地址' });
          return true;
        }

        if (!content) {
          sendResponse?.({ success: false, error: '测试消息内容为空' });
          return true;
        }

        const result = await postJsonFromBackground(webhookUrl, {
          msgtype: 'text',
          text: {
            content
          }
        });

        sendResponse?.({
          success: true,
          result
        });
      } catch (error) {
        console.error('测试钉钉 Webhook 失败:', error);
        sendResponse?.({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return true;
    },

    DEVTOOLS_PAGE_MESSAGE: (payload, _sender, sendResponse) => {
      try {
        console.log('收到开发者工具消息:', payload);
        if (!payload) {
          sendResponse?.({ success: false, error: '缺少必要的消息信息' });
          return true;
        }

        const { tabId, message } = payload;
        if (!tabId) {
          sendResponse?.({ success: false, error: '缺少目标标签页ID' });
          return true;
        }

        chrome.tabs.sendMessage(tabId, { ...message, target: 'content' }, (response: ResponseMessage) => {
          if (chrome.runtime.lastError) {
            console.error('转发消息到页面失败:', chrome.runtime.lastError);
            sendResponse?.({ success: false, error: chrome.runtime.lastError.message });
            return;
          }

          console.log('收到页面响应:', response);
          sendResponse?.({ success: true, response });
        });

        return true;
      } catch (error) {
        console.error('处理开发者工具消息失败:', error);
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
        return true;
      }
    },

    PAGE_DEVTOOLS_MESSAGE: (payload, sender, sendResponse) => {
      try {
        console.log('收到页面消息:', payload);
        if (!payload) {
          sendResponse?.({ success: false, error: '缺少必要的消息信息' });
          return true;
        }

        const tabId = sender?.tab?.id;
        const devToolsMessage = {
          type: 'PAGE_TO_DEVTOOLS_MESSAGE',
          payload
        };

        if (tabId) {
          const success = devToolsPortManager.sendToDevTools(tabId, devToolsMessage);
          sendResponse?.({ success });
        } else {
          const success = devToolsPortManager.sendToAllDevTools(devToolsMessage);
          sendResponse?.({ success });
        }

        return true;
      } catch (error) {
        console.error('处理页面消息失败:', error);
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
        return true;
      }
    },

    OPEN_SIDEPANEL: (_payload, _sender, sendResponse) => {
      try {
        if (chrome.sidePanel && chrome.sidePanel.open) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
              chrome.sidePanel.open({
                tabId: tabs[0].id,
                windowId: tabs[0].windowId
              }).then(() => {
                sendResponse?.({ status: 'success', message: '侧边栏已打开' });
              }).catch((error: any) => {
                console.error('打开侧边栏失败:', error);
                sendResponse?.({ status: 'error', message: error.message });
              });
            } else {
              sendResponse?.({ status: 'error', message: '没有找到活跃标签页' });
            }
          });
          return true;
        }

        sendResponse?.({ status: 'error', message: '当前浏览器不支持侧边栏API' });
      } catch (error: any) {
        console.error('处理打开侧边栏请求失败:', error);
        sendResponse?.({ status: 'error', message: error.message });
      }
      return true;
    },

    CLOSE_SIDEPANEL: (_payload, _sender, sendResponse) => {
      try {
        const sidePanel = chrome.sidePanel as SidePanelWithClose;
        if (sidePanel && sidePanel.close) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
              sidePanel.close?.({
                tabId: tabs[0].id
              }).then(() => {
                sendResponse?.({ status: 'success', message: '侧边栏已关闭' });
              }).catch((error: any) => {
                console.error('关闭侧边栏失败:', error);
                sendResponse?.({ status: 'error', message: error.message });
              });
            } else {
              sendResponse?.({ status: 'error', message: '没有找到活跃标签页' });
            }
          });
          return true;
        }

        if (chrome.sidePanel && chrome.sidePanel.setOptions) {
          chrome.sidePanel.setOptions({
            enabled: false
          }).then(() => {
            sendResponse?.({ status: 'success', message: '侧边栏已禁用' });
            setTimeout(() => {
              if (chrome.sidePanel && chrome.sidePanel.setOptions) {
                chrome.sidePanel.setOptions({ enabled: true });
              }
            }, 100);
          }).catch((error: any) => {
            console.error('禁用侧边栏失败:', error);
            sendResponse?.({ status: 'error', message: error.message });
          });
          return true;
        }

        sendResponse?.({ status: 'error', message: '当前浏览器不支持侧边栏API' });
      } catch (error: any) {
        console.error('处理关闭侧边栏请求失败:', error);
        sendResponse?.({ status: 'error', message: error.message });
      }
      return true;
    },

    LOAD_CONTENT_SCRIPT: (payload, sender, sendResponse) => {
      try {
        console.log('接收到LOAD_CONTENT_SCRIPT请求:', payload);
        if (!payload) {
          console.error('缺少必要的脚本信息: payload未提供');
          sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
          return;
        }

        const { data } = payload;
        if (!data || !data.scriptSrc) {
          console.error('缺少必要的脚本信息: scriptSrc未提供');
          sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
          return;
        }

        if (!sender?.tab || !sender.tab.id) {
          console.error('无法确定目标标签页ID');
          sendResponse?.({ success: false, error: '无法确定目标标签页ID' });
          return;
        }

        console.log(`准备注入脚本: ${data.scriptName}, 路径: ${data.scriptSrc}, 目标标签: ${sender.tab.id}`);
        console.log(`脚本路径: ${data.scriptSrc}`);

        const startTime = Date.now();
        chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          files: [data.scriptSrc],
          world: 'ISOLATED'
        }, (results) => {
          const endTime = Date.now();
          console.log(`脚本注入操作耗时: ${endTime - startTime}ms`);

          if (chrome.runtime.lastError) {
            console.error(`注入脚本失败: ${data.scriptName}`, chrome.runtime.lastError);
            const errorDetails = {
              message: chrome.runtime.lastError.message,
              scriptName: data.scriptName,
              scriptSrc: data.scriptSrc,
              tabId: sender?.tab?.id
            };
            sendResponse?.({ success: false, error: errorDetails });
            return;
          }

          console.log(`脚本注入成功: ${data.scriptName}`, results);
          sendResponse?.({
            success: true,
            payload: {
              results,
              scriptName: data.scriptName,
              injectionTime: endTime - startTime
            }
          });
        });
        return true;
      } catch (error) {
        console.error('处理LOAD_CONTENT_SCRIPT请求时发生异常:', error);
        sendResponse?.({ success: false, error: '内部处理错误: ' + (error instanceof Error ? error.message : String(error)) });
      }
    },

    executeScript: (payload, _sender, sendResponse) => {
      if (!payload) {
        console.error('缺少必要的脚本信息: payload未提供');
        sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
        return;
      }
      const { data } = payload;
      console.log('executeScript', data);
    },

    CONTEXT_MENU_CLICK: (payload, _sender, sendResponse) => {
      if (!payload) {
        sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
        return;
      }

      try {
        console.log('接收到上下文菜单点击消息:', payload);
        sendRequestToActiveTab({ type: payload.itemId }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('转发消息到内容脚本失败:', chrome.runtime.lastError);
            sendResponse?.({ success: false, error: chrome.runtime.lastError.message });
            return;
          }

          console.log('消息成功转发到内容脚本，响应:', response);
          sendResponse?.({ success: true, response });
        });
        return true;
      } catch (error) {
        console.error('处理上下文菜单点击消息时发生错误:', error);
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
        return true;
      }
    },

    quickLogin: (payload, _sender, sendResponse) => {
      if (!payload) {
        sendResponse?.({ success: false, error: '缺少必要的登录信息' });
        return;
      }
      sendRequestToActiveTab({ ...payload, type: 'quickLogin' }, () => undefined);
    },

    // getPinyin: async (payload, _sender, sendResponse) => {
    // 	if (!payload) {
    // 		sendResponse?.({ success: false, error: '缺少必要的字符串信息' });
    // 		return;
    // 	}

    // 	const { data } = payload;
    // 	try {
    // 		const result = pinyin(data, { toneType: 'none', type: 'array' }).join('');
    // 		sendResponse?.({ success: true, payload: result });
    // 	} catch (error) {
    // 		console.error('使用pinyin-pro失败:', error);
    // 		sendResponse?.({ success: false, error: '拼音转换失败: ' + (error instanceof Error ? error.message : String(error)) });
    // 	}
    // 	return true;
    // },

    getImage: (payload, sender, sendResponse) => {
      if (!payload) {
        sendResponse?.({ success: false, error: '缺少必要的图片信息' });
        return;
      }

      const { data } = payload;
      if (!sender?.tab?.id) {
        console.error('无法确定目标标签页ID');
        sendResponse?.({ success: false, error: '无法确定目标标签页ID' });
        return;
      }

      fetchImageFromAPI().then(imageData => {
        if (imageData) {
          chrome.tabs.sendMessage(sender?.tab?.id || 0, {
            action: 'updatePatientImage',
            data: {
              ...data,
              base64Data: imageData
            }
          });
        }
      });
      return true;
    },

    LOAD_URL_SCRIPT: async (payload, _sender, sendResponse) => {
      if (!payload) {
        sendResponse?.({ success: false, error: '缺少必要的脚本信息' });
        return;
      }

      const { url } = payload;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const scriptContent = await response.text();
        sendResponse?.({ success: true, result: scriptContent });
      } catch (error) {
        console.error('加载网络脚本失败:', error);
        sendResponse?.({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    },

    SWITCH_VERSION: async (payload, _sender, sendResponse) => {
      if (!payload) {
        sendResponse?.({ success: false, error: '缺少必要的版本信息' });
        return;
      }

      const { version, name } = payload;
      console.log('切换版本:', name, version);
    }
  };
}
