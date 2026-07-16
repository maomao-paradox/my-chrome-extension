import type { Bookmark } from '@/types';
import { createTabAndWaitComplete } from './chrome-tabs';
import { executeBookmarkScript } from './execute-script';

export async function openBookmark(bookmark: Bookmark): Promise<void> {
  try {
    const tabId = await createTabAndWaitComplete(bookmark.url, false);
    maLogger.log(`打开书签: ${bookmark.text}`);
    await executeBookmarkScript(tabId);
    maLogger.log(`高亮文本: ${bookmark.text}`);
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (bm: Bookmark) => {
        (window as unknown as { __bookmarkHighlight__: (b: Bookmark) => void }).__bookmarkHighlight__(bm);
      },
      args: [bookmark]
    });
    maLogger.log(`切换到书签标签页: ${bookmark.text}`);
    await chrome.tabs.update(tabId, { active: true });
  } catch (error) {
    console.error('打开书签失败:', error);
  }
}
