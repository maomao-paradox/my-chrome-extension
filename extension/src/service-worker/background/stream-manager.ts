import { completeChatFlow } from '../deepseek';

interface StreamConnection {
	port: chrome.runtime.Port;
}

export class StreamManager {
  private readonly connections = new Map<string, StreamConnection>();

  startStream(
    port: chrome.runtime.Port,
    prompt: string,
    messageId: string,
    role: string,
    provider?: string,
    model?: string,
    apiKey?: string,
    apiBaseUrl?: string,
    systemPrompt?: string,
    targetTabId?: number
  ): void {
    const startTime = performance.now();
    console.log('开始流式传输:', messageId, prompt, '角色:', role, '提供商:', provider, '模型:', model);
    this.connections.set(messageId, { port });
    let hasSentData = false;
    let firstChunkTime: number | null = null;

    void completeChatFlow(prompt, role, {
      onData: (content) => {
        if (!content) {
          return;
        }

        // 记录首包时间
        if (!firstChunkTime) {
          firstChunkTime = performance.now();
          const ttfb = Math.round(firstChunkTime - startTime);
          console.log(`[AI Stream] ${messageId} 首包到达: ${ttfb}ms`);
        }

        try {
          hasSentData = true;
          port.postMessage({
            type: 'AI_CONVERSATION_STREAM_DATA',
            payload: { messageId, content }
          });
        } catch (error) {
          console.warn('发送流式数据消息失败:', error);
          this.connections.delete(messageId);
        }
      },
      onError: (error) => {
        const elapsed = Math.round(performance.now() - startTime);
        console.error(`[AI Stream] ${messageId} 错误 (${elapsed}ms):`, error);
        this.sendError(port, messageId, error instanceof Error ? error.message : '未知错误');
      },
      onComplete: () => {
        const totalElapsed = Math.round(performance.now() - startTime);
        const generationTime = firstChunkTime ? Math.round(performance.now() - firstChunkTime) : null;
        
        console.log(`[AI Stream] ${messageId} 完成:`, {
          totalTime: `${totalElapsed}ms`,
          ttfb: firstChunkTime ? `${Math.round(firstChunkTime - startTime)}ms` : 'N/A',
          generationTime: generationTime !== null ? `${generationTime}ms` : 'N/A',
          hasContent: hasSentData
        });

        if (!hasSentData) {
          this.sendError(port, messageId, 'AI 响应已完成，但没有返回可显示内容。请检查模型配置或后台流式解析日志。');
          return;
        }

        try {
          port.postMessage({
            type: 'AI_CONVERSATION_COMPLETE',
            payload: { messageId }
          });
        } catch (error) {
          console.warn('发送完成消息失败:', error);
        }

        this.connections.delete(messageId);
      }
    }, provider, model, apiKey, apiBaseUrl, systemPrompt, targetTabId).catch((error) => {
      const elapsed = Math.round(performance.now() - startTime);
      console.error(`[AI Stream] ${messageId} 流程异常 (${elapsed}ms):`, error);
      if (this.connections.has(messageId)) {
        this.sendError(port, messageId, error instanceof Error ? error.message : '未知错误');
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('端口断开连接:', messageId);
      this.connections.delete(messageId);
    });
  }

  private sendError(port: chrome.runtime.Port, messageId: string, error: string): void {
    try {
      port.postMessage({
        type: 'AI_CONVERSATION_ERROR',
        payload: { messageId, error }
      });
      console.log('发送错误消息成功:', error);
    } catch (postError) {
      console.warn('发送错误消息失败:', postError);
    }

    this.connections.delete(messageId);
  }
}
