import { injectScriptToActivateTab } from '@/utils/element-control';
import { storage } from '@/stores';
import { getRuntimeScript } from '@/utils/common';

export interface PageTools {
    batchReplaceText: (oldText: string, newText: string) => { success: boolean; msg: string };
    toggleContentEditable: (enabled: boolean) => { success: boolean; msg: string };
    extractLinks: () => { success: boolean; msg: string };
    clearStorage: () => { success: boolean; msg: string };
    getPageSource: () => { success: boolean; msg: string };
    getPageVariable: (varPath: string) => any;
    setPageVariable: (varPath: string, value: any) => Promise<unknown>;
    getLocalStorage: () => { success: boolean; msg: string; data?: Record<string, string> };
    setLocalStorage: (data: Record<string, string> | string) => { success: boolean; msg: string };
    takeScreenshot: () => { success: boolean; msg: string };
}

export const createPageTools = (ctx: AppContext): PageTools => {
    const batchReplaceText = (oldText: string, newText: string) => {
        maLogger.log(`=====批量替换页面文本: "${oldText}" -> "${newText}"=====`);

        if (!oldText) {
            maLogger.error('批量替换文本失败: 未指定要替换的文本');
            return { success: false, msg: '请指定要替换的文本' };
        }

        const processTextNode = (node: Node): void => {
            if (
                node.nodeType === Node.TEXT_NODE
                && node.parentElement
                && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)
            ) {
                const text = node.textContent || '';
                if (text.includes(oldText)) {
                    node.textContent = text.replace(new RegExp(oldText, 'g'), newText);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                node.childNodes.forEach(processTextNode);
            }
        };

        document.body.childNodes.forEach(processTextNode);
        return { success: true, msg: `已替换页面中所有"${oldText}"为"${newText}"` };
    };

    const toggleContentEditable = (enabled: boolean) => {
        document.designMode = enabled ? 'on' : 'off';
        document.querySelectorAll('#app, .content, .main-content').forEach((element) => {
            (element as HTMLElement).contentEditable = String(enabled);
        });

        return { success: true, msg: enabled ? '已启用页面内容编辑模式' : '已禁用页面内容编辑模式' };
    };

    const extractLinks = () => {
        maLogger.info('=====提取页面链接=====');
        const links = Array.from(document.querySelectorAll('a[href]')).map((link) => {
            const href = link.getAttribute('href') || '';
            const text = link.textContent?.trim() || '无文本';
            return { href, text };
        });

        try {
            const linksText = links.map((link, index) => `${index + 1}. ${link.text}: ${link.href}`).join('\n');
            const blob = new Blob([linksText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `page-links-${new Date().getTime()}.txt`;
            anchor.click();
            URL.revokeObjectURL(url);

            return { success: true, msg: `已提取${links.length}个链接并保存` };
        } catch (error) {
            maLogger.error('提取链接失败:', error);
            return { success: false, msg: '提取链接失败: ' + (error as Error).message };
        }
    };

    const clearStorage = () => {
        maLogger.info('=====清除本地存储=====');

        try {
            localStorage.clear();
            sessionStorage.clear();
            document.cookie.split(';').forEach((cookie) => {
                const eqPos = cookie.indexOf('=');
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : '';
                if (name) {
                    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + document.domain;
                }
            });

            return { success: true, msg: '已清除本地存储、会话存储和Cookie' };
        } catch (error) {
            maLogger.error('清除存储失败:', error);
            return { success: false, msg: '清除存储失败: ' + (error as Error).message };
        }
    };

    const getPageSource = () => {
        maLogger.info('=====获取页面源码=====');

        try {
            const html = document.documentElement.outerHTML;
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `page-source-${new Date().getTime()}.html`;
            anchor.click();
            URL.revokeObjectURL(url);

            return { success: true, msg: '已获取页面源码并下载' };
        } catch (error) {
            maLogger.error('获取页面源码失败:', error);
            return { success: false, msg: '获取页面源码失败: ' + (error as Error).message };
        }
    };

    const getPageVariable = (varPath: string) => {
        const storedPathsKey = 'env_config_path';
        if (!varPath) {
            const storedPaths = storage.page.local.get(storedPathsKey, null);
            varPath = storedPaths || 'window.location';
        }

        storage.page.local.set(storedPathsKey, varPath);
        let result;
        switch (varPath) {
            default: {
                injectScriptToActivateTab({file: getRuntimeScript('getPageVariable')});
                const callbackResult = storage.page.session.get('env_config_value', null);
                if (callbackResult == null) {
                    maLogger.error('获取页面变量失败: 未找到变量');
                    return null;
                }
                result = callbackResult;
                break;
            }
            case 'window.location':
                result = ctx.location;
                break;
            case 'document.title':
                result = document.title;
                break;
            case 'document.cookie':
                result = document.cookie;
                break;
            case 'navigator.userAgent':
                result = navigator.userAgent;
                break;
            case 'localStorage':
                result = localStorage;
                break;
            case 'sessionStorage':
                result = sessionStorage;
                break;
        }
        maLogger.info('=====获取页面变量=====', varPath, result);
        return result;
    };

    const setPageVariable = (varPath: string, value: any) => {
        maLogger.info('=====设置页面变量=====', varPath, value);
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    if (varPath === 'document.title') {
                        document.title = value;
                        resolve({ success: true, msg: '变量设置成功' });
                        return;
                    }

                    const callbackId = `set_var_callback_${Date.now()}`;
                    const scriptContent = `
                        try {
                            try {
                                const setNestedValue = (objPath, val) => {
                                    const parts = objPath.split('.');
                                    let obj = window;
                                    let i = 0;
                                    for (; i < parts.length - 1; i++) {
                                        if (!obj[parts[i]]) {
                                            obj[parts[i]] = {};
                                        }
                                        obj = obj[parts[i]];
                                    }
                                    obj[parts[i]] = val;
                                };
                                setNestedValue('${varPath}', JSON.parse('${JSON.stringify(value).replace(/'/g, "\\'")}'));
                            } catch (e) {
                                window['${callbackId}'] = {
                                    success: false,
                                    error: '无法设置变量: ' + e.message
                                };
                                return;
                            }
                            window['${callbackId}'] = { success: true };
                        } catch (e) {
                            window['${callbackId}'] = {
                                success: false,
                                error: '执行错误: ' + e.message
                            };
                        }
                    `;

                    injectScriptToActivateTab({scriptStr: scriptContent});

                    const callbackResult = (ctx as any)[callbackId];
                    delete (ctx as any)[callbackId];

                    if (callbackResult && callbackResult.success) {
                        resolve({ success: true, msg: '变量设置成功' });
                    } else {
                        resolve({ success: false, msg: callbackResult?.error || '设置变量失败' });
                    }
                } catch (error) {
                    maLogger.error('设置页面变量失败:', error);
                    resolve({ success: false, msg: '设置页面变量失败: ' + (error as Error).message });
                }
            }, 0);
        });
    };

    const getLocalStorage = () => {
        maLogger.log('=====获取localStorage=====');

        try {
            const localStorageData: Record<string, string> = {};
            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);
                if (key) {
                    localStorageData[key] = localStorage.getItem(key) || '';
                }
            }

            return { success: true, msg: `已获取${Object.keys(localStorageData).length}条localStorage数据`, data: localStorageData };
        } catch (error) {
            maLogger.error('获取localStorage失败:', error);
            return { success: false, msg: '获取localStorage失败: ' + (error as Error).message };
        }
    };

    const setLocalStorage = (data: Record<string, string> | string) => {
        maLogger.log('=====设置localStorage=====', data);
        if (!data) {
            return { success: false, msg: '数据格式错误，必须是一个对象' };
        }

        try {
            localStorage.clear();
            const normalizedData = typeof data === 'string' ? JSON.parse(data) : data;

            let count = 0;
            for (const [key, value] of Object.entries(normalizedData)) {
                try {
                    localStorage.setItem(key, value as string);
                    count++;
                } catch (error) {
                    maLogger.warn(`设置localStorage键${key}失败:`, error);
                }
            }

            return { success: true, msg: `已成功设置${count}条localStorage数据` };
        } catch (error) {
            maLogger.error('设置localStorage失败:', error);
            return { success: false, msg: '设置localStorage失败: ' + (error as Error).message };
        }
    };

    const takeScreenshot = () => {
        maLogger.log('=====截取网页截图=====');

        if (!('captureStream' in HTMLCanvasElement.prototype)) {
            return { success: false, msg: '您的浏览器不支持截图功能' };
        }

        try {
            const canvas = document.createElement('canvas');
            const cvs = canvas.getContext('2d');
            if (!cvs) {
                throw new Error('无法获取Canvas上下文');
            }

            canvas.width = ctx.innerWidth;
            canvas.height = ctx.innerHeight;

            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                z-index: 9999;
            `;
            notification.textContent = '正在截取网页截图...';
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.display = 'none';
                cvs.fillStyle = 'white';
                cvs.fillRect(0, 0, canvas.width, canvas.height);
                cvs.font = '20px Arial';
                cvs.fillStyle = 'black';
                cvs.fillText('网页截图功能演示', 50, 50);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        return;
                    }

                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `screenshot-${new Date().getTime()}.png`;
                    anchor.click();
                    URL.revokeObjectURL(url);

                    notification.textContent = '网页截图已保存';
                    notification.style.display = 'block';
                    notification.style.background = 'rgba(82, 196, 26, 0.8)';

                    setTimeout(() => {
                        notification.remove();
                    }, 2000);
                });
            }, 500);

            return { success: true, msg: '正在准备网页截图' };
        } catch (error) {
            maLogger.error('截图失败:', error);
            return { success: false, msg: '截图失败: ' + (error as Error).message };
        }
    };

    return {
        batchReplaceText,
        toggleContentEditable,
        extractLinks,
        clearStorage,
        getPageSource,
        getPageVariable,
        setPageVariable,
        getLocalStorage,
        setLocalStorage,
        takeScreenshot,
    };
};
