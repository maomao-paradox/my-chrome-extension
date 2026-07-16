import { sendMessageToContentScript } from '@/message';
import {
  DeepSeekClient,
  type DeepSeekExecutionContext,
  normalizeSystemPrompt,
  type DeepSeekCompletionOptions,
  type DeepSeekPowChallenge,
  type DeepSeekPowSolver,
  type DeepSeekSessionStore,
  type DeepSeekStreamCallbacks,
  type SessionData
} from '@/shared/deepseek-core';
import { powWasmModule } from './wasm-utils';

const POW_WORKER_SCRIPT_PATH = 'static/js/workers/pow-worker.min.js';
const POW_WORKER_WASM_PATH = 'static/wasm/sha3_wasm_bg.7b9ca65ddd.wasm';
const OPENAI_COMPATIBLE_ENDPOINT = '/chat/completions';
const ANTHROPIC_ENDPOINT = '/messages';

class ChromeSessionStore implements DeepSeekSessionStore {
  private readonly roleSessionMap = new Map<string, SessionData>();

  async get(role: string): Promise<SessionData | null> {
    const roleKey = this.normalizeRole(role);
    const cachedSessionData = this.roleSessionMap.get(roleKey);
    if (cachedSessionData) {
      return cachedSessionData;
    }

    try {
      const sessionKey = `deepseek_session_id_${roleKey}`;
      const parentIdKey = `deepseek_parent_message_id_${roleKey}`;
      const result = await chrome.storage.local.get([sessionKey, parentIdKey]);
      const sessionData: SessionData = {
        sessionId: result[sessionKey] as string || '',
        parentMessageId: result[parentIdKey] !== undefined ? result[parentIdKey] as number : null
      };

      this.roleSessionMap.set(roleKey, sessionData);
      return sessionData;
    } catch (error) {
      console.error('Error loading persisted data:', error);
      const defaultSessionData: SessionData = { sessionId: '', parentMessageId: null };
      this.roleSessionMap.set(roleKey, defaultSessionData);
      return defaultSessionData;
    }
  }

  async set(role: string, sessionData: SessionData): Promise<void> {
    const roleKey = this.normalizeRole(role);
    this.roleSessionMap.set(roleKey, sessionData);

    try {
      const sessionKey = `deepseek_session_id_${roleKey}`;
      const parentIdKey = `deepseek_parent_message_id_${roleKey}`;
      await chrome.storage.local.set({
        [sessionKey]: sessionData.sessionId,
        [parentIdKey]: sessionData.parentMessageId
      });
    } catch (error) {
      console.error('Error saving persisted data:', error);
    }
  }

  async clear(role: string): Promise<void> {
    const roleKey = this.normalizeRole(role);
    this.roleSessionMap.delete(roleKey);

    try {
      const sessionKey = `deepseek_session_id_${roleKey}`;
      const parentIdKey = `deepseek_parent_message_id_${roleKey}`;
      await chrome.storage.local.remove([sessionKey, parentIdKey]);
      console.log(`Session data cleared for role: ${roleKey}`);
    } catch (error) {
      console.error('Error clearing session data:', error);
    }
  }

  private normalizeRole(role: string): string {
    return role || 'default_ai_assistant';
  }
}

class DirectPowSolver implements DeepSeekPowSolver {
  async solve(challenge: DeepSeekPowChallenge, _context?: DeepSeekExecutionContext): Promise<string> {
    const { algorithm, challenge: challengeData, salt, difficulty, expireAt, signature } = challenge;

    await powWasmModule.load();

    const answer = powWasmModule.solve(
      algorithm,
      challengeData,
      salt,
      difficulty,
      expireAt ?? challenge.expire_at ?? Date.now()
    );

    if (typeof answer !== 'number') {
      throw new Error('No solution found');
    }

    return btoa(unescape(encodeURIComponent(JSON.stringify({
      algorithm,
      challenge: challengeData,
      salt,
      answer,
      signature,
      target_path: '/api/v0/chat/completion'
    }))));
  }
}

class BackgroundPowSolver implements DeepSeekPowSolver {
  private workerSourcePromise: Promise<string> | null = null;

  async solve(challenge: DeepSeekPowChallenge): Promise<string> {
    if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL.createObjectURL !== 'function') {
      throw new Error('Background POW worker is unavailable');
    }

    const workerSource = await this.getWorkerSource();
    const blobUrl = URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' }));

