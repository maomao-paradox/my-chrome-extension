export const DEFAULT_DEEPSEEK_API_BASE_URL = 'https://chat.deepseek.com';
export const DEFAULT_DEEPSEEK_AUTH_TOKEN = 'Bearer P70I3ehnpWiWHB5JZN/QZ0YxnDeBe+V9Fqo7BJvC9aGF7toyccrJ3GvKJsP30ff+';
export const DEFAULT_DEEPSEEK_COOKIES = 'HWWAFSESID=6ea6a784e4e664a3641; HWWAFSESTIME=1768275107500';
export const DEFAULT_DEEPSEEK_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
export const DEFAULT_DEEPSEEK_SESSION_COOKIE = 'ds_session_id=0d6cc1e66b6b48cc9aed13824ce482b3';

export interface SessionData {
    sessionId: string | null;
    parentMessageId: number | null;
}

export interface DeepSeekPowChallenge {
    algorithm: string;
    challenge: string;
    salt: string;
    difficulty: number;
    signature: string;
    expire_at?: number;
    expireAt?: number;
    [key: string]: unknown;
}

export interface DeepSeekStreamCallbacks {
    onData?: (data: string) => void;
    onError?: (error: unknown) => void;
    onComplete?: () => void;
}

export interface DeepSeekSessionStore {
    get(role: string): Promise<SessionData | null>;
    set(role: string, sessionData: SessionData): Promise<void>;
    clear(role: string): Promise<void>;
}

export interface DeepSeekPowSolver {
    solve(challenge: DeepSeekPowChallenge, context?: DeepSeekExecutionContext): Promise<string>;
}

export interface DeepSeekClientOptions {
    sessionStore: DeepSeekSessionStore;
    powSolver: DeepSeekPowSolver;
    apiBaseUrl?: string;
    authToken?: string;
    cookies?: string;
    userAgent?: string;
    createSessionCookie?: string;
    fetchImpl?: typeof fetch;
}

export interface DeepSeekExecutionContext {
    targetTabId?: number;
}

export interface DeepSeekCompletionOptions {
    prompt: string;
    chat_session_id: string;
    parent_message_id?: number | null;
}

interface DeepSeekRequestOptions {
    headers?: Record<string, string>;
    body?: string;
}

function createEmptyStreamError(source: string, rawSample: string): Error {
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

  return new Error(`${source} stream completed without content: ${detail}`);
}

function normalizeRole(role: string): string {
  return role || 'default_ai_assistant';
}

function isInvalidChatSessionError(error: unknown): boolean {
  return error instanceof Error
        && error.message.toLowerCase().includes('invalid chat session id');
}

function extractActualContent(content: string): string {
  let processedContent = content;

  for (const marker of ['FINISHED']) {
    if (processedContent.endsWith(marker)) {
      processedContent = processedContent.slice(0, -marker.length).trim();
    }
  }

  return processedContent;
}

function extractResponseSnapshotContent(payload: Record<string, unknown>): string {
  const snapshotContainer = payload.v;
  if (!snapshotContainer || typeof snapshotContainer !== 'object') {
    return '';
  }

  const response = (snapshotContainer as Record<string, unknown>).response;
  if (!response || typeof response !== 'object') {
    return '';
  }

  const content = (response as Record<string, unknown>).content;
  return typeof content === 'string' ? extractActualContent(content) : '';
}

function extractDeepSeekTextValue(value: unknown): string {
  if (typeof value === 'string') {
    return extractActualContent(value);
  }

  if (Array.isArray(value)) {
    return value.map(extractDeepSeekTextValue).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  return extractDeepSeekTextValue(record.content)
        || extractDeepSeekTextValue(record.text)
        || extractDeepSeekTextValue(record.answer)
        || extractDeepSeekTextValue(record.output_text)
        || extractDeepSeekTextValue(record.delta)
        || extractDeepSeekTextValue(record.message);
}

function parseDeepSeekDataPayload(payload: unknown): { content: string; isComplete: boolean } {
  let content = '';
  let isComplete = false;

  if (!payload || typeof payload !== 'object') {
    return { content, isComplete };
  }

  const json = payload as Record<string, unknown>;

  if (typeof json.v === 'string') {
    content += extractActualContent(json.v);
    return { content, isComplete };
  }

  if (typeof json.p === 'string' && json.p.includes('content')) {
    content += extractDeepSeekTextValue(json.v);
    return { content, isComplete };
  }

  const snapshotContent = extractResponseSnapshotContent(json);
  if (snapshotContent) {
    content += snapshotContent;
    return { content, isComplete };
  }

  if (json.p === 'response' && json.o === 'BATCH' && Array.isArray(json.v)) {
    for (const batchItem of json.v) {
      const parsedBatchItem = parseDeepSeekDataPayload(batchItem);
      content += parsedBatchItem.content;
      isComplete = isComplete || parsedBatchItem.isComplete;

      if (
        batchItem
                && typeof batchItem === 'object'
                && (batchItem as Record<string, unknown>).p === 'status'
                && (batchItem as Record<string, unknown>).v === 'FINISHED'
      ) {
        isComplete = true;
        break;
      }
    }
  }

  content += extractDeepSeekTextValue(json);

  return { content, isComplete };
}

export function parseDeepSeekStreamLines(lines: string[]): { content: string; isComplete: boolean } {
  let content = '';
  let isComplete = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    if (trimmedLine.startsWith('event: ')) {
      if (trimmedLine.slice(7) === 'finish') {
        isComplete = true;
      }
      continue;
    }

    if (!trimmedLine.startsWith('data: ')) {
      continue;
    }

    const jsonStr = trimmedLine.slice(6);

    try {
      const parsedPayload = parseDeepSeekDataPayload(JSON.parse(jsonStr));
      content += parsedPayload.content;
      isComplete = isComplete || parsedPayload.isComplete;
    } catch {
      // Ignore incomplete or malformed SSE frames.
    }
  }

  return { content, isComplete };
}

