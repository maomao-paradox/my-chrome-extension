/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-textarea-ai.ts
 * @date 2026-07-07T00:00:00.000Z
 */

import { loadAIConfig } from '@/utils/ai-config';

type TextareaAIState = 'pending' | 'generating' | 'filled' | 'skipped' | 'error';

const SCRIPT_FLAG = '__CONTENT_SCRIPT_TEXTAREA_AI';
const STATE_ATTR = 'data-ma-textarea-ai-state';
const ERROR_ATTR = 'data-ma-textarea-ai-error';
const TRIGGER_CLASS = 'ma-textarea-ai-trigger';
const TRIGGER_STYLE_ID = 'ma-textarea-ai-trigger-style';
const TRIGGER_SIZE = 14;
const TRIGGER_INSET = 8;
const GENERATE_TIMEOUT_MS = 60000;

const SYSTEM_PROMPT = [
    '你是一个网页表单写作助手。',
    '请根据输入框 placeholder 生成可直接填入 textarea 的正文。',
    '只输出正文，不要解释、不要 Markdown 代码块、不要添加前后缀说明。',
].join('\n');

const createMessageId = (): string =>
    `textarea-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getTextareaState = (textarea: HTMLTextAreaElement): TextareaAIState | null =>
    textarea.getAttribute(STATE_ATTR) as TextareaAIState | null;

const setTextareaState = (textarea: HTMLTextAreaElement, state: TextareaAIState, error?: string): void => {
    textarea.setAttribute(STATE_ATTR, state);
    if (error) {
        textarea.setAttribute(ERROR_ATTR, error);
    } else {
        textarea.removeAttribute(ERROR_ATTR);
    }
};

const normalizeForCompare = (value: string): string =>
    value.replace(/\s+/g, '').replace(/[，。！？、；：,.!?;:\-—'"“”‘’`]/g, '').toLowerCase();

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
        const isRepeated = Array.from({ length: repeatCount - 1 })
            .every((_, index) => text.slice((index + 1) * partLength, (index + 2) * partLength) === firstPart);

        if (isRepeated) {
            return firstPart.trim();
        }
    }

    return text;
};

const dedupeAdjacentSegments = (value: string, splitter: RegExp, joiner: string): string => {
    const segments = value.split(splitter).map(segment => segment.trim()).filter(Boolean);
    if (segments.length <= 1) {
        return value;
    }

    const deduped: string[] = [];
    for (const segment of segments) {
        const previous = deduped[deduped.length - 1];
        const currentKey = normalizeForCompare(segment);
        const previousKey = previous ? normalizeForCompare(previous) : '';

        if (previousKey && previousKey === currentKey && currentKey.length >= 8) {
            continue;
        }

        deduped.push(segment);
    }

    return deduped.join(joiner);
};

const normalizeGeneratedContent = (value: string): string => {
    const text = removeRepeatedWholeContent(value);
    const withoutRepeatedParagraphs = dedupeAdjacentSegments(text, /\n{2,}/, '\n\n');
    return dedupeAdjacentSegments(withoutRepeatedParagraphs, /\n/, '\n').trim();
};

const isElementVisible = (element: HTMLElement): boolean => {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
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

const shouldShowTrigger = (textarea: HTMLTextAreaElement): boolean => {
    return isTextareaCandidate(textarea);
};

const shouldFillTextarea = (textarea: HTMLTextAreaElement): boolean => {
    if (!isTextareaCandidate(textarea)) {
        return false;
    }

    return getTextareaState(textarea) !== 'generating';
};

const findLabelText = (textarea: HTMLTextAreaElement): string => {
    const labels = Array.from(textarea.labels || [])
        .map(label => label.textContent?.trim())
        .filter(Boolean);

    if (labels.length > 0) {
        return labels.join(' / ');
    }

    const ariaLabel = textarea.getAttribute('aria-label')?.trim();
    if (ariaLabel) {
        return ariaLabel;
    }

    const labelledBy = textarea.getAttribute('aria-labelledby')?.trim();
    if (!labelledBy) {
        return '';
    }

    return labelledBy
        .split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(' / ');
};

const buildPrompt = (textarea: HTMLTextAreaElement): string => {
    const placeholder = textarea.placeholder.trim();
    const label = findLabelText(textarea);
    const maxLength = textarea.maxLength > 0 ? textarea.maxLength : null;

    return [
        `页面标题：${document.title || '未命名页面'}`,
        `页面地址：${location.href}`,
        label ? `输入框标签：${label}` : '',
        `placeholder：${placeholder}`,
        maxLength ? `最大长度：${maxLength} 个字符` : '',
        '',
        '请生成一段适合填入该 textarea 的内容。内容需要贴合 placeholder 的要求，语气自然、具体、可直接提交。',
    ].filter(Boolean).join('\n');
};

const setNativeTextareaValue = (textarea: HTMLTextAreaElement, value: string): void => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    descriptor?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
};