    return new Promise((resolve, reject) => {
      const worker = new Worker(blobUrl);
      let settled = false;

      const settle = (result: Error | string) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        URL.revokeObjectURL(blobUrl);
        worker.terminate();

        if (result instanceof Error) {
          reject(result);
          return;
        }

        resolve(result);
      };

      const timeoutId = setTimeout(() => {
        settle(new Error('POW calculation timeout'));
      }, 30000);

      worker.onmessage = (event: MessageEvent) => {
        const payload = event.data as Record<string, unknown> | null;
        if (!payload || typeof payload !== 'object') {
          return;
        }

        if (payload.type === 'pow-answer') {
          const answerPayload = payload.answer as Record<string, unknown> | undefined;
          if (!answerPayload) {
            settle(new Error('POW worker returned an empty answer'));
            return;
          }

          settle(
            btoa(unescape(encodeURIComponent(JSON.stringify({
              ...answerPayload,
              target_path: '/api/v0/chat/completion'
            }))))
          );
          return;
        }

        if (payload.type === 'pow-error') {
          const message = typeof payload.error === 'string'
            ? payload.error
            : 'POW calculation failed';
          settle(new Error(message));
        }
      };

      worker.onerror = (event) => {
        settle(new Error(event.message || 'POW worker failed'));
      };

      worker.postMessage({
        type: 'pow-challenge',
        wasmUrl: chrome.runtime.getURL(POW_WORKER_WASM_PATH),
        challenge: {
          ...challenge,
          expireAt: challenge.expireAt ?? challenge.expire_at
        }
      });
    });
  }

  private async getWorkerSource(): Promise<string> {
    if (!this.workerSourcePromise) {
      this.workerSourcePromise = fetch(chrome.runtime.getURL(POW_WORKER_SCRIPT_PATH))
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load POW worker: ${response.status}`);
          }

          return response.text();
        });
    }

    return this.workerSourcePromise;
  }
}

class ContentScriptPowSolver implements DeepSeekPowSolver {
  async solve(challenge: DeepSeekPowChallenge, context?: DeepSeekExecutionContext): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const finish = (handler: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        handler();
      };

      try {
        sendMessageToContentScript({
          type: 'CALCULATE_POW',
          payload: { challenge },
          target: 'content'
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to content script:', chrome.runtime.lastError);
            finish(() => reject(new Error(`POW calculation transport failed: ${chrome.runtime.lastError?.message || 'unknown error'}`)));
            return;
          }

          if (response?.success) {
            finish(() => resolve(response.powResponse));
            return;
          }

          finish(() => reject(new Error(`POW calculation failed: ${response?.msg || 'unknown error'}`)));
        }, {
          preferredTabId: context?.targetTabId
        }).catch((error) => {
          finish(() => reject(error));
        });

        setTimeout(() => {
          finish(() => reject(new Error('POW calculation timeout')));
        }, 30000);
      } catch (error) {
        console.error('Error in testPOW:', error);
        finish(() => reject(error));
      }
    });
  }
}

class FallbackPowSolver implements DeepSeekPowSolver {
  private readonly solvers: Array<{ name: string; solver: DeepSeekPowSolver }> = [
    { name: 'direct', solver: new DirectPowSolver() },
    { name: 'background', solver: new BackgroundPowSolver() },
    { name: 'content-script', solver: new ContentScriptPowSolver() }
  ];

  async solve(challenge: DeepSeekPowChallenge, context?: DeepSeekExecutionContext): Promise<string> {
    let lastError: unknown;

    for (const entry of this.solvers) {
      try {
        return await entry.solver.solve(challenge, context);
      } catch (error) {
        lastError = error;
        console.warn(`[DeepSeek] ${entry.name} POW solver failed:`, error);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('POW calculation failed');
  }
}

const deepSeekPowSolver = new FallbackPowSolver();

const deepSeekClient = new DeepSeekClient({
  sessionStore: new ChromeSessionStore(),
  powSolver: deepSeekPowSolver
});

export async function clearSessionData(role: string): Promise<void> {
  await deepSeekClient.clearSessionData(role);
}

export async function testPOW(challenge: DeepSeekPowChallenge): Promise<string> {
  return deepSeekPowSolver.solve(challenge);
}

export async function sendStreamingRequest(
  endpoint: string,
  options: { headers?: Record<string, string>; body?: string },
  onData: (data: string) => void,
  onError: (error: unknown) => void,
  onComplete: () => void
): Promise<void> {
  try {
    await deepSeekClient.sendStreamingRequest(endpoint, options, { onData });
    onComplete();
  } catch (error) {
    onError(error);
  }
}

export async function createSession(): Promise<unknown> {
  return deepSeekClient.createSession();
}

export async function createPowChallenge(): Promise<unknown> {
  return deepSeekClient.createPowChallenge();
}

export async function completion(
  options: DeepSeekCompletionOptions,
  powResponse: string,
  onData?: (data: string) => void,
  onError?: (error: unknown) => void,
  onComplete?: () => void
): Promise<unknown> {
  try {
    const result = await deepSeekClient.completion(options, powResponse, { onData });
    onComplete?.();
    return result;
  } catch (error) {
    onError?.(error);
    throw error;
  }
}

export async function completeChatFlow(
  prompt: string,
  role: string,
  callbacks?: DeepSeekStreamCallbacks,
  provider?: string,
  model?: string,
  apiKey?: string,
  apiBaseUrl?: string,
  systemPrompt?: string,
  targetTabId?: number
): Promise<unknown> {
  const standardProviders = ['openai', 'anthropic', 'google', 'deepseek'];
  const effectiveProvider = provider || 'deepseek';

  if (standardProviders.includes(effectiveProvider)) {
    switch (effectiveProvider) {
      case 'openai':
      case 'anthropic':
      case 'google':
        return await callGenericAIAPI(prompt, effectiveProvider, model, apiKey, apiBaseUrl, callbacks, systemPrompt);
      case 'deepseek':
      default:
        return await deepSeekClient.completeChatFlow(prompt, role, callbacks, systemPrompt, { targetTabId });
    }
  }

  return await callGenericAIAPI(prompt, 'custom', model, apiKey, apiBaseUrl, callbacks, systemPrompt);
}

async function callGenericAIAPI(
  prompt: string,
  provider: string,
  model: string | undefined,
  apiKey: string | undefined,
  apiBaseUrl: string | undefined,
  callbacks?: DeepSeekStreamCallbacks,
  systemPrompt?: string
): Promise<null> {
  try {
    if (!model) {
      throw new Error(`Model ID is required for ${provider}`);
    }

    const normalizedSystemPrompt = normalizeSystemPrompt(systemPrompt);

    const requiresApiKey = provider !== 'custom';
    if (requiresApiKey && !apiKey) {
      throw new Error(`API key is required for ${provider}`);
    }

    let baseUrl = normalizeApiBaseUrl(apiBaseUrl);
    if (!baseUrl) {
      switch (provider) {
        case 'openai':
          baseUrl = 'https://api.openai.com/v1';
          break;
        case 'anthropic':
          baseUrl = 'https://api.anthropic.com/v1';
          break;
        case 'google':
          baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
          break;
        default:
          throw new Error('API base URL is required for custom providers');
      }
    }

    let endpoint = '';
    let requestBody: Record<string, unknown> = {};
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'text/event-stream, application/json');

    switch (provider) {
      case 'openai':
        endpoint = OPENAI_COMPATIBLE_ENDPOINT;
        headers.append('Authorization', `Bearer ${apiKey}`);
        requestBody = {
          model,
          messages: normalizedSystemPrompt
            ? [{ role: 'system', content: normalizedSystemPrompt }, { role: 'user', content: prompt }]
            : [{ role: 'user', content: prompt }],
          stream: true
        };
        break;
      case 'anthropic':
        endpoint = ANTHROPIC_ENDPOINT;
        headers.append('x-api-key', apiKey!);
        headers.append('anthropic-version', '2023-06-01');
        requestBody = {
          model,
          system: normalizedSystemPrompt || undefined,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          max_tokens: 1024
        };
        break;
      case 'google':
        endpoint = `/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
        requestBody = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: normalizedSystemPrompt
            ? { parts: [{ text: normalizedSystemPrompt }] }
            : undefined
        };
        break;
      case 'custom':
      default:
        endpoint = OPENAI_COMPATIBLE_ENDPOINT;
        if (apiKey) {
          headers.append('Authorization', `Bearer ${apiKey}`);
        }
        requestBody = {
          model,
          messages: normalizedSystemPrompt
            ? [{ role: 'system', content: normalizedSystemPrompt }, { role: 'user', content: prompt }]
            : [{ role: 'user', content: prompt }],
          stream: true
        };
        break;
    }

    const response = await fetch(buildRequestUrl(baseUrl, endpoint, provider), {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      redirect: 'follow'
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP error ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let pendingBuffer = '';
    let hasContent = false;
    let rawSample = '';

    while (true) {
      const { value, done } = await reader.read();

      if (value) {
        const decodedChunk = decoder.decode(value, { stream: !done });
        rawSample = (rawSample + decodedChunk).slice(0, 4000);
        pendingBuffer += decodedChunk;
        const segments = pendingBuffer.split('\n');
        pendingBuffer = segments.pop() || '';

        const parsedContent = parseGenericStream(segments.join('\n'), provider);
        if (parsedContent) {
          hasContent = true;
          callbacks?.onData?.(parsedContent);
        }
      }

      if (done) {
        if (pendingBuffer.trim()) {
          const parsedContent = parseGenericStream(pendingBuffer, provider);
          if (parsedContent) {
            hasContent = true;
            callbacks?.onData?.(parsedContent);
          }
        }
        break;
      }
    }

    if (!hasContent) {
      throw createEmptyGenericStreamError(provider, rawSample);
    }

    callbacks?.onComplete?.();
    return null;
  } catch (error) {
    callbacks?.onError?.(error);
    throw error;
  }
}