export function normalizeSystemPrompt(systemPrompt?: string): string {
  return typeof systemPrompt === 'string' ? systemPrompt.trim() : '';
}

export function buildPromptWithSystemPrompt(prompt: string, systemPrompt?: string): string {
  const normalizedSystemPrompt = normalizeSystemPrompt(systemPrompt);
  if (!normalizedSystemPrompt) {
    return prompt;
  }

  return [
    '[SYSTEM PROTOCOL]',
    normalizedSystemPrompt,
    '',
    '[USER REQUEST]',
    prompt
  ].join('\n');
}

function generateStreamId(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomValue = Math.random() * 16 | 0;
    const nextValue = char === 'x' ? randomValue : ((randomValue & 0x3) | 0x8);
    return nextValue.toString(16);
  });

  return `${year}${month}${day}-${uuid.replace(/-/g, '').slice(0, 16)}`;
}

function nextParentMessageId(currentParentMessageId: number | null): number {
  return currentParentMessageId === null ? 2 : currentParentMessageId + 2;
}

export class DeepSeekClient {
  private readonly sessionStore: DeepSeekSessionStore;
  private readonly powSolver: DeepSeekPowSolver;
  private readonly apiBaseUrl: string;
  private readonly authToken: string;
  private readonly cookies: string;
  private readonly userAgent: string;
  private readonly createSessionCookie: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DeepSeekClientOptions) {
    this.sessionStore = options.sessionStore;
    this.powSolver = options.powSolver;
    this.apiBaseUrl = options.apiBaseUrl || DEFAULT_DEEPSEEK_API_BASE_URL;
    this.authToken = options.authToken || DEFAULT_DEEPSEEK_AUTH_TOKEN;
    this.cookies = options.cookies || DEFAULT_DEEPSEEK_COOKIES;
    this.userAgent = options.userAgent || DEFAULT_DEEPSEEK_USER_AGENT;
    this.createSessionCookie = options.createSessionCookie || DEFAULT_DEEPSEEK_SESSION_COOKIE;
    const resolvedFetch = options.fetchImpl || globalThis.fetch;
    this.fetchImpl = resolvedFetch.bind(globalThis) as typeof fetch;
  }

  async clearSessionData(role: string): Promise<void> {
    await this.sessionStore.clear(normalizeRole(role));
  }

  async createSession(): Promise<unknown> {
    return this.sendRequest('/api/v0/chat_session/create', {
      headers: {
        Cookie: `${this.cookies}; ${this.createSessionCookie}`
      }
    });
  }

  async createPowChallenge(): Promise<unknown> {
    return this.sendRequest('/api/v0/chat/create_pow_challenge', {
      body: JSON.stringify({ target_path: '/api/v0/chat/completion' })
    });
  }

  async completion(
    options: DeepSeekCompletionOptions,
    powResponse: string,
    callbacks?: DeepSeekStreamCallbacks
  ): Promise<unknown> {
    const body = JSON.stringify({
      ...options,
      ref_file_ids: [],
      thinking_enabled: false,
      search_enabled: false,
      client_stream_id: generateStreamId()
    });

    if (callbacks?.onData) {
      await this.sendStreamingRequest('/api/v0/chat/completion', {
        headers: { 'x-ds-pow-response': powResponse },
        body
      }, callbacks);
      return null;
    }

    return this.sendRequest('/api/v0/chat/completion', {
      headers: { 'x-ds-pow-response': powResponse },
      body
    });
  }

  async completeChatFlow(
    prompt: string,
    role: string,
    callbacks?: DeepSeekStreamCallbacks,
    systemPrompt?: string,
    context?: DeepSeekExecutionContext
  ): Promise<unknown> {
    const normalizedRole = normalizeRole(role);
    const preparedPrompt = buildPromptWithSystemPrompt(prompt, systemPrompt);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        let sessionData = await this.getSessionData(normalizedRole);

        if (!sessionData.sessionId) {
          const createSessionResult = await this.createSession() as {
                        data?: { biz_data?: { id?: string } };
                    };
          const newSessionId = createSessionResult?.data?.biz_data?.id;
          if (!newSessionId) {
            throw new Error('Failed to create session');
          }

          sessionData = await this.updateSessionData(normalizedRole, { sessionId: newSessionId });
        }

        const challengeResponse = await this.createPowChallenge() as {
                    data?: { biz_data?: { challenge?: DeepSeekPowChallenge } };
                };
        const challenge = challengeResponse?.data?.biz_data?.challenge;
        if (!challenge) {
          throw new Error('Failed to create POW challenge');
        }

        const powResponse = await this.powSolver.solve(challenge, context);
        if (!powResponse) {
          throw new Error('Failed to generate POW response');
        }

        const currentParentMessageId = sessionData.parentMessageId;
        const sessionId = sessionData.sessionId;
        if (!sessionId) {
          throw new Error('DeepSeek session is missing after initialization');
        }

        const response = await this.completion(
          {
            prompt: preparedPrompt,
            chat_session_id: sessionId,
            parent_message_id: currentParentMessageId
          },
          powResponse,
          callbacks
        );

        await this.updateSessionData(normalizedRole, {
          parentMessageId: nextParentMessageId(currentParentMessageId)
        });

        callbacks?.onComplete?.();
        return response;
      } catch (error) {
        if (attempt === 0 && isInvalidChatSessionError(error)) {
          await this.clearSessionData(normalizedRole);
          continue;
        }

        callbacks?.onError?.(error);
        throw error;
      }
    }

    throw new Error('DeepSeek chat flow failed after retry');
  }

  async sendStreamingRequest(
    endpoint: string,
    options: DeepSeekRequestOptions,
    callbacks: DeepSeekStreamCallbacks
  ): Promise<void> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers = this.createRequestHeaders(options.headers || {});
    const body = options.body || JSON.stringify({});

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let pendingBuffer = '';
    let isCompleted = false;
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

        const parsed = parseDeepSeekStreamLines(segments);
        if (parsed.content) {
          hasContent = true;
          callbacks.onData?.(parsed.content);
        }
        if (parsed.isComplete) {
          isCompleted = true;
        }
      }

      if (done) {
        if (pendingBuffer.trim()) {
          const finalParsed = parseDeepSeekStreamLines([pendingBuffer]);
          if (finalParsed.content) {
            hasContent = true;
            callbacks.onData?.(finalParsed.content);
          }
          if (finalParsed.isComplete) {
            isCompleted = true;
          }
        }
        break;
      }
    }

    if (!isCompleted) {
      // Some DeepSeek responses end by closing the stream without a finish event.
      isCompleted = true;
    }

    if (!hasContent) {
      throw createEmptyStreamError('DeepSeek', rawSample);
    }
  }

  private async getSessionData(role: string): Promise<SessionData> {
    return (await this.sessionStore.get(role)) || { sessionId: '', parentMessageId: null };
  }

  private async updateSessionData(role: string, updates: Partial<SessionData>): Promise<SessionData> {
    const currentSessionData = await this.getSessionData(role);
    const nextSessionData: SessionData = {
      ...currentSessionData,
      ...updates
    };

    await this.sessionStore.set(role, nextSessionData);
    return nextSessionData;
  }

  private createRequestHeaders(customHeaders: Record<string, string> = {}): Headers {
    const headers = new Headers();
    const apiHost = this.resolveApiHost();
    headers.set('Authorization', this.authToken);
    headers.set('User-Agent', this.userAgent);
    headers.set('Accept', '*/*');
    headers.set('Host', apiHost);
    headers.set('Connection', 'keep-alive');
    headers.set('Cookie', this.cookies);
    headers.set('Content-Type', 'application/json');

    for (const [header, value] of Object.entries(customHeaders)) {
      headers.set(header, value);
    }

    return headers;
  }

  private resolveApiHost(): string {
    try {
      return new URL(this.apiBaseUrl).host;
    } catch {
      return 'chat.deepseek.com';
    }
  }

  private async sendRequest(endpoint: string, options: DeepSeekRequestOptions = {}): Promise<unknown> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.createRequestHeaders(options.headers || {}),
      redirect: 'follow',
      body: options.body || JSON.stringify({})
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`DeepSeek request failed with status ${response.status}: ${responseText}`);
    }

    return responseText ? JSON.parse(responseText) : null;
  }
}
