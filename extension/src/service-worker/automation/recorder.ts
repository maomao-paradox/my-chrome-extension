import type { AutomationStep } from '@/types/automation';

export async function startRecorder(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'ISOLATED',
    func: installRecorder,
  });
}

export async function stopRecorder(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'ISOLATED',
    func: uninstallRecorder,
  });
}

function installRecorder(): void {
  type RecorderWindow = Window & {
    __kiraAutomationRecorder?: {
      cleanup: () => void;
      lastInputAt: WeakMap<Element, number>;
    };
  };

  const recorderWindow = window as RecorderWindow;
  recorderWindow.__kiraAutomationRecorder?.cleanup();

  const lastInputAt = new WeakMap<Element, number>();

  const textOf = (element: Element): string => {
    const input = element as HTMLInputElement;
    return [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      input.placeholder,
      input.value,
      element.textContent,
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  };

  const cssEscape = (value: string): string => {
    const css = window.CSS as CSS & { escape?: (value: string) => string };
    return css.escape ? css.escape(value) : value.replace(/"/g, '\\"');
  };

  const attrEscape = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const cssPath = (element: Element): string => {
    const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id') || element.getAttribute('data-test');
    if (testId) {
      const escaped = attrEscape(testId);
      return `[data-testid="${escaped}"],[data-test-id="${escaped}"],[data-test="${escaped}"]`;
    }
    if (element.id) {
      return `#${cssEscape(element.id)}`;
    }
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.body && parts.length < 4) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const sameTagSiblings = Array.from(parent.children).filter(child => child.tagName === current!.tagName);
      const index = sameTagSiblings.indexOf(current) + 1;
      parts.unshift(sameTagSiblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.join(' > ');
  };

  const roleFor = (element: Element): string => {
    const explicitRole = element.getAttribute('role');
    if (explicitRole) {
      return explicitRole;
    }

    const tag = element.tagName.toLowerCase();
    const input = element as HTMLInputElement;
    if (tag === 'button') {
      return 'button';
    }
    if (tag === 'a' && (element as HTMLAnchorElement).href) {
      return 'link';
    }
    if (tag === 'textarea') {
      return 'textbox';
    }
    if (tag === 'select') {
      return 'combobox';
    }
    if (tag === 'input') {
      if (input.type === 'button' || input.type === 'submit' || input.type === 'reset') {
        return 'button';
      }
      if (input.type === 'checkbox') {
        return 'checkbox';
      }
      if (input.type === 'radio') {
        return 'radio';
      }
      return 'textbox';
    }
    return '';
  };

  const labelTextFor = (element: Element): string => {
    const input = element as HTMLInputElement;
    if (input.labels?.length) {
      return textOf(input.labels[0]);
    }
    if (input.id) {
      const label = document.querySelector(`label[for="${attrEscape(input.id)}"]`);
      if (label) {
        return textOf(label);
      }
    }
    const wrapperLabel = element.closest('label');
    return wrapperLabel ? textOf(wrapperLabel) : '';
  };

  const targetFor = (element: Element): AutomationStep['target'] => {
    const selector = cssPath(element);
    const role = roleFor(element);
    const name = textOf(element);
    if (role && name) {
      return { kind: 'role', role, name, selector };
    }

    const label = labelTextFor(element);
    if (label) {
      return { kind: 'label', text: label, selector };
    }

    const input = element as HTMLInputElement;
    if (input.placeholder) {
      return { kind: 'placeholder', placeholder: input.placeholder, selector };
    }

    const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id') || element.getAttribute('data-test');
    if (testId) {
      return { kind: 'testid', testId, selector };
    }

    if (name && name.length <= 80) {
      return { kind: 'text', text: name, selector };
    }

    return { kind: 'css', selector };
  };

  const sendStep = (step: AutomationStep): void => {
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'AUTOMATION_RECORDED_ACTION',
      payload: {
        step,
        page: {
          title: document.title,
          url: location.href,
        },
      },
    });
  };

  const isEditable = (element: Element | null): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
    if (!element) {
      return false;
    }
    const tag = element.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  };

  const onClick = (event: Event): void => {
    const element = event.target instanceof Element ? event.target.closest('button,a,[role],input[type="button"],input[type="submit"],input[type="reset"],[data-testid],[data-test-id],[data-test]') : null;
    if (!element || isEditable(element)) {
      return;
    }
    sendStep({
      type: 'click',
      target: targetFor(element),
    });
  };

  const onInput = (event: Event): void => {
    const element = event.target instanceof Element ? event.target : null;
    if (!isEditable(element)) {
      return;
    }
    lastInputAt.set(element, Date.now());
    window.setTimeout(() => {
      const lastAt = lastInputAt.get(element) || 0;
      if (Date.now() - lastAt < 350) {
        return;
      }
      sendStep({
        type: 'fill',
        target: targetFor(element),
        value: element.value,
      });
    }, 380);
  };

  const onChange = (event: Event): void => {
    const element = event.target instanceof Element ? event.target : null;
    if (!isEditable(element)) {
      return;
    }
    if (element instanceof HTMLSelectElement || element.type === 'checkbox' || element.type === 'radio') {
      sendStep({
        type: 'fill',
        target: targetFor(element),
        value: element.value,
      });
    }
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') {
      return;
    }
    const element = event.target instanceof Element ? event.target : undefined;
    sendStep({
      type: 'press',
      target: element ? targetFor(element) : undefined,
      key: 'Enter',
    });
  };

  document.addEventListener('click', onClick, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('keydown', onKeydown, true);

  recorderWindow.__kiraAutomationRecorder = {
    lastInputAt,
    cleanup: () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('keydown', onKeydown, true);
    },
  };
}

function uninstallRecorder(): void {
  const recorderWindow = window as Window & {
    __kiraAutomationRecorder?: {
      cleanup: () => void;
    };
  };
  recorderWindow.__kiraAutomationRecorder?.cleanup();
  delete recorderWindow.__kiraAutomationRecorder;
}
