/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-docker-portainer.ts
 * @date 2026-03-12
 * @description Docker Portainer 文本替换工具 - 可爱粉色风格喵~
 */

import { waitForSelector, addElementToDom, injectScriptToActivateTab } from "@/utils/element-control"
import { Tool } from "@/assets/types"
import messenger from "@/message"
import { getRuntimeScript } from "@/utils/common";


/**
 * 为 CodeEditor 元素添加按钮
 */
const addButtonToCodeEditor = (editorElement: HTMLElement) => {
    // 检查是否已经添加过按钮
    if (editorElement.querySelector('docker-portainer-button')) {
        return;
    }

    // 设置元素为相对定位，以便按钮绝对定位
    editorElement.style.position = 'relative';

    // 创建 Web Component 按钮
    const button = document.createElement('docker-portainer-button');

    // 设置按钮定位样式（外部控制，更灵活）
    Object.assign(button.style, {
        position: 'absolute',
        right: '24px',
        top: '12px',
        display: 'block',
        zIndex: '999999',
    });

    editorElement.appendChild(button);
};

/**
 * 监听并处理 CodeEditor 元素
 */
const observeCodeEditorElements = () => {
    // 选择器：匹配包含这些 class 的元素
    const editorSelector = '.app-react-components-CodeEditor-CodeEditor-module__root.app-react-components-CodeEditor-CodeEditor-module__codeEditor';

    // 先处理已存在的元素
    const existingElements = document.querySelectorAll(editorSelector);
    existingElements.forEach((el) => {
        addButtonToCodeEditor(el as HTMLElement);
    });

    // 使用 MutationObserver 监听动态添加的元素
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    const element = node as HTMLElement;
                    // 检查新添加的节点是否是 CodeEditor
                    if (element.classList?.contains('app-react-components-CodeEditor-CodeEditor-module__root') &&
                        element.classList?.contains('app-react-components-CodeEditor-CodeEditor-module__codeEditor')) {
                        addButtonToCodeEditor(element);
                    }
                    // 检查新添加的节点是否包含 CodeEditor
                    const editors = element.querySelectorAll?.(editorSelector);
                    editors?.forEach((el) => {
                        addButtonToCodeEditor(el as HTMLElement);
                    });
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
};

export default (ctx: AppContext, config = {}) => {
    const tools: Tool[] = [{
        id: 'dockerPortainerReplace',
        label: 'Portainer文本替换'
    }];

    const updateSidebar = async (tools: Tool[]) => {
        try {
            if (ctx.self === ctx.top) {
                let sideBarInstance: any = ctx.gmod("__MODULE_SIDEBAR");

                if (!sideBarInstance) {
                    messenger.ext.send({
                        type: 'UPDATE_SIDEBAR_TOOLS',
                        payload: { tools },
                        target: 'content'
                    });
                } else {
                    sideBarInstance.updateTools(tools);
                }
            }
        } catch (error) {
            maLogger.log("发送侧边栏工具更新请求失败: ", error);
        }
    };

    // 等待页面加载后开始监听
    waitForSelector({
        selector: 'body',
        timeout: 10000,
        callback: async () => {
            await injectScriptToActivateTab({ file: getRuntimeScript("docker-portainer-button") });
            await injectScriptToActivateTab({ file: getRuntimeScript("update-stacks") });
            observeCodeEditorElements();
        }
    });

    return {};
};
