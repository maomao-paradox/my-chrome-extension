import { getFileMap } from './message-handlers';

export async function executeBookmarkScript(tabId: number) {
    const scriptPath = getFileMap()?.get('js/runtime/bookmark-highlight');
    if (!scriptPath) {
        throw new Error('bookmark-highlight 脚本路径不存在');
    }
    await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptPath]   // 只需要相对路径即可
    })
};