const generateTextareaContent = async (textarea: HTMLTextAreaElement): Promise<string> => {
    const messageId = createMessageId();
    const config = await loadAIConfig();
    const port = chrome.runtime.connect({ name: `ai-conversation-${messageId}` });
    const prompt = buildPrompt(textarea);

    return new Promise((resolve, reject) => {
        let content = '';
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
            settle(() => reject(new Error('AI 生成超时')));
        }, GENERATE_TIMEOUT_MS);

        port.onMessage.addListener((message) => {
            if (!message?.payload || message.payload.messageId !== messageId) {
                return;
            }

            if (message.type === 'AI_CONVERSATION_STREAM_DATA') {
                content = mergeStreamContent(content, message.payload.content || '');
                return;
            }

            if (message.type === 'AI_CONVERSATION_COMPLETE') {
                const generated = normalizeGeneratedContent(content);
                settle(() => {
                    generated ? resolve(generated) : reject(new Error('AI 没有返回可填入内容'));
                });
                return;
            }

            if (message.type === 'AI_CONVERSATION_ERROR') {
                settle(() => reject(new Error(message.payload.error || 'AI 生成失败')));
            }
        });

        port.onDisconnect.addListener(() => {
            if (!settled) {
                settle(() => reject(new Error('AI 连接已断开')));
            }
        });

        port.postMessage({
            type: 'START_AI_CONVERSATION',
            payload: {
                prompt,
                messageId,
                role: 'textarea_ai_autofill',
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
    setTextareaState(textarea, 'generating');
    if (shouldReplaceExistingValue) {
        setNativeTextareaValue(textarea, '');
    }

    try {
        const generated = await generateTextareaContent(textarea);
        if (textarea.value.trim()) {
            setTextareaState(textarea, 'skipped');
            return;
        }

        setNativeTextareaValue(textarea, generated);
        setTextareaState(textarea, 'filled');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldReplaceExistingValue && !textarea.value.trim()) {
            setNativeTextareaValue(textarea, valueBeforeGeneration);
        }
        setTextareaState(textarea, 'error', message);
        maLogger.warn('[TextareaAI] 自动填充失败:', message);
    }
};

const injectTriggerStyles = (): void => {
    if (document.getElementById(TRIGGER_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = TRIGGER_STYLE_ID;
    style.textContent = `
.${TRIGGER_CLASS} {
    position: fixed;
    width: ${TRIGGER_SIZE}px;
    height: ${TRIGGER_SIZE}px;
    padding: 0;
    border: 1px solid rgba(37, 99, 235, 0.86);
    border-radius: 50%;
    background: #2563eb;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.92);
    cursor: pointer;
    z-index: 2147483647;
    display: none;
    transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
}

.${TRIGGER_CLASS}::after {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.94);
}

.${TRIGGER_CLASS}:hover {
    background: #1d4ed8;
    border-color: #1d4ed8;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18), 0 0 0 2px rgba(255, 255, 255, 0.92);
}

.${TRIGGER_CLASS}:focus-visible {
    outline: 2px solid #f97316;
    outline-offset: 2px;
}

.${TRIGGER_CLASS}[data-state="generating"] {
    background: #f97316;
    border-color: #f97316;
    opacity: 0.92;
    cursor: wait;
    animation: ma-textarea-ai-pulse 900ms ease-in-out infinite;
}

.${TRIGGER_CLASS}[data-state="error"] {
    background: #dc2626;
    border-color: #dc2626;
}

@keyframes ma-textarea-ai-pulse {
    0%, 100% { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.92); }
    50% { box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.22), 0 0 0 2px rgba(255, 255, 255, 0.92); }
}

@media (prefers-reduced-motion: reduce) {
    .${TRIGGER_CLASS},
    .${TRIGGER_CLASS}[data-state="generating"] {
        transition: none;
        animation: none;
    }
}
`;
    document.documentElement.appendChild(style);
};

type TriggerRecord = {
    button: HTMLButtonElement;
    textarea: HTMLTextAreaElement;
};

const getCandidateTextareas = (root: ParentNode = document): HTMLTextAreaElement[] => {
    const textareas: HTMLTextAreaElement[] = [];

    if (root instanceof HTMLTextAreaElement && root.matches('textarea[placeholder]')) {
        textareas.push(root);
    }

    if ('querySelectorAll' in root) {
        textareas.push(...Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea[placeholder]')));
    }

    return textareas;
};

const createTextareaAIController = () => {
    const records = new Map<HTMLTextAreaElement, TriggerRecord>();
    let scanTimer: number | null = null;
    let positionTimer: number | null = null;

    const updateTrigger = (record: TriggerRecord): void => {
        const { button, textarea } = record;
        const state = getTextareaState(textarea);

        if (!document.contains(textarea) || !shouldShowTrigger(textarea)) {
            button.style.display = 'none';
            return;
        }

        const rect = textarea.getBoundingClientRect();
        const isInViewport = rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
        if (!isInViewport || rect.width < 32 || rect.height < 32) {
            button.style.display = 'none';
            return;
        }

        const left = Math.min(window.innerWidth - TRIGGER_SIZE - 2, Math.max(2, rect.right - TRIGGER_SIZE - TRIGGER_INSET));
        const top = Math.min(window.innerHeight - TRIGGER_SIZE - 2, Math.max(2, rect.bottom - TRIGGER_SIZE - TRIGGER_INSET));
        button.style.left = `${left}px`;
        button.style.top = `${top}px`;
        button.style.display = 'block';
        button.dataset.state = state || 'pending';
        button.disabled = state === 'generating';
        button.setAttribute('aria-busy', state === 'generating' ? 'true' : 'false');

        const error = textarea.getAttribute(ERROR_ATTR);
        button.title = state === 'generating'
            ? 'AI 正在生成文本'
            : error
                ? `AI 生成失败，点击重试：${error}`
                : '点击使用 AI 填入文本';
    };

    const updateAllTriggers = (): void => {
        for (const record of records.values()) {
            updateTrigger(record);
        }
    };

    const schedulePositionUpdate = (): void => {
        if (positionTimer !== null) {
            return;
        }

        positionTimer = window.setTimeout(() => {
            positionTimer = null;
            updateAllTriggers();
        }, 50);
    };

    const ensureTrigger = (textarea: HTMLTextAreaElement): void => {
        if (records.has(textarea)) {
            updateTrigger(records.get(textarea)!);
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = TRIGGER_CLASS;
        button.setAttribute('aria-label', '使用 AI 填入文本');

        const record = { button, textarea };

        button.addEventListener('mousedown', event => {
            event.preventDefault();
            event.stopPropagation();
        });
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const fillTask = fillTextarea(textarea);
            updateTrigger(record);
            void fillTask.finally(() => updateTrigger(record));
        });
        textarea.addEventListener('input', () => updateTrigger(record));
        textarea.addEventListener('focus', () => updateTrigger(record));
        textarea.addEventListener('blur', () => updateTrigger(record));

        records.set(textarea, record);
        document.documentElement.appendChild(button);
        updateTrigger(record);
    };

    const removeDetachedTriggers = (): void => {
        for (const [textarea, record] of records) {
            if (!document.contains(textarea)) {
                record.button.remove();
                records.delete(textarea);
            }
        }
    };

    const scan = (root: ParentNode = document): void => {
        getCandidateTextareas(root).forEach(ensureTrigger);
        removeDetachedTriggers();
        schedulePositionUpdate();
    };

    const scheduleScan = (root: ParentNode = document): void => {
        if (scanTimer !== null) {
            window.clearTimeout(scanTimer);
        }

        scanTimer = window.setTimeout(() => {
            scanTimer = null;
            scan(root);
        }, 300);
    };

    const observe = (): MutationObserver | null => {
        const target = document.body || document.documentElement;
        if (!target) {
            return null;
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes') {
                    if (mutation.target instanceof HTMLTextAreaElement) {
                        scheduleScan(mutation.target);
                        continue;
                    }

                    if (mutation.target instanceof Element && mutation.target.querySelector?.('textarea[placeholder]')) {
                        scheduleScan(mutation.target);
                        continue;
                    }

                    schedulePositionUpdate();
                    continue;
                }

                for (const node of Array.from(mutation.addedNodes)) {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        continue;
                    }

                    const element = node as Element;
                    if (element.matches?.('textarea[placeholder]')) {
                        scheduleScan(element);
                        continue;
                    }

                    if (element.querySelector?.('textarea[placeholder]')) {
                        scheduleScan(element);
                    }
                }
            }
        });

        observer.observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'placeholder', 'disabled', 'readonly']
        });
        return observer;
    };

    return {
        start: () => {
            injectTriggerStyles();
            window.addEventListener('scroll', schedulePositionUpdate, true);
            window.addEventListener('resize', schedulePositionUpdate);
            scan();
            return observe();
        },
    };
};

export default (ctx: AppContext, config = {}) => {
    if (ctx.hasOwnProperty(SCRIPT_FLAG)) {
        return {};
    }

    (ctx as Record<string, unknown>)[SCRIPT_FLAG] = true;

    const start = () => {
        const controller = createTextareaAIController();
        controller.start();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }

    return {};
};
