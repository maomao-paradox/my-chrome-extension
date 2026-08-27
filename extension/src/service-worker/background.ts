/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/background/service-worker.ts
 * @date 2026-02-05T02:38:01.693Z
 */

import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/pure-utils';
import { DevToolsPortManager } from './background/devtools-port-manager';
import { StreamManager } from './background/stream-manager';
import { initClearAiSessionListener } from './background/ai-session-listener';
import { initMenuListener } from './background/context-menu';
import { initMessageListener } from './background/message-listener';
import { createBackgroundMessageHandlers } from './background/message-handlers';
import { initRuntimeConnectionListener } from './background/runtime-connections';

installGlobalLogger({ title: 'MRIA BACKGROUND', enabled: false });
void syncGlobalLoggerFromStorage();

const streamManager = new StreamManager();
const devToolsPortManager = new DevToolsPortManager();

initRuntimeConnectionListener({
  streamManager,
  devToolsPortManager
});
initClearAiSessionListener();
initMenuListener();
initMessageListener(createBackgroundMessageHandlers(devToolsPortManager));

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-content-feature-panel") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "OPEN_CONTENT_FEATURE_PANEL",
        target: "content",
      });
    } catch (error) {
      console.warn("当前页面没有可用的内容脚本:", error);
    }
  }
});
