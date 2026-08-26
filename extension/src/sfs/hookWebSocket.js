// Hook WebSocket
(function() {
  const originalWebSocket = window.WebSocket;
    
  window.WebSocket = function(url, protocols) {
    console.log('[WebSocket Hook] 创建连接:', url, protocols);
        
    const ws = new originalWebSocket(url, protocols);
        
    const originalSend = ws.send;
    ws.send = function(data) {
      console.log('[WebSocket Hook] 发送消息:', data);
      return originalSend.apply(this, arguments);
    };
        
    ws.addEventListener('open', function(event) {
      console.log('[WebSocket Hook] 连接已打开:', event);
    });
        
    ws.addEventListener('message', function(event) {
      console.log('[WebSocket Hook] 收到消息:', event.data);
    });
        
    ws.addEventListener('close', function(event) {
      console.log('[WebSocket Hook] 连接已关闭:', event.code, event.reason);
    });
        
    ws.addEventListener('error', function(event) {
      console.log('[WebSocket Hook] 连接错误:', event);
    });
        
    return ws;
  };
    
  // 保持原型链
  window.WebSocket.prototype = originalWebSocket.prototype;
    
  console.log('[WebSocket Hook] WebSocket Hook 已激活');
})();