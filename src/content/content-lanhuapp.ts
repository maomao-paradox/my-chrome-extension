/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-lanhuapp.ts
 * @date 2026-03-02T00:00:00.000Z
 */

import { addElementToDom, injectScriptToActivateTab, waitForSelector } from '@/utils/element-control'
import messenger from "@/message"
import { ExtMessage, Tool, TextTool } from "@/assets/types"

export default (ctx: AppContext, config = {}) => {

    const messageHandlers = {
        default: (...args: any) => {
            maLogger.error("未定义的消息类型", args);
        },
    }

    const initMessageListener = () => {
        messenger.ext.listen((message: ExtMessage, sender, sendResponse: Function) => {
            maLogger.log("Received message:", message, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
            const { type, payload: data, target } = message;
            if (target !== 'content-lanhuapp') return true;
            maLogger.info(`Received request: ${type}`, data, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
            // 如果消息没有action字段，直接返回，视为其他消息类型
            if (!type) return false;
            const steps = [type];
            let step = steps.shift();

            // 处理所有步骤
            while (step) {
                // 查找对应的处理器
                const handler = messageHandlers[step as keyof typeof messageHandlers];
                if (handler) {
                    // 执行处理器
                    handler(data);
                }
                step = steps.shift();
            }
        });
    }

    // 事件监听器
    initMessageListener();
    
    // 页面加载完成后执行
    window.onload = () => {
        maLogger.log("蓝湖页面加载完成,开始监听消息");
        
        // 在这里添加蓝湖特定的功能
        // 例如：添加自定义按钮、修改页面元素等
    };

    return {};
};