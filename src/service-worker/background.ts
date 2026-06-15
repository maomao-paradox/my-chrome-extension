/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/background/service-worker.ts
 * @date 2026-02-05T02:38:01.693Z
 */

import './background/dom-shim';
import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils';
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
