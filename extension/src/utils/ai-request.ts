/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/ai-request.ts
 * @date 2026-07-27T00:00:00.000Z
 * 
 * 通用AI调用工具函数
 * 封装Chrome扩展中与AI模型的通信，提供简洁的字符串输入输出接口
 * 
 * 使用方式：
 * ```typescript
 * import { requestAI } from '@/utils/ai-request';
 * 
 * const response = await requestAI('帮我生成一段文本');
 * console.log(response);
 * ```
 */

import { loadAIConfig } from './ai-config';

/**
 * AI请求配置选项
 */
export interface AIRequestOptions {
  /** 系统提示词，用于设定AI角色和行为 */
  systemPrompt?: string;
  /** 请求超时时间（毫秒），默认60000ms */
  timeoutMs?: number;
  /** AI角色标识，用于会话管理 */
  role?: string;
  /** 模型提供商：deepseek | openai | anthropic | google | custom */
  provider?: string;
  /** 模型ID */
  model?: string;
  /** API密钥 */
  apiKey?: string;
  /** API基础URL */
  apiBaseUrl?: string;
}

/**
 * AI请求结果
 */
export interface AIRequestResult {
  /** 是否成功 */
  success: boolean;
  /** AI回复内容 */
  content: string;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 生成唯一的消息ID
 */
const createMessageId = (): string =>
  `ai-request-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * 通用AI调用函数
 * 通过Chrome扩展端口与Background Service Worker通信，调用AI模型
 * 
 * @param prompt 用户输入的提示词
 * @param options 可选配置项
 * @returns Promise<AIRequestResult> AI请求结果
 * 
 * @example
 * ```typescript
 * // 基本使用
 * const result = await requestAI('帮我写一段介绍性文字');
 * if (result.success) {
 *   console.log('AI回复:', result.content);
 * } else {
 *   console.error('请求失败:', result.error);
 * }
 * 
 * // 自定义配置
 * const result = await requestAI('帮我分析这段代码', {
 *   systemPrompt: '你是一个资深的程序员助手',
 *   timeoutMs: 30000,
 *   role: 'code_analyzer'
 * });
 * ```
 */
export async function requestAI(
  prompt: string,
  options: AIRequestOptions = {}
): Promise<AIRequestResult> {
  // 记录请求开始时间
  const startTime = performance.now();

  // 参数验证
  if (!prompt || typeof prompt !== 'string') {
    const elapsed = Math.round(performance.now() - startTime);
    maLogger.log('[AI Request] 参数验证失败:', {
      error: 'prompt必须是非空字符串',
      elapsed: `${elapsed}ms`
    });
    return {
      success: false,
      content: '',
      error: 'prompt必须是非空字符串'
    };
  }

  const {
    systemPrompt,
    timeoutMs = 60000,
    role = 'general_ai_assistant',
    provider: customProvider,
    model: customModel,
    apiKey: customApiKey,
    apiBaseUrl: customApiBaseUrl
  } = options;

  // 加载AI配置（优先使用自定义配置，否则使用存储的配置）
  const config = await loadAIConfig();
  
  const effectiveProvider = customProvider || config.provider;
  const effectiveModel = customModel || config.modelId;
  const effectiveApiKey = customApiKey || config.apiKey;
  const effectiveApiBaseUrl = customApiBaseUrl || config.apiBaseUrl;
  const effectiveSystemPrompt = systemPrompt || config.systemPrompt;

  const messageId = createMessageId();

  // 打印请求开始日志
  maLogger.log('[AI Request] 发起请求:', {
    messageId,
    promptPreview: prompt.length > 100 ? `${prompt.slice(0, 100)}...` : prompt,
    promptLength: prompt.length,
    provider: effectiveProvider,
    model: effectiveModel,
    role,
    timeout: timeoutMs,
    hasSystemPrompt: !!effectiveSystemPrompt,
    timestamp: new Date().toISOString()
  });

  return new Promise((resolve) => {
    // 记录请求完成日志的辅助函数（含分阶段耗时分析）
    const logAndResolve = (result: AIRequestResult): void => {
      const totalElapsed = Math.round(performance.now() - startTime);
      const ttfb = firstChunkTime ? Math.round(firstChunkTime - startTime) : null;
      const generationTime = firstChunkTime ? Math.round(performance.now() - firstChunkTime) : null;
      
      maLogger.log(`[AI Request] 请求${result.success ? '成功' : '失败'}:`, {
        messageId,
        status: result.success ? 'success' : 'failed',
        model: effectiveModel,
        provider: effectiveProvider,
        contentLength: result.content.length,
        contentPreview: result.content.length > 100 ? `${result.content.slice(0, 100)}...` : result.content,
        error: result.error || undefined,
        // 分阶段耗时分析
        breakdown: {
          total: `${totalElapsed}ms`,
          ttfb: ttfb !== null ? `${ttfb}ms` : 'N/A',  // 首包延迟 (Time To First Byte)
          generation: generationTime !== null ? `${generationTime}ms` : 'N/A',  // 内容生成耗时
          overhead: ttfb !== null ? `${ttfb}ms` : `${totalElapsed}ms`  // 连接/处理开销
        },
        timestamp: new Date().toISOString()
      });
      resolve(result);
    };

    // 检查是否在Chrome扩展环境中
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.connect) {
      logAndResolve({
        success: false,
        content: '',
        error: '当前环境不支持Chrome扩展API'
      });
      return;
    }

    // 创建与Background的端口连接
    const port = chrome.runtime.connect({ name: `ai-conversation-${messageId}` });

    let content = '';
    let settled = false;
    let firstChunkTime: number | null = null;

    /**
     * 完成请求，清理资源
     */
    const settle = (handler: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      try {
        port.disconnect();
      } catch {
        // Port可能已被关闭，忽略错误
      }
      handler();
    };

    /**
     * 超时处理
     */
    const timeoutId = window.setTimeout(() => {
      settle(() => {
        logAndResolve({
          success: false,
          content: content, // 返回已获取的部分内容
          error: `AI请求超时（${timeoutMs}ms）`
        });
      });
    }, timeoutMs);

    /**
     * 监听端口消息
     */
    port.onMessage.addListener((message) => {
      if (!message?.payload || message.payload.messageId !== messageId) {
        return;
      }

      // 流式数据
      if (message.type === 'AI_CONVERSATION_STREAM_DATA') {
        const chunk = message.payload.content || '';
        if (chunk) {
          content += chunk;
          // 首包日志 - 记录首次收到数据的时间
          if (!firstChunkTime) {
            firstChunkTime = performance.now();
            const ttfb = Math.round(firstChunkTime - startTime);
            maLogger.log('[AI Request] 首包延迟(TTFB):', {
              messageId,
              ttfb: `${ttfb}ms`,
              timestamp: new Date().toISOString()
            });
          }
        }
        return;
      }

      // 请求完成
      if (message.type === 'AI_CONVERSATION_COMPLETE') {
        settle(() => {
          if (content.trim()) {
            logAndResolve({
              success: true,
              content: content.trim()
            });
          } else {
            logAndResolve({
              success: false,
              content: '',
              error: 'AI没有返回有效内容'
            });
          }
        });
        return;
      }

      // 请求错误
      if (message.type === 'AI_CONVERSATION_ERROR') {
        settle(() => {
          logAndResolve({
            success: false,
            content: content, // 返回已获取的部分内容
            error: message.payload.error || 'AI请求失败'
          });
        });
      }
    });

    /**
     * 监听端口断开
     */
    port.onDisconnect.addListener(() => {
      if (!settled) {
        settle(() => {
          if (content.trim()) {
            // 如果已有内容，视为部分成功
            logAndResolve({
              success: true,
              content: content.trim()
            });
          } else {
            logAndResolve({
              success: false,
              content: '',
              error: 'AI连接已断开'
            });
          }
        });
      }
    });

    /**
     * 发送请求到Background
     */
    port.postMessage({
      type: 'START_AI_CONVERSATION',
      payload: {
        prompt: prompt.trim(),
        messageId,
        role,
        provider: effectiveProvider,
        model: effectiveModel,
        apiKey: effectiveApiKey,
        apiBaseUrl: effectiveApiBaseUrl,
        systemPrompt: effectiveSystemPrompt
      }
    });
  });
}

/**
 * 简化版AI调用函数
 * 直接返回AI回复字符串，失败时返回空字符串
 * 
 * @param prompt 用户输入的提示词
 * @param options 可选配置项
 * @returns Promise<string> AI回复内容
 * 
 * @example
 * ```typescript
 * const response = await requestAISimple('帮我写一段文案');
 * console.log(response); // 直接输出回复内容
 * ```
 */
export async function requestAISimple(
  prompt: string,
  options: AIRequestOptions = {}
): Promise<string> {
  const result = await requestAI(prompt, options);
  return result.success ? result.content : '';
}