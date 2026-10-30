import { ensureDeepSeekCredentials } from "../background/deepseek-credentials";
import {
  DeepSeekClient,
  normalizeSystemPrompt,
  type DeepSeekCompletionOptions,
  type DeepSeekPowChallenge,
  type DeepSeekPowSolver,
  type DeepSeekSessionStore,
  type DeepSeekStreamCallbacks,
  type SessionData,
} from "./deepseek-core";
import { powWasmModule } from "./pow";
import {
  appendOpenAIToolCallDeltas,
  finalizeOpenAIToolCalls,
  type OpenAIToolCallDelta,
} from "./openai-tool-calls";
import {
  buildOpenAICompatibleRequestBody,
  type OpenAICompatibleRequestOptions,
} from "./openai-request";

const OPENAI_COMPATIBLE_ENDPOINT = "/chat/completions";
const ANTHROPIC_ENDPOINT = "/messages";

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
        sessionId: (result[sessionKey] as string) || "",
        parentMessageId:
          result[parentIdKey] !== undefined
            ? (result[parentIdKey] as number)
            : null,
      };

      this.roleSessionMap.set(roleKey, sessionData);
      return sessionData;
    } catch (error) {
      console.error("Error loading persisted data:", error);
      const defaultSessionData: SessionData = {
        sessionId: "",
        parentMessageId: null,
      };
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
        [parentIdKey]: sessionData.parentMessageId,
      });
    } catch (error) {
      console.error("Error saving persisted data:", error);
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
      console.error("Error clearing session data:", error);
    }
  }

  private normalizeRole(role: string): string {
    return role || "default_ai_assistant";
  }
}

class DirectPowSolver implements DeepSeekPowSolver {
  /** 默认的 PoW 保护目标路径 */
  private static readonly DEFAULT_TARGET_PATH = "/api/v0/chat/completion";

  async solve(
    challenge: DeepSeekPowChallenge,
    targetPath?: string,
  ): Promise<string> {
    const {
      algorithm,
      challenge: challengeData,
      salt,
      difficulty,
      expireAt,
      signature,
    } = challenge;

    await powWasmModule.load();

    const answer = powWasmModule.solve(
      algorithm,
      challengeData,
      salt,
      difficulty,
      expireAt ?? challenge.expire_at ?? Date.now(),
    );

    if (typeof answer !== "number") {
      throw new Error("No solution found");
    }

    // 优先使用调用方传入的 targetPath，其次读取 challenge 中的，最后用默认值
    const resolvedTargetPath =
      targetPath ??
      (challenge.target_path as string | undefined) ??
      DirectPowSolver.DEFAULT_TARGET_PATH;

    return btoa(
      unescape(
        encodeURIComponent(
          JSON.stringify({
            algorithm,
            challenge: challengeData,
            salt,
            answer,
            signature,
            target_path: resolvedTargetPath,
          }),
        ),
      ),
    );
  }
}

const deepSeekPowSolver = new DirectPowSolver();

const deepSeekSessionStore = new ChromeSessionStore();

async function getConfiguredDeepSeekClient(): Promise<DeepSeekClient> {
  const config = await ensureDeepSeekCredentials();
  return new DeepSeekClient({
    sessionStore: deepSeekSessionStore,
    powSolver: deepSeekPowSolver,
    authToken: config.deepseekAuthToken,
    cookies: config.deepseekCookies,
  });
}

export async function clearSessionData(role: string): Promise<void> {
  await deepSeekSessionStore.clear(role);
}

export async function testPOW(
  challenge: DeepSeekPowChallenge,
  targetPath?: string,
): Promise<string> {
  return deepSeekPowSolver.solve(challenge, targetPath);
}

export async function sendStreamingRequest(
  endpoint: string,
  options: { headers?: Record<string, string>; body?: string },
  onData: (data: string) => void,
  onError: (error: unknown) => void,
  onComplete: () => void,
): Promise<void> {
  try {
    await (
      await getConfiguredDeepSeekClient()
    ).sendStreamingRequest(endpoint, options, { onData });
    onComplete();
  } catch (error) {
    onError(error);
  }
}

export async function createSession(): Promise<unknown> {
  return (await getConfiguredDeepSeekClient()).createSession();
}

export async function createPowChallenge(
  targetPath = "/api/v0/chat/completion",
): Promise<unknown> {
  return (await getConfiguredDeepSeekClient()).createPowChallenge(targetPath);
}

/**
 * 上传文件到 DeepSeek（走 PoW 保护流程）
 * 服务端要求 multipart/form-data，字段名 `file`，并按文件名后缀识别类型
 * @param fileData 文件二进制数据
 * @param contentType 文件 MIME 类型，默认 image/png
 * @param fileName 上传文件名（需带 png/jpg/jpeg/webp/gif 后缀），默认 image.png
 * @returns 上传成功后的文件 ID（如 "file-xxx-xxx"）
 */
