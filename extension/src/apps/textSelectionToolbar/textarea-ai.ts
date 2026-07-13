/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-textarea-ai.ts
 * @date 2026-07-07T00:00:00.000Z
 */

import { loadAIConfig } from "@/utils/ai-config";

type TextareaAIState =
  | "pending"
  | "generating"
  | "filled"
  | "skipped"
  | "error";

const STATE_ATTR = "data-ma-textarea-ai-state";
const ERROR_ATTR = "data-ma-textarea-ai-error";
const GENERATE_TIMEOUT_MS = 60000;

const SYSTEM_PROMPT = [
  "你是一个网页表单写作助手。",
  "请根据输入框 placeholder 生成可直接填入 textarea 的正文。",
  "只输出正文，不要解释、不要 Markdown 代码块、不要添加前后缀说明。",
].join("\n");

const createMessageId = (): string =>
  `textarea-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getTextareaState = (
  textarea: HTMLTextAreaElement,
): TextareaAIState | null =>
  textarea.getAttribute(STATE_ATTR) as TextareaAIState | null;

const setTextareaState = (
  textarea: HTMLTextAreaElement,
  state: TextareaAIState,
  error?: string,
): void => {
  textarea.setAttribute(STATE_ATTR, state);
  if (error) {
    textarea.setAttribute(ERROR_ATTR, error);
  } else {
    textarea.removeAttribute(ERROR_ATTR);
  }
};

const normalizeForCompare = (value: string): string =>
  value
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：,.!?;:\-—'"“”‘’`]/g, "")
    .toLowerCase();

const mergeStreamContent = (current: string, chunk: string): string => {
  if (!chunk) {
    return current;
  }

  if (!current) {
    return chunk;
  }

  if (chunk === current || current.endsWith(chunk)) {
    return current;
  }

  if (chunk.startsWith(current)) {
    return chunk;
  }

  const maxOverlap = Math.min(current.length, chunk.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (current.endsWith(chunk.slice(0, overlap))) {
      return current + chunk.slice(overlap);
    }
  }

  return current + chunk;
};

const removeRepeatedWholeContent = (value: string): string => {
  const text = value.trim();
  if (text.length < 24) {
    return text;
  }

  for (let repeatCount = 4; repeatCount >= 2; repeatCount -= 1) {
    if (text.length % repeatCount !== 0) {
      continue;
    }

    const partLength = text.length / repeatCount;
    if (partLength < 12) {
      continue;
    }

    const firstPart = text.slice(0, partLength);
    const isRepeated = Array.from({ length: repeatCount - 1 }).every(
      (_, index) =>
        text.slice((index + 1) * partLength, (index + 2) * partLength) ===
        firstPart,
    );

    if (isRepeated) {
      return firstPart.trim();
    }
  }

  return text;
};

const dedupeAdjacentSegments = (
  value: string,
  splitter: RegExp,
  joiner: string,
): string => {
  const segments = value
    .split(splitter)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length <= 1) {
    return value;
  }

  const deduped: string[] = [];
  for (const segment of segments) {
    const previous = deduped[deduped.length - 1];
    const currentKey = normalizeForCompare(segment);
    const previousKey = previous ? normalizeForCompare(previous) : "";

    if (previousKey && previousKey === currentKey && currentKey.length >= 8) {
      continue;
    }

    deduped.push(segment);
  }

  return deduped.join(joiner);
};

const normalizeGeneratedContent = (value: string): string => {
  const text = removeRepeatedWholeContent(value);
  const withoutRepeatedParagraphs = dedupeAdjacentSegments(
    text,
    /\n{2,}/,
    "\n\n",
  );
  return dedupeAdjacentSegments(withoutRepeatedParagraphs, /\n/, "\n").trim();
};

const isElementVisible = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number(style.opacity) === 0
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const isTextareaCandidate = (textarea: HTMLTextAreaElement): boolean => {
  if (textarea.disabled || textarea.readOnly) {
    return false;
  }

  if (!textarea.placeholder?.trim()) {
    return false;
  }

  return isElementVisible(textarea);
};

const shouldFillTextarea = (textarea: HTMLTextAreaElement): boolean => {
  if (!isTextareaCandidate(textarea)) {
    return false;
  }

  return getTextareaState(textarea) !== "generating";
};

const findLabelText = (textarea: HTMLTextAreaElement): string => {
  const labels = Array.from(textarea.labels || [])
    .map((label) => label.textContent?.trim())
    .filter(Boolean);

  if (labels.length > 0) {
    return labels.join(" / ");
  }

  const ariaLabel = textarea.getAttribute("aria-label")?.trim();
  if (ariaLabel) {
    return ariaLabel;
  }

  const labelledBy = textarea.getAttribute("aria-labelledby")?.trim();
  if (!labelledBy) {
    return "";
  }

  return labelledBy
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(" / ");
};

const buildPrompt = (textarea: HTMLTextAreaElement): string => {
  const placeholder = textarea.placeholder.trim();
  const label = findLabelText(textarea);
  const maxLength = textarea.maxLength > 0 ? textarea.maxLength : null;

  return [
    `页面标题：${document.title || "未命名页面"}`,
    `页面地址：${location.href}`,
    label ? `输入框标签：${label}` : "",
    `placeholder：${placeholder}`,
    maxLength ? `最大长度：${maxLength} 个字符` : "",
    "",
    "请生成一段适合填入该 textarea 的内容。内容需要贴合 placeholder 的要求，语气自然、具体、可直接提交。",
  ]
    .filter(Boolean)
    .join("\n");
};