function createEmptyGenericStreamError(provider: string, rawSample: string): Error {
  const normalizedSample = rawSample.trim().replace(/\s+/g, ' ').slice(0, 800);
  let detail = normalizedSample || 'empty response body';

  try {
    const parsed = JSON.parse(rawSample) as Record<string, unknown>;
    const message = parsed.message || parsed.msg || parsed.error || parsed.code;
    if (message) {
      detail = String(message);
    }
  } catch {
    // Keep the raw sample when the body is not JSON.
  }

  return new Error(`${provider} stream completed without content: ${detail}`);
}

function parseGenericStream(data: string, provider: string): string {
  let content = '';

  for (const line of data.split('\n')) {
    const payload = extractStreamPayload(line);
    if (!payload) {
      continue;
    }

    try {
      const json = JSON.parse(payload) as Record<string, unknown>;
      content += extractResponseText(json, provider);
    } catch {
      // Ignore malformed SSE frames.
    }
  }

  return content;
}

function normalizeApiBaseUrl(apiBaseUrl?: string): string {
  return (apiBaseUrl || '').trim().replace(/\/+$/, '');
}

function buildRequestUrl(baseUrl: string, endpoint: string, provider: string): string {
  if (provider === 'google') {
    return `${baseUrl}${endpoint}`;
  }

  return matchesEndpoint(baseUrl, endpoint)
    ? baseUrl
    : `${baseUrl}${endpoint}`;
}

