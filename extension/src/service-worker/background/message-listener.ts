import messenger from '@/message';
import type { BackgroundMessageHandler } from '@/types';

export function initMessageListener(messageHandlers: BackgroundMessageHandler): void {
  messenger.ext.listen((request, sender, sendResponse) => {
    const { type, target } = request;
    if (target !== 'background' || !type) {
      return true;
    }

    const handler = messageHandlers[type];
    if (handler) {
      handler(request.payload, sender, sendResponse);
    }
  });
}
