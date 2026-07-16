import type {
  AutomationRunStepsResult,
  AutomationStep,
  AutomationStepResult,
  AutomationTarget
} from '@/types/automation';
import { getAttachedWindowId, getPageSnapshot, waitForTabComplete } from './tab-runtime';
import { isRiskyAutomationStep } from './safety';

let commandQueue: Promise<unknown> = Promise.resolve();

export async function runStep(tabId: number, step: AutomationStep, options: { allowRisky?: boolean } = {}): Promise<AutomationStepResult> {
  return enqueue(async () => runStepNow(tabId, step, options));
}

export async function runSteps(tabId: number, steps: AutomationStep[], options: { allowRisky?: boolean } = {}): Promise<AutomationRunStepsResult> {
  return enqueue(async () => {
    const results: AutomationStepResult[] = [];
    for (const step of steps) {
      results.push(await runStepNow(tabId, step, options));
    }
    return {
      page: await getPageSnapshot(tabId),
      results
    };
  });
}

async function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = commandQueue.then(task, task);
  commandQueue = run.catch(() => undefined);
  return run;
}

async function runStepNow(tabId: number, step: AutomationStep, options: { allowRisky?: boolean }): Promise<AutomationStepResult> {
  const startedAt = Date.now();
  const normalizedStep = normalizeStep(step);
  let result: unknown;
  let screenshot: string | undefined;

  if (normalizedStep.type === 'goto') {
    if (!normalizedStep.url) {
      throw new Error('goto step 缺少 url');
    }
    await chrome.tabs.update(tabId, { url: normalizedStep.url });
    await waitForTabComplete(tabId, normalizedStep.timeoutMs || 30000);
  } else if (normalizedStep.type === 'screenshot') {
    screenshot = await captureVisibleTab();
    result = { contentType: 'image/png' };
  } else {
    assertStepAllowed(normalizedStep, options);
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: executeDOMStep,
      args: [normalizedStep]
    });
    result = execution?.result;
  }

  return {
    step: normalizedStep,
    page: await getPageSnapshot(tabId),
    result,
    screenshot,
    durationMs: Date.now() - startedAt
  };
}

function normalizeStep(step: AutomationStep): AutomationStep {
  const rawType = step.type.toLowerCase();
  return {
    ...step,
    type: rawType === 'verifytext' ? 'verifyText' : rawType as AutomationStep['type'],
    timeoutMs: step.timeoutMs && step.timeoutMs > 0 ? step.timeoutMs : 10000
  };
}

function assertStepAllowed(step: AutomationStep, options: { allowRisky?: boolean }): void {
  if (options.allowRisky) {
    return;
  }
  const targetText = [
    step.target?.name,
    step.target?.text,
    step.target?.selector,
    step.value
  ].filter(Boolean).join(' ');

  if (isRiskyAutomationStep(step.type, targetText)) {
    throw new Error('检测到高风险点击动作，请在面板中确认后再执行 real-run');
  }
}

async function captureVisibleTab(): Promise<string> {
  const dataURL = await chrome.tabs.captureVisibleTab(getAttachedWindowId(), {
    format: 'png'
  });
  return dataURL.replace(/^data:image\/png;base64,/, '');
}

