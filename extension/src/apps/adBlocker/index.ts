/**
 * 页面广告拦截器：点选元素后从当前节点向父节点选择拦截层级。
 * 规则保存在页面 localStorage，因此每个网站可独立维护自己的规则。
 */

export interface AdBlockRule {
  xpath: string;
  id?: string;
  tagName: string;
  className?: string;
  hostname: string;
  createdAt: string;
}

const STORAGE_KEY = "kria-nove:ad-block-rules";
const HOST_ID = "ma-extension-adblocker-host";
const HIGHLIGHT_ID = "ma-extension-adblocker-highlight";

const getRules = (): AdBlockRule[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveRules = (rules: AdBlockRule[]): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules.slice(-200)));
};

const xpathFor = (element: Element): string => {
  if (element.id) {
    return `//*[@id=${JSON.stringify(element.id)}]`;
  }
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === current.tagName) index += 1;
      sibling = sibling.previousElementSibling;
    }
    parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    current = current.parentElement;
  }
  return `/${parts.join("/")}`;
};

const elementFromRule = (rule: AdBlockRule): Element | null => {
  if (rule.id) {
    const byId = document.getElementById(rule.id);
    if (byId) return byId;
  }
  try {
    return document.evaluate(
      rule.xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue as Element | null;
  } catch {
    return null;
  }
};

const applyRules = (): void => {
  getRules().forEach((rule) => {
    const element = elementFromRule(rule) as HTMLElement | null;
    if (
      element &&
      element !== document.body &&
      element !== document.documentElement
    ) {
      element.style.setProperty("display", "none", "important");
      element.setAttribute("data-kria-ad-blocked", "true");
    }
  });
};

class AdBlockerModule {
  private selecting = false;
  private selected: HTMLElement | null = null;
  private candidates: HTMLElement[] = [];
  private overlay: HTMLDivElement | null = null;
  private host: HTMLDivElement | null = null;
  private dialog: HTMLDivElement | null = null;
  private observer: MutationObserver | null = null;

  async inject(): Promise<void> {
    if (window.self !== window.top) return;
    applyRules();
    if (!this.observer) {
      this.observer = new MutationObserver(() => applyRules());
      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  }

  enable(): void {
    void this.inject();
  }

  disable(): void {
    this.exit();
    this.observer?.disconnect();
    this.observer = null;
  }

  private isOwnElement(element: Element | null): boolean {
    return (
      !!element &&
      (!!element.closest(`#${HOST_ID}`) || element.id === HIGHLIGHT_ID)
    );
  }

  private ensureOverlay(): HTMLDivElement {
    if (this.overlay) return this.overlay;
    const overlay = document.createElement("div");
    overlay.id = HIGHLIGHT_ID;
    Object.assign(overlay.style, {
      position: "fixed",
      pointerEvents: "none",
      border: "2px solid #ff3d81",
      boxShadow:
        "0 0 0 9999px rgba(9, 13, 25, .18), 0 0 0 5px rgba(255, 61, 129, .25)",
      zIndex: "2147483645",
      display: "none",
      boxSizing: "border-box",
    });
    document.documentElement.appendChild(overlay);
    this.overlay = overlay;
    return overlay;
  }

  private highlight(element: Element | null): void {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const overlay = this.ensureOverlay();
    Object.assign(overlay.style, {
      display: "block",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${Math.max(rect.width, 1)}px`,
      height: `${Math.max(rect.height, 1)}px`,
    });
  }

  private ancestors(element: HTMLElement): HTMLElement[] {
    const result: HTMLElement[] = [];
    let current: HTMLElement | null = element;
    while (
      current &&
      current !== document.documentElement &&
      result.length < 12
    ) {
      if (current !== document.body) result.push(current);
      current = current.parentElement;
    }
    return result;
  }

  private renderDialog(): void {
    this.host?.remove();
    const host = document.createElement("div");
    host.id = HOST_ID;
    Object.assign(host.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      pointerEvents: "none",
    });
    const dialog = document.createElement("div");
    Object.assign(dialog.style, {
      position: "fixed",
      top: "24px",
      right: "24px",
      width: "320px",
      padding: "16px",
      background: "#101827",
      color: "#f8fafc",
      border: "1px solid #334155",
      borderRadius: "10px",
      boxShadow: "0 14px 40px rgba(0,0,0,.38)",
      font: "13px/1.45 system-ui, sans-serif",
      pointerEvents: "auto",
    });
    const title = document.createElement("strong");
    title.textContent = "选择要拦截的广告区域";
    title.style.display = "block";
    title.style.marginBottom = "8px";
    const size = document.createElement("div");
    size.style.color = "#cbd5e1";
    size.style.marginBottom = "8px";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = String(Math.max(this.candidates.length - 1, 0));
    range.value = "0";
    range.style.width = "100%";
    const level = document.createElement("div");
    level.style.color = "#fda4af";
    level.style.margin = "4px 0 12px";
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    const cancel = document.createElement("button");
    cancel.textContent = "取消";
    const confirm = document.createElement("button");
    confirm.textContent = "确定拦截";
    [cancel, confirm].forEach((button) => {
      Object.assign(button.style, {
        border: "1px solid #475569",
        borderRadius: "6px",
        padding: "6px 12px",
        cursor: "pointer",
      });
    });
    Object.assign(confirm.style, {
      background: "#e11d48",
      color: "white",
      borderColor: "#fb7185",
    });
    const update = (): void => {
      const index = Number(range.value);
      this.selected = this.candidates[index] || null;
      this.highlight(this.selected);
      const rect = this.selected?.getBoundingClientRect();
      level.textContent = `层级 ${index + 1}/${this.candidates.length} · <${this.selected?.tagName.toLowerCase() || "?"}>`;
      size.textContent = rect
        ? `区域：${Math.round(rect.width)} × ${Math.round(rect.height)} px`
        : "区域不可见";
    };
    range.addEventListener("input", update);
    cancel.addEventListener("click", () => this.cancelSelection());
    confirm.addEventListener("click", () => this.confirmSelection());
    actions.append(cancel, confirm);
    dialog.append(title, size, range, level, actions);
    host.appendChild(dialog);
    document.documentElement.appendChild(host);
    this.host = host;
    this.dialog = dialog;
    update();
  }

  private onMove = (event: MouseEvent): void => {
    if (!this.selecting) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (target && !this.isOwnElement(target)) this.highlight(target);
  };

  private onClick = (event: MouseEvent): void => {
    if (!this.selecting || this.isOwnElement(event.target as HTMLElement))
      return;
    event.preventDefault();
    event.stopPropagation();
    const target = document.elementFromPoint(
      event.clientX,
      event.clientY,
    ) as HTMLElement;
    if (!target || this.isOwnElement(target)) return;
    this.candidates = this.ancestors(target);
    if (this.candidates.length) {
      this.selected = this.candidates[0];
      this.renderDialog();
    }
  };

  private onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.exit();
  };

  triggerAdBlocker(): void {
    void this.inject();
    this.selecting = true;
    this.candidates = [];
    this.ensureOverlay();
    document.addEventListener("mousemove", this.onMove, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKey, true);
  }

  private confirmSelection(): void {
    if (!this.selected) return;
    const rule: AdBlockRule = {
      xpath: xpathFor(this.selected),
      ...(this.selected.id ? { id: this.selected.id } : {}),
      tagName: this.selected.tagName.toLowerCase(),
      ...(typeof this.selected.className === "string" && this.selected.className
        ? { className: this.selected.className }
        : {}),
      hostname: location.hostname,
      createdAt: new Date().toISOString(),
    };
    const rules = getRules().filter(
      (item) => item.xpath !== rule.xpath && (!rule.id || item.id !== rule.id),
    );
    saveRules([...rules, rule]);
    this.selected.style.setProperty("display", "none", "important");
    this.exit();
  }

  private cancelSelection(): void {
    this.selected = null;
    this.dialog?.remove();
    this.dialog = null;
    this.candidates = [];
    this.highlight(null);
  }

  private exit(): void {
    this.selecting = false;
    this.cancelSelection();
    document.removeEventListener("mousemove", this.onMove, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.overlay?.remove();
    this.overlay = null;
    this.host?.remove();
    this.host = null;
  }
}

let moduleInstance: AdBlockerModule | null = null;

export default (_context: AppContext): AdBlockerModule => {
  if (!moduleInstance) moduleInstance = new AdBlockerModule();
  return moduleInstance;
};

export const triggerAdBlocker = (): void => {
  moduleInstance?.triggerAdBlocker();
};
