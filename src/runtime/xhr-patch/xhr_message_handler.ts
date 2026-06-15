/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/patch/xhr-patch/xhr_message_handler.ts
 * @date 2026-02-05T02:38:01.696Z
 */

import type { XhrRulesMap, ExtMessage } from "@/assets/types";
import { storage } from "@/stores";
import  messenger  from "@/message";
import { injectScriptToActivateTab } from "@/utils/element-control";
import { sendMessageToPage, listenForPageMessages } from "@/message/content-page";
import { getRuntimeScript } from "@/utils/common";

/**
 * XHR 消息中转站 - 用于 处理 sidepanel和页面的通信
 */

// 存储键名
const STORAGE_KEY = 'XHR_RULES';
const LOGIC_SWITCH_KEY = 'XHR_ENABLED';

/**
 * 从localStorage获取规则并转换函数
 * @returns XHR规则对象
 */
function getRulesFromStorage(): XhrRulesMap {
  try {
    const storedRules = storage.page.local.get(STORAGE_KEY);
    return storedRules && typeof storedRules === 'object' ? storedRules : {};
  } catch (error) {
    console.error('MRIA: 从localStorage获取规则失败:', error);
  }
  return {};
}

/**
 * 保存规则到localStorage，将函数转换为字符串
 * @param rules 要保存的规则
 */
function saveRulesToStorage(rules: XhrRulesMap): void {
  try {
    // 规则已经是JSON格式，可以直接保存
    storage.page.local.set(STORAGE_KEY, rules);
  } catch (error) {
    console.error('MRIA: 保存规则到localStorage失败:', error);
  }
}

/**
 * 处理来自sidepanel的消息
 * @param event 消息事件
 * 原生家庭的悲剧会在后代身上重演吗
 */
function sidepanelEventHandler() {
  const handler = (event: ExtMessage, sender: chrome.runtime.MessageSender, sendResponse: Function) => {
    try {
      const { type, payload: data, target } = event;
      // console.log(event)
      // 如果消息没有type字段，直接返回，视为其他消息类型
      if (!type) return false;

      if (target && target.toLowerCase() !== 'content') return false;

      switch (type) {
        case 'TOGGLE_XHR_PATCH':
          // 切换XHR补丁状态
          if (typeof data.enable === 'boolean') {
            // 保存切换状态到localStorage
            // storage.page.local.set(LOGIC_SWITCH_KEY, data.enable);
            sendMessageToPage({ type: type, payload: { enable: data.enable } }, (response) => {
              sendResponse({
                data: response,
                success: true
              });
            });
          }
          break;

        case 'MRIA_XHR_GET_STATUS':
          // 向页面发送请求获取补丁状态
          sendMessageToPage({ type }, (response) => {
            // 回复sidepanel包含规则和补丁状态，包括完整的isEnabled和isPatched信息
            console.log('MRIA: 从页面接收XHR状态响应:', response);
            sendResponse({
              data: response,
              success: true
            });
          });
          break;

        case 'MRIA_XHR_UPDATE_RULES':
          // 更新全部规则
          if (data) {
            // 直接使用JSON格式的规则
            // const rules = data.rules;

            // saveRulesToStorage(rules);
            // 通知页面更新规则
            sendMessageToPage({ type, payload: data }, (response) => {
              sendResponse({
                success: true,
                msg: '规则更新成功'
              });
            });
          }
          break;

        case 'MRIA_XHR_GET_RULES':
          // 获取当前规则
          const mriaXhrRules = getRulesFromStorage();
          sendMessageToPage({ type: 'MRIA_XHR_RULES_RESPONSE', payload: { rules: mriaXhrRules } });
          break;

        case 'MRIA_XHR_CLEAR_RULES':
          // 清除所有规则
          saveRulesToStorage({});
          sendMessageToPage({ type: 'MRIA_XHR_UPDATE_RULES', payload: { rules: {} } });
          break;

        case 'MRIA_XHR_CLEAR_RULES_FOR_PERSISTENCE':
          // 处理来自页面的清空持久化请求
          console.log('MRIA: 从页面接收清空规则请求');
          saveRulesToStorage({});
          break;

        case 'MRIA_XHR_ADD_RULE':
          // 添加单个规则
          if (data.url && data.rule) {
            const rules = getRulesFromStorage();
            rules[data.url] = data.rule;
            saveRulesToStorage(rules);
            sendMessageToPage({ type: 'MRIA_XHR_UPDATE_RULES', payload: { rules } });
          }
          break;

        case 'MRIA_XHR_REMOVE_RULE':
          // 移除单个规则
          if (data.url) {
            const rules = getRulesFromStorage();
            delete rules[data.url];
            saveRulesToStorage(rules);
            sendMessageToPage({ type: 'MRIA_XHR_UPDATE_RULES', payload: { rules } });
          }
          break;
      }
    } catch (error) {
      console.error('MRIA: 处理sidepanel消息失败:', error);
    }
  }
  messenger.ext.listen(handler);
}

/**
 * 初始化消息中转站
 */
export function injectXhrPatch(defaultRules: XhrRulesMap) {
  // 监听XHR补丁注册事件 - 确保只执行一次
  document.addEventListener('MRIA_XHR_PATCH_READY', (e: Event) => {
    try {
      let rulesResult = {};
      // 使用默认规则并持久化存储
      console.log('MRIA: 使用默认规则并持久化存储');
      if (defaultRules && Object.keys(defaultRules).length > 0) {
        rulesResult = defaultRules;
        saveRulesToStorage(defaultRules);
        console.log('MRIA: 发送到XHR补丁的规则:', rulesResult);

        // 发送规则到XHR补丁 - 发送已转换好的函数对象
        sendMessageToPage({
          type: 'MRIA_XHR_UPDATE_RULES',
          payload: rulesResult
        });
      } else {
        console.error('MRIA: 默认规则为空，请手动添加规则');
      }
      // }
    } catch (error) {
      console.error('MRIA: Error sending rules to XHR patch:', error);
    }
  }, { once: true });

  // sidepanel 消息处理器，监听来自sidepanel的消息，将消息转发给页面，设置回调函数在将结果返回sidepanel
  sidepanelEventHandler();

  // 监听页面消息
  listenForPageMessages();

  // 注入XHR补丁脚本
  injectScriptToActivateTab({file: getRuntimeScript('xhr-patch')});
}