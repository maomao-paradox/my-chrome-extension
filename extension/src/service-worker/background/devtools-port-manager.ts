export class DevToolsPortManager {
  private readonly devToolsConnections = new Map<number, chrome.runtime.Port>();

  registerConnection(tabId: number, port: chrome.runtime.Port): void {
    console.log('注册开发者工具连接:', tabId);
    this.devToolsConnections.set(tabId, port);

    port.onDisconnect.addListener(() => {
      console.log('开发者工具连接断开:', tabId);
      this.devToolsConnections.delete(tabId);
    });

    port.onMessage.addListener((message) => {
      this.handleDevToolsMessage(port, message);
    });
  }

  sendToDevTools(tabId: number, message: unknown): boolean {
    const port = this.devToolsConnections.get(tabId);
    if (!port) {
      console.warn('开发者工具未连接:', tabId);
      return false;
    }

    try {
      port.postMessage(message);
      console.log('向开发者工具发送消息成功:', tabId, message);
      return true;
    } catch (error) {
      console.error('向开发者工具发送消息失败:', error);
      return false;
    }
  }

  sendToAllDevTools(message: unknown): boolean {
    let successCount = 0;
    this.devToolsConnections.forEach((_port, tabId) => {
      if (this.sendToDevTools(tabId, message)) {
        successCount++;
      }
    });
    console.log(`向 ${successCount} 个开发者工具发送消息成功`);
    return successCount > 0;
  }

  isConnected(tabId: number): boolean {
    return this.devToolsConnections.has(tabId);
  }

  getConnectionCount(): number {
    return this.devToolsConnections.size;
  }

  private handleDevToolsMessage(port: chrome.runtime.Port, message: any): void {
    console.log('收到开发者工具消息:', message);

    if (message.type !== 'DEVTOOLS_PAGE_MESSAGE' || !message.payload) {
      return;
    }

    const { tabId, message: pageMessage } = message.payload;
    if (!tabId) {
      port.postMessage({
        success: false,
        error: '缺少目标标签页ID'
      });
      return;
    }

    chrome.tabs.sendMessage(tabId, { ...pageMessage, target: 'content' }, (response: any) => {
      if (chrome.runtime.lastError) {
        console.error('转发消息到页面失败:', chrome.runtime.lastError);
        port.postMessage({
          success: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }

      console.log('收到页面响应:', response);
      port.postMessage({
        success: true,
        response
      });
    });
  }
}
