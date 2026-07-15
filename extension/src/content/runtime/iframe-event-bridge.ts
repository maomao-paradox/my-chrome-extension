type MouseEventName =
    | 'mousedown'
    | 'mouseup'
    | 'mousemove'
    | 'click'
    | 'dblclick'
    | 'contextmenu'
    | 'mouseover'
    | 'mouseout'
    | 'mouseenter'
    | 'mouseleave';

type KeyboardEventName = 'keydown' | 'keyup' | 'keypress';

const mouseEvents: MouseEventName[] = [
    'mousedown',
    'mouseup',
    'mousemove',
    'click',
    'dblclick',
    'contextmenu',
    'mouseover',
    'mouseout',
    'mouseenter',
    'mouseleave',
];

const keyboardEvents: KeyboardEventName[] = ['keydown', 'keyup', 'keypress'];
const formSelectors = [
    'textarea',
    'input[type="text"]',
    'input[type="search"]',
    'input[type="url"]',
    'input[type="email"]',
];

const getFrameElement = (ctx: Window): HTMLIFrameElement | null => {
    try {
        return ctx.frameElement as HTMLIFrameElement | null;
    } catch {
        return null;
    }
};

const postToParent = (ctx: Window, payload: Record<string, unknown>): void => {
    ctx.top?.postMessage(payload, '*');
};

const installMouseBridge = (ctx: Window): void => {
    mouseEvents.forEach((eventType) => {
        document.addEventListener(eventType, (event: MouseEvent) => {
            const frameElement = getFrameElement(ctx);
            if (!frameElement?.getBoundingClientRect) {
                return;
            }

            const rect = frameElement.getBoundingClientRect();
            postToParent(ctx, {
                type: 'iframe:event',
                eventType,
                clientX: event.clientX + rect.left,
                clientY: event.clientY + rect.top,
                screenX: event.screenX,
                screenY: event.screenY,
                pageX: event.pageX + rect.left,
                pageY: event.pageY + rect.top,
                button: event.button,
                buttons: event.buttons,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
            });
        });
    });
};

const installKeyboardBridge = (ctx: Window): void => {
    keyboardEvents.forEach((eventType) => {
        document.addEventListener(eventType, (event: KeyboardEvent) => {
            postToParent(ctx, {
                type: 'iframe:event',
                eventType,
                key: event.key,
                code: event.code,
                keyCode: event.keyCode,
                charCode: event.charCode,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                repeat: event.repeat,
                isComposing: event.isComposing,
            });
        });
    });
};

const postSelectionRect = (
    ctx: Window,
    text: string,
    rect: DOMRect,
    frameElement: HTMLIFrameElement,
): void => {
    const frameRect = frameElement.getBoundingClientRect();

    postToParent(ctx, {
        type: 'iframe:event',
        eventType: 'selectionchange',
        text,
        selectionRect: {
            left: rect.left + frameRect.left,
            top: rect.top + frameRect.top,
            right: rect.right + frameRect.left,
            bottom: rect.bottom + frameRect.top,
            width: rect.width,
            height: rect.height,
        },
    });
};

const installDocumentSelectionBridge = (ctx: Window): void => {
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        const frameElement = getFrameElement(ctx);

        if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !frameElement) {
            return;
        }

        const text = selection.toString().trim();
        if (!text) {
            return;
        }

        postSelectionRect(ctx, text, selection.getRangeAt(0).getBoundingClientRect(), frameElement);
    });
};

const addFormSelectionListener = (ctx: Window, element: Element): void => {
    const handleSelection = (event: Event): void => {
        const target = event.target as HTMLTextAreaElement | HTMLInputElement | null;
        const frameElement = getFrameElement(ctx);

        if (!target || !frameElement || target.selectionStart === null || target.selectionEnd === null) {
            return;
        }

        if (target.selectionStart === target.selectionEnd) {
            return;
        }

        const selectedText = target.value.substring(target.selectionStart, target.selectionEnd).trim();
        if (!selectedText) {
            return;
        }

        postSelectionRect(ctx, selectedText, target.getBoundingClientRect(), frameElement);
    };

    element.addEventListener('select', handleSelection);
    element.addEventListener('input', handleSelection);
};