function executeDOMStep(step: AutomationStep): unknown {
  type PageTarget = AutomationTarget | undefined;

  const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
  const timeoutMs = step.timeoutMs || 10000;

  const textOf = (element: Element): string => {
    const input = element as HTMLInputElement;
    return [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      input.placeholder,
      input.value,
      element.textContent
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  };

  const matchesName = (element: Element, name?: string): boolean => {
    if (!name) {
      return true;
    }
    return textOf(element).toLowerCase().includes(name.toLowerCase());
  };

  const isVisible = (element: Element): boolean => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style.visibility !== 'hidden'
      && style.display !== 'none';
  };

  const implicitRole = (element: Element): string => {
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

  const isInteractive = (element: Element): boolean => {
    return Boolean(element.closest('button,a,[role],input,textarea,select,label,[data-testid],[data-test-id],[data-test]'));
  };

  const depthOf = (element: Element): number => {
    let depth = 0;
    let current: Element | null = element;
    while (current?.parentElement) {
      depth += 1;
      current = current.parentElement;
    }
    return depth;
  };

  const queryByText = (text: string): Element | null => {
    const wanted = text.toLowerCase();
    const elements = Array.from(document.querySelectorAll('button,a,input,textarea,select,label,[role],h1,h2,h3,h4,p,span,div'));
    return elements
      .filter(element => isVisible(element) && textOf(element).toLowerCase().includes(wanted))
      .sort((a, b) => {
        const aText = textOf(a).toLowerCase();
        const bText = textOf(b).toLowerCase();
        const score = (element: Element, elementText: string): number => {
          const exactPenalty = elementText === wanted ? 0 : 40;
          const interactivePenalty = isInteractive(element) ? 0 : 20;
          const lengthPenalty = Math.min(Math.abs(elementText.length - wanted.length), 80);
          const depthBonus = Math.min(depthOf(element), 20);
          return exactPenalty + interactivePenalty + lengthPenalty - depthBonus;
        };
        return score(a, aText) - score(b, bText);
      })[0] || null;
  };

  const queryByLabel = (text: string): Element | null => {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find(item => textOf(item).toLowerCase().includes(text.toLowerCase())) as HTMLLabelElement | undefined;
    if (!label) {
      return null;
    }
    if (label.control) {
      return label.control;
    }
    const forId = label.getAttribute('for');
    if (forId) {
      return document.getElementById(forId);
    }
    return label.querySelector('input,textarea,select,button');
  };

  const attrEscape = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const findElement = (target: PageTarget): Element => {
    if (!target) {
      const active = document.activeElement;
      if (active && active !== document.body) {
        return active;
      }
      throw new Error('step 缺少 target');
    }

    if (target.selector) {
      const element = document.querySelector(target.selector);
      if (element && isVisible(element)) {
        return element;
      }
    }

    switch (target.kind) {
      case 'css': {
        if (!target.selector) {
          throw new Error('css target 缺少 selector');
        }
        const element = document.querySelector(target.selector);
        if (element) {
          return element;
        }
        break;
      }
      case 'role': {
        if (!target.role) {
          throw new Error('role target 缺少 role');
        }
        const candidates = Array.from(document.querySelectorAll(`[role="${attrEscape(target.role)}"],button,a,input,textarea,select`))
          .filter(candidate => isVisible(candidate) && implicitRole(candidate) === target.role && matchesName(candidate, target.name));
        const element = candidates.sort((a, b) => {
          const aExact = textOf(a).toLowerCase() === (target.name || '').toLowerCase() ? 0 : 1;
          const bExact = textOf(b).toLowerCase() === (target.name || '').toLowerCase() ? 0 : 1;
          return aExact - bExact || textOf(a).length - textOf(b).length;
        })[0];
        if (element) {
          return element;
        }
        break;
      }
      case 'label': {
        if (!target.text) {
          throw new Error('label target 缺少 text');
        }
        const element = queryByLabel(target.text);
        if (element) {
          return element;
        }
        break;
      }
      case 'placeholder': {
        if (!target.placeholder) {
          throw new Error('placeholder target 缺少 placeholder');
        }
        const candidates = Array.from(document.querySelectorAll('input,textarea'));
        const element = candidates.find(candidate => ((candidate as HTMLInputElement).placeholder || '').toLowerCase().includes(target.placeholder!.toLowerCase()));
        if (element) {
          return element;
        }
        break;
      }
      case 'testid': {
        if (!target.testId) {
          throw new Error('testid target 缺少 testId');
        }
        const escaped = attrEscape(target.testId);
        const element = document.querySelector(`[data-testid="${escaped}"],[data-test-id="${escaped}"],[data-test="${escaped}"]`);
        if (element) {
          return element;
        }
        break;
      }
      case 'text': {
        if (!target.text) {
          throw new Error('text target 缺少 text');
        }
        const element = queryByText(target.text);
        if (element) {
          return element;
        }
        break;
      }
      default:
        throw new Error(`不支持的 target kind: ${(target as AutomationTarget).kind}`);
    }

    throw new Error(`未找到目标元素: ${JSON.stringify(target)}`);
  };

  const waitForElement = async (target: PageTarget): Promise<Element> => {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() <= deadline) {
      try {
        const element = findElement(target);
        if (element) {
          return element;
        }
      } catch (error) {
        lastError = error;
      }
      await sleep(150);
    }
    throw lastError instanceof Error ? lastError : new Error('等待目标元素超时');
  };

  const setNativeValue = (element: Element, value: string): void => {
    const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    input.focus();
    input.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const clickElement = (element: Element): void => {
    const clickable = element.closest('button,a,[role],input,textarea,select,label,[data-testid],[data-test-id],[data-test]') || element;
    clickable.scrollIntoView({ block: 'center', inline: 'center' });
    (clickable as HTMLElement).focus?.();
    (clickable as HTMLElement).click();
  };

  const pressKey = (element: Element, key: string): void => {
    (element as HTMLElement).focus?.();
    const options: KeyboardEventInit = { key, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent('keydown', options));
    element.dispatchEvent(new KeyboardEvent('keyup', options));
    if (key === 'Enter') {
      const form = (element as HTMLInputElement).form;
      form?.requestSubmit?.();
    }
  };

  return (async () => {
    switch (step.type) {
      case 'click': {
        const element = await waitForElement(step.target);
        clickElement(element);
        return { clicked: true, text: textOf(element) };
      }
      case 'fill': {
        const element = await waitForElement(step.target);
        setNativeValue(element, step.value || '');
        return { filled: true };
      }
      case 'press': {
        const element = await waitForElement(step.target);
        pressKey(element, step.key || 'Enter');
        return { pressed: step.key || 'Enter' };
      }
      case 'wait': {
        const element = await waitForElement(step.target);
        return { found: true, text: textOf(element) };
      }
      case 'extract': {
        if (step.all && step.target?.kind === 'css' && step.target.selector) {
          return Array.from(document.querySelectorAll(step.target.selector)).map(element => textOf(element));
        }
        const element = await waitForElement(step.target);
        return textOf(element);
      }
      case 'verifyText': {
        const expected = step.target?.text || step.value || step.target?.name || '';
        if (!expected) {
          throw new Error('verifyText 缺少验证文本');
        }
        const deadline = Date.now() + timeoutMs;
        while (Date.now() <= deadline) {
          if (document.body?.innerText?.includes(expected)) {
            return { verified: true, text: expected };
          }
          await sleep(150);
        }
        throw new Error(`未找到验证文本: ${expected}`);
      }
      default:
        throw new Error(`不支持的 step type: ${step.type}`);
    }
  })();
}