const setNativeTextareaValue = (
  textarea: HTMLTextAreaElement,
  value: string,
): void => {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  );
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
};

const generateTextareaContent = async (
  textarea: HTMLTextAreaElement,
): Promise<string> => {
  const messageId = createMessageId();
  const config = await loadAIConfig();
  const port = chrome.runtime.connect({ name: `ai-conversation-${messageId}` });
  const prompt = buildPrompt(textarea);

  return new Promise((resolve, reject) => {
    let content = "";
    let settled = false;

    const settle = (handler: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      try {
        port.disconnect();
      } catch {
        // Port may already be closed by the service worker.
      }
      handler();
    };

    const timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error("AI 生成超时")));
    }, GENERATE_TIMEOUT_MS);

    port.onMessage.addListener((message) => {
      if (!message?.payload || message.payload.messageId !== messageId) {
        return;
      }

      if (message.type === "AI_CONVERSATION_STREAM_DATA") {
        content = mergeStreamContent(content, message.payload.content || "");
        return;
      }

      if (message.type === "AI_CONVERSATION_COMPLETE") {
        const generated = normalizeGeneratedContent(content);
        settle(() => {
          generated
            ? resolve(generated)
            : reject(new Error("AI 没有返回可填入内容"));
        });
        return;
      }

      if (message.type === "AI_CONVERSATION_ERROR") {
        settle(() => reject(new Error(message.payload.error || "AI 生成失败")));
      }
    });

    port.onDisconnect.addListener(() => {
      if (!settled) {
        settle(() => reject(new Error("AI 连接已断开")));
      }
    });

    port.postMessage({
      type: "START_AI_CONVERSATION",
      payload: {
        prompt,
        messageId,
        role: "textarea_ai_autofill",
        provider: config.provider,
        model: config.modelId,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        systemPrompt: config.systemPrompt || SYSTEM_PROMPT,
      },
    });
  });
};

const fillTextarea = async (textarea: HTMLTextAreaElement): Promise<void> => {
  if (!shouldFillTextarea(textarea)) {
    return;
  }

  const valueBeforeGeneration = textarea.value;
  const shouldReplaceExistingValue = Boolean(valueBeforeGeneration.trim());
  setTextareaState(textarea, "generating");
  if (shouldReplaceExistingValue) {
    setNativeTextareaValue(textarea, "");
  }

  try {
    const generated = await generateTextareaContent(textarea);
    if (textarea.value.trim()) {
      setTextareaState(textarea, "skipped");
      return;
    }

    setNativeTextareaValue(textarea, generated);
    setTextareaState(textarea, "filled");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (shouldReplaceExistingValue && !textarea.value.trim()) {
      setNativeTextareaValue(textarea, valueBeforeGeneration);
    }
    setTextareaState(textarea, "error", message);
    maLogger.warn("[TextareaAI] 自动填充失败:", message);
  }
};

export type TextareaAIMessagePayload = {
  selector?: string;
  index?: number;
};

const getCandidateTextareas = (
  root: ParentNode = document,
): HTMLTextAreaElement[] => {
  const textareas: HTMLTextAreaElement[] = [];

  if (
    root instanceof HTMLTextAreaElement &&
    root.matches("textarea[placeholder]")
  ) {
    textareas.push(root);
  }

  if ("querySelectorAll" in root) {
    textareas.push(
      ...Array.from(
        root.querySelectorAll<HTMLTextAreaElement>("textarea[placeholder]"),
      ),
    );
  }

  return textareas;
};

const getMessageTextarea = (
  payload: TextareaAIMessagePayload = {},
): HTMLTextAreaElement | null => {
  if (payload.selector) {
    let element: Element | null = null;
    try {
      element = document.querySelector(payload.selector);
    } catch {
      return null;
    }

    if (element instanceof HTMLTextAreaElement) {
      return element;
    }

    const textarea = element?.querySelector?.("textarea[placeholder]");
    if (textarea instanceof HTMLTextAreaElement) {
      return textarea;
    }

    return null;
  }

  if (document.activeElement instanceof HTMLTextAreaElement) {
    return document.activeElement;
  }

  const candidates = getCandidateTextareas().filter(isTextareaCandidate);
  return candidates[payload.index ?? 0] || null;
};

export const fillTextareaByAI = async (
  payload: TextareaAIMessagePayload = {},
) => {
  const textarea = getMessageTextarea(payload);
  if (!textarea) {
    return { success: false, msg: "未找到可填入的 textarea" };
  }

  if (!shouldFillTextarea(textarea)) {
    return { success: false, msg: "textarea 当前不可填入 AI 内容" };
  }

  await fillTextarea(textarea);
  return {
    success: getTextareaState(textarea) !== "error",
    msg: textarea.getAttribute(ERROR_ATTR) || "textarea AI 填入完成",
    result: {
      state: getTextareaState(textarea),
    },
  };
};

export const fillTextareaElementByAI = async (
  textarea: HTMLTextAreaElement,
) => {
  if (!isTextareaCandidate(textarea)) {
    return { success: false, msg: "textarea 当前不可填入 AI 内容" };
  }

  if (!shouldFillTextarea(textarea)) {
    return { success: false, msg: "textarea 正在生成中" };
  }

  await fillTextarea(textarea);
  return {
    success: getTextareaState(textarea) !== "error",
    msg: textarea.getAttribute(ERROR_ATTR) || "textarea AI 填入完成",
    result: {
      state: getTextareaState(textarea),
    },
  };
};