const installFormSelectionBridge = (ctx: Window): void => {
    const bindExistingElements = (): void => {
        formSelectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                addFormSelectionListener(ctx, element);
            });
        });
    };

    const observeNewElements = (): void => {
        if (!document.body) {
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        return;
                    }

                    const element = node as Element;
                    if (formSelectors.some((selector) => element.matches(selector))) {
                        addFormSelectionListener(ctx, element);
                    }

                    formSelectors.forEach((selector) => {
                        element.querySelectorAll(selector).forEach((child) => {
                            addFormSelectionListener(ctx, child);
                        });
                    });
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    };

    const install = (): void => {
        bindExistingElements();
        observeNewElements();
    };

    if (document.readyState === 'loading' && !document.body) {
        document.addEventListener('DOMContentLoaded', install, { once: true });
        return;
    }

    install();
};

export const installIframeEventBridge = (ctx: Window = window): void => {
    if (ctx.self === ctx.top) {
        return;
    }

    installMouseBridge(ctx);
    installKeyboardBridge(ctx);
    installDocumentSelectionBridge(ctx);
    installFormSelectionBridge(ctx);
};

export const installTopFrameEventBridge = (ctx: AppContext): void => {
    if (ctx.self !== ctx.top) {
        return;
    }

    document.addEventListener('pointermove', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.tagName !== 'IFRAME') {
            return;
        }

        maLogger.info('通过Pointer Events捕获到iframe上的鼠标移动事件');
        ctx.dispatchEvent(new MouseEvent('mousemove', {
            clientX: event.clientX,
            clientY: event.clientY,
            screenX: event.screenX,
            screenY: event.screenY,
            // pageX: event.pageX,
            // pageY: event.pageY,
            bubbles: true,
            cancelable: true,
            view: ctx,
            composed: true,
        }));
    });

    ctx.addEventListener('message', (event) => {
        if (event.data.type === 'iframe:event') {
            const eventType = event.data.eventType;

            if (mouseEvents.includes(eventType)) {
                ctx.dispatchEvent(new MouseEvent(eventType, {
                    clientX: event.data.clientX,
                    clientY: event.data.clientY,
                    screenX: event.data.screenX,
                    screenY: event.data.screenY,
                    // pageX: event.data.pageX,
                    // pageY: event.data.pageY,
                    button: event.data.button,
                    buttons: event.data.buttons,
                    ctrlKey: event.data.ctrlKey,
                    shiftKey: event.data.shiftKey,
                    altKey: event.data.altKey,
                    metaKey: event.data.metaKey,
                    bubbles: true,
                    cancelable: true,
                    view: ctx,
                    composed: true,
                }));
                return;
            }

            if (keyboardEvents.includes(eventType)) {
                ctx.dispatchEvent(new KeyboardEvent(eventType, {
                    key: event.data.key,
                    code: event.data.code,
                    keyCode: event.data.keyCode,
                    charCode: event.data.charCode,
                    ctrlKey: event.data.ctrlKey,
                    shiftKey: event.data.shiftKey,
                    altKey: event.data.altKey,
                    metaKey: event.data.metaKey,
                    repeat: event.data.repeat,
                    isComposing: event.data.isComposing,
                    bubbles: true,
                    cancelable: true,
                    view: ctx,
                    composed: true,
                }));
                return;
            }

            if (eventType === 'selectionchange' && event.data.text) {
                ctx.dispatchEvent(new CustomEvent('iframe-selectionchange', {
                    detail: {
                        text: event.data.text,
                        selectionRect: event.data.selectionRect,
                    },
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                }));
            }
            return;
        }

        if (event.data.target !== 'content') {
            return;
        }
    });
};