function matchesEndpoint(baseUrl: string, endpoint: string): boolean {
  try {
    return new URL(baseUrl).pathname.endsWith(endpoint);
  } catch {
    return baseUrl.endsWith(endpoint);
  }
}

function extractStreamPayload(line: string): string | null {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine === 'data: [DONE]' || trimmedLine === '[DONE]') {
    return null;
  }

  if (trimmedLine.startsWith('event: ') || trimmedLine.startsWith(':')) {
    return null;
  }

  if (trimmedLine.startsWith('data: ')) {
    return trimmedLine.slice(6);
  }

  return trimmedLine;
}

function extractResponseText(payload: Record<string, unknown>, provider: string): string {
  switch (provider) {
    case 'anthropic':
      return extractAnthropicText(payload);
    case 'google':
      return extractGoogleText(payload);
    case 'openai':
    case 'custom':
    default:
      return extractOpenAICompatibleText(payload);
  }
}

function extractOpenAICompatibleText(payload: Record<string, unknown>): string {
  const firstChoice = Array.isArray(payload.choices) ? payload.choices[0] as Record<string, unknown> | undefined : undefined;
  if (firstChoice) {
    return extractTextValue(firstChoice.delta)
            || extractTextValue(firstChoice.message)
            || extractTextValue(firstChoice.text);
  }

  return extractTextValue(payload.output)
        || extractTextValue(payload.output_text)
        || extractTextValue(payload.content);
}

function extractAnthropicText(payload: Record<string, unknown>): string {
  if (payload.type === 'content_block_delta') {
    return extractTextValue(payload.delta);
  }

  if (payload.type === 'content_block_start') {
    return extractTextValue(payload.content_block);
  }

  return extractTextValue(payload.message);
}

function extractGoogleText(payload: Record<string, unknown>): string {
  const firstCandidate = Array.isArray(payload.candidates)
    ? payload.candidates[0] as Record<string, unknown> | undefined
    : undefined;

  return extractTextValue(firstCandidate?.content)
        || extractTextValue(firstCandidate)
        || extractTextValue(payload.promptFeedback);
}

function extractTextValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractTextValue).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  return extractTextValue(record.text)
        || extractTextValue(record.content)
        || extractTextValue(record.output_text)
        || extractTextValue(record.parts)
        || extractTextValue(record.delta);
}