export async function uploadFile(
  fileData: ArrayBuffer | Uint8Array | Blob,
  contentType = "image/png",
  fileName = "image.png",
): Promise<string> {
  return (await getConfiguredDeepSeekClient()).uploadFile(
    fileData,
    contentType,
    fileName,
  );
}

export async function completion(
  options: DeepSeekCompletionOptions,
  powResponse: string,
  onData?: (data: string) => void,
  onError?: (error: unknown) => void,
  onComplete?: () => void,
): Promise<unknown> {
  try {
    const result = await (
      await getConfiguredDeepSeekClient()
    ).completion(options, powResponse, { onData });
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
  options?: OpenAICompatibleRequestOptions & { targetTabId?: number },
  /** 可选：已上传文件的 file_id 列表，用于在对话中引用图片 */
  fileIds?: string[],
): Promise<unknown> {
  const standardProviders = ["openai", "anthropic", "google", "deepseek"];
  const effectiveProvider = provider || "deepseek";

  if (options?.tools?.length && ["anthropic", "google"].includes(effectiveProvider)) {
    throw new Error(
      `当前 ${effectiveProvider} 链路暂不支持 WebMCP 工具调用。请在 AI 设置中选择 DeepSeek、OpenAI 或兼容 API。`,
    );
  }
  if (standardProviders.includes(effectiveProvider)) {
    switch (effectiveProvider) {
      case "openai":
      case "anthropic":
      case "google":
        return await callGenericAIAPI(
          prompt,
          effectiveProvider,
          model,
          apiKey,
          apiBaseUrl,
          callbacks,
          systemPrompt,
          options,
        );
      case "deepseek":
      default:
        return await (
          await getConfiguredDeepSeekClient()
        ).completeChatFlow(
          prompt,
          role,
          callbacks,
          systemPrompt,
          options?.tools,
          fileIds,
        );
    }
  }

  return await callGenericAIAPI(
    prompt,
    "custom",
    model,
    apiKey,
    apiBaseUrl,
    callbacks,
    systemPrompt,
    options,
  );
}

async function callGenericAIAPI(
  prompt: string,
  provider: string,
  model: string | undefined,
  apiKey: string | undefined,
  apiBaseUrl: string | undefined,
  callbacks?: DeepSeekStreamCallbacks,
  systemPrompt?: string,
  options?: OpenAICompatibleRequestOptions,
): Promise<null> {
  try {
    if (!model) {
      throw new Error(`Model ID is required for ${provider}`);
    }

    const normalizedSystemPrompt = normalizeSystemPrompt(systemPrompt);

    const requiresApiKey = provider !== "custom";
    if (requiresApiKey && !apiKey) {
      throw new Error(`API key is required for ${provider}`);
    }

    let baseUrl = normalizeApiBaseUrl(apiBaseUrl);
    if (!baseUrl) {
      switch (provider) {
        case "deepseek":
          baseUrl = "https://api.deepseek.com";
          break;
        case "openai":
          baseUrl = "https://api.openai.com/v1";
          break;
        case "anthropic":
          baseUrl = "https://api.anthropic.com/v1";
          break;
        case "google":
          baseUrl = "https://generativelanguage.googleapis.com/v1beta";
          break;
        default:
          throw new Error("API base URL is required for custom providers");
      }
    }

    let endpoint = "";
    let requestBody: Record<string, unknown> = {};
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Accept", "text/event-stream, application/json");

    switch (provider) {
      case "deepseek":
      case "openai":
        endpoint = OPENAI_COMPATIBLE_ENDPOINT;
        headers.append("Authorization", `Bearer ${apiKey}`);
        requestBody = buildOpenAICompatibleRequestBody(
          model,
          prompt,
          normalizedSystemPrompt,
          options,
        );
        break;
      case "anthropic":
        endpoint = ANTHROPIC_ENDPOINT;
        headers.append("x-api-key", apiKey!);
        headers.append("anthropic-version", "2023-06-01");
        requestBody = {
          model,
          system: normalizedSystemPrompt || undefined,
          messages: [{ role: "user", content: prompt }],
          stream: true,
          max_tokens: 1024,
        };
        break;
      case "google":
        endpoint = `/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
        requestBody = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: normalizedSystemPrompt
            ? { parts: [{ text: normalizedSystemPrompt }] }
            : undefined,
        };
        break;
      case "custom":
      default:
        endpoint = OPENAI_COMPATIBLE_ENDPOINT;
        if (apiKey) {
          headers.append("Authorization", `Bearer ${apiKey}`);
        }
        requestBody = buildOpenAICompatibleRequestBody(
          model,
          prompt,
          normalizedSystemPrompt,
          options,
        );
        break;
    }

    const response = await fetch(buildRequestUrl(baseUrl, endpoint, provider), {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      redirect: "follow",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `HTTP error ${response.status}${errorText ? `: ${errorText}` : ""}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let pendingBuffer = "";
    let hasContent = false;
    let rawSample = "";
    let streamedContent = "";
    const toolCallDeltas = new Map<number, OpenAIToolCallDelta>();

    while (true) {
      const { value, done } = await reader.read();

      if (value) {
        const decodedChunk = decoder.decode(value, { stream: !done });
        rawSample = (rawSample + decodedChunk).slice(0, 4000);
        pendingBuffer += decodedChunk;
        const segments = pendingBuffer.split("\n");
        pendingBuffer = segments.pop() || "";

        const parsedContent = parseGenericStream(
          segments.join("\n"),
          provider,
          toolCallDeltas,
        );
        if (parsedContent) {
          hasContent = true;
          streamedContent += parsedContent;
          callbacks?.onData?.(parsedContent);
        }
      }

      if (done) {
        if (pendingBuffer.trim()) {
          const parsedContent = parseGenericStream(
            pendingBuffer,
            provider,
            toolCallDeltas,
          );
          if (parsedContent) {
            hasContent = true;
            streamedContent += parsedContent;
            callbacks?.onData?.(parsedContent);
          }
        }
        break;
      }
    }

    const functionCalls = finalizeOpenAIToolCalls(toolCallDeltas);
    if (!hasContent && functionCalls.length === 0) {
      throw createEmptyGenericStreamError(provider, rawSample);
    }

    callbacks?.onComplete?.({ text: streamedContent, functionCalls });
    return null;
  } catch (error) {
    callbacks?.onError?.(error);
    throw error;
  }
}

function createEmptyGenericStreamError(
  provider: string,
  rawSample: string,
): Error {
  const normalizedSample = rawSample.trim().replace(/\s+/g, " ").slice(0, 800);
  let detail = normalizedSample || "empty response body";

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

function parseGenericStream(
  data: string,
  provider: string,
  toolCallDeltas: Map<number, OpenAIToolCallDelta>,
): string {
  let content = "";

  for (const line of data.split("\n")) {
    const payload = extractStreamPayload(line);
    if (!payload) {
      continue;
    }

    try {
      const json = JSON.parse(payload) as Record<string, unknown>;
      if (provider !== "anthropic" && provider !== "google") {
        appendOpenAIToolCallDeltas(json, toolCallDeltas);
      }
      content += extractResponseText(json, provider);
    } catch {
      // Ignore malformed SSE frames.
    }
  }

  return content;
}

function normalizeApiBaseUrl(apiBaseUrl?: string): string {
  return (apiBaseUrl || "").trim().replace(/\/+$/, "");
}

function buildRequestUrl(
  baseUrl: string,
  endpoint: string,
  provider: string,
): string {
  if (provider === "google") {
    return `${baseUrl}${endpoint}`;
  }

  return matchesEndpoint(baseUrl, endpoint) ? baseUrl : `${baseUrl}${endpoint}`;
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

  if (
    !trimmedLine ||
    trimmedLine === "data: [DONE]" ||
    trimmedLine === "[DONE]"
  ) {
    return null;
  }

  if (trimmedLine.startsWith("event: ") || trimmedLine.startsWith(":")) {
    return null;
  }

  if (trimmedLine.startsWith("data: ")) {
    return trimmedLine.slice(6);
  }

  return trimmedLine;
}

function extractResponseText(
  payload: Record<string, unknown>,
  provider: string,
): string {
  switch (provider) {
    case "anthropic":
      return extractAnthropicText(payload);
    case "google":
      return extractGoogleText(payload);
    case "openai":
    case "custom":
    default:
      return extractOpenAICompatibleText(payload);
  }
}

function extractOpenAICompatibleText(payload: Record<string, unknown>): string {
  const firstChoice = Array.isArray(payload.choices)
    ? (payload.choices[0] as Record<string, unknown> | undefined)
    : undefined;
  if (firstChoice) {
    return (
      extractTextValue(firstChoice.delta) ||
      extractTextValue(firstChoice.message) ||
      extractTextValue(firstChoice.text)
    );
  }

  return (
    extractTextValue(payload.output) ||
    extractTextValue(payload.output_text) ||
    extractTextValue(payload.content)
  );
}

function extractAnthropicText(payload: Record<string, unknown>): string {
  if (payload.type === "content_block_delta") {
    return extractTextValue(payload.delta);
  }

  if (payload.type === "content_block_start") {
    return extractTextValue(payload.content_block);
  }

  return extractTextValue(payload.message);
}

function extractGoogleText(payload: Record<string, unknown>): string {
  const firstCandidate = Array.isArray(payload.candidates)
    ? (payload.candidates[0] as Record<string, unknown> | undefined)
    : undefined;

  return (
    extractTextValue(firstCandidate?.content) ||
    extractTextValue(firstCandidate) ||
    extractTextValue(payload.promptFeedback)
  );
}

function extractTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractTextValue).join("");
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  return (
    extractTextValue(record.text) ||
    extractTextValue(record.content) ||
    extractTextValue(record.output_text) ||
    extractTextValue(record.parts) ||
    extractTextValue(record.delta)
  );
}
