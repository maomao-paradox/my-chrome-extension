/**
 * 页面广告拦截器：点选元素后从当前节点向父节点选择拦截层级。
 * 规则保存在页面 localStorage，因此每个网站可独立维护自己的规则。
 */

import { stopEarlyAdBlocker } from "./early";

export interface AdBlockRule {
  xpath: string;
  id?: string;
  tagName: string;
  className?: string;
  hostname: string;
  createdAt: string;
  /** hide keeps the legacy behavior; other effects replace the element contents. */
  effect?: "hide" | "image" | "gif" | "text" | "html";
  value?: string;
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

const safeHtml = (value: string): string => {
  const template = document.createElement("template");
  template.innerHTML = value;
  template.content.querySelectorAll("script,iframe,object,embed,link,style").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (
        /^on/i.test(attribute.name) ||
        ["href", "src", "srcdoc"].includes(attribute.name) && /^javascript:/i.test(attribute.value)
      ) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return template.innerHTML;
};

const applyRule = (element: HTMLElement, rule: AdBlockRule): void => {
  const effect = rule.effect || "hide";
  if (element === document.body || element === document.documentElement) return;
  element.setAttribute("data-kria-ad-blocked", "true");
  if (effect === "hide") {
    element.style.setProperty("display", "none", "important");
    return;
  }

  const value = rule.value || "";
  const appliedSignature = `${effect}:${value}`;
  if (element.dataset.kriaAdEffect === appliedSignature) return;
  element.dataset.kriaAdEffect = appliedSignature;
  element.style.setProperty("display", "block", "important");
  element.style.setProperty("pointer-events", "none", "important");
  element.replaceChildren();
  if (effect === "text") {
    const text = document.createElement("span");
    text.textContent = value || "广告已拦截";
    Object.assign(text.style, { display: "block", padding: "12px", textAlign: "center" });
    element.appendChild(text);
    return;
  }
  if (effect === "html") {
    element.innerHTML = safeHtml(value || "<span>广告已拦截</span>");
    return;
  }
  if (/^(?:https?:\/\/|data:image\/|blob:)/i.test(value)) {
    const image = document.createElement("img");
    image.src = value;
    image.alt = "广告替换内容";
    image.loading = "lazy";
    Object.assign(image.style, { display: "block", width: "100%", height: "auto", objectFit: "contain" });
    element.appendChild(image);
  } else {
    element.textContent = effect === "gif" ? "GIF 地址无效" : "图片地址无效";
  }
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
    if (element) applyRule(element, rule);
  });
};

class AdBlockerModule {
  private selecting = false;
  private selected: HTMLElement | null = null;
  private candidates: HTMLElement[] = [];
  private overlay: HTMLDivElement | null = null;
  private shield: HTMLDivElement | null = null;
  private host: HTMLDivElement | null = null;
  private dialog: HTMLDivElement | null = null;
  private observer: MutationObserver | null = null;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };
  private dragMoveHandler: ((event: MouseEvent) => void) | null = null;
  private dragStopHandler: (() => void) | null = null;

  async inject(): Promise<void> {
    if (window.self !== window.top) return;
    stopEarlyAdBlocker();
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
    stopEarlyAdBlocker();
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

  private ensureShield(): HTMLDivElement {
    if (this.shield) return this.shield;
    const shield = document.createElement("div");
    shield.setAttribute("aria-hidden", "true");
    Object.assign(shield.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "auto",
      cursor: "crosshair",
      background: "transparent",
      zIndex: "2147483644",
    });
    ["pointerdown", "pointerup", "contextmenu"].forEach((eventName) => {
      shield.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
      }, true);
    });
    document.documentElement.appendChild(shield);
    this.shield = shield;
    return shield;
  }

  private elementAtPoint(clientX: number, clientY: number): HTMLElement | null {
    const shield = this.shield;
    const overlay = this.overlay;
    if (shield) shield.style.display = "none";
    if (overlay) overlay.style.display = "none";
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (shield) shield.style.display = "block";
    return element;
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
    this.removeDragHandlers();
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
      left: `${Math.max(window.innerWidth - 344, 16)}px`,
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
    title.style.cursor = "move";
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
    const effectLabel = document.createElement("label");
    effectLabel.textContent = "拦截效果";
    effectLabel.style.display = "block";
    effectLabel.style.marginBottom = "4px";
    const effect = document.createElement("select");
    [
      ["hide", "隐藏元素"],
      ["image", "替换为本地图片/GIF"],
      ["text", "替换为文字"],
      ["html", "替换为自定义 HTML"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      effect.appendChild(option);
    });
    Object.assign(effect.style, { width: "100%", marginBottom: "8px", padding: "6px", borderRadius: "6px" });
    const valueInput = document.createElement("textarea");
    valueInput.rows = 2;
    valueInput.placeholder = "替换文字或 HTML";
    Object.assign(valueInput.style, { width: "100%", boxSizing: "border-box", marginBottom: "12px", padding: "7px", borderRadius: "6px", resize: "vertical" });
    const imageInput = document.createElement("input");
    imageInput.type = "file";
    imageInput.accept = "image/*,.gif";
    imageInput.title = "请选择不超过 2MB 的图片或 GIF";
    Object.assign(imageInput.style, { width: "100%", boxSizing: "border-box", marginBottom: "12px", color: "#cbd5e1" });
    imageInput.addEventListener("change", () => {
      const file = imageInput.files?.[0];
      imageInput.dataset.value = "";
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        imageInput.value = "";
        imageInput.title = "文件超过 2MB，请选择较小的图片或 GIF";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        imageInput.dataset.value = typeof reader.result === "string" ? reader.result : "";
      };
      reader.readAsDataURL(file);
    });
    const updateValueInput = (): void => {
      const needsValue = effect.value !== "hide";
      const isImage = effect.value === "image" || effect.value === "gif";
      valueInput.style.display = needsValue && !isImage ? "block" : "none";
      imageInput.style.display = isImage ? "block" : "none";
      effectLabel.textContent = effect.value === "text" ? "替换文字" : effect.value === "html" ? "自定义 HTML（危险标签会被过滤）" : isImage ? "本地图片/GIF" : "拦截效果";
      valueInput.placeholder = effect.value === "text" ? "例如：广告已拦截" : "例如：<span>广告已拦截</span>";
    };
    effect.addEventListener("change", updateValueInput);
    updateValueInput();
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    const cancel = document.createElement("button");
    cancel.textContent = "取消";
    const reselect = document.createElement("button");
    reselect.textContent = "重新选择";
    const confirm = document.createElement("button");
    confirm.textContent = "确定拦截";
    [cancel, reselect, confirm].forEach((button) => {
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
    cancel.addEventListener("click", () => this.exit());
    reselect.addEventListener("click", () => this.startPicking());
    confirm.addEventListener("click", () => this.confirmSelection());
    actions.append(cancel, reselect, confirm);
    title.addEventListener("mousedown", (event) => {
      this.dragging = true;
      this.dragOffset = {
        x: event.clientX - dialog.offsetLeft,
        y: event.clientY - dialog.offsetTop,
      };
      event.preventDefault();
    });
    const onDrag = (event: MouseEvent): void => {
      if (!this.dragging || !this.dialog) return;
      const width = this.dialog.offsetWidth;
      const height = this.dialog.offsetHeight;
      const left = Math.min(
        Math.max(event.clientX - this.dragOffset.x, 8),
        Math.max(8, window.innerWidth - width - 8),
      );
      const top = Math.min(
        Math.max(event.clientY - this.dragOffset.y, 8),
        Math.max(8, window.innerHeight - height - 8),
      );
      this.dialog.style.left = `${left}px`;
      this.dialog.style.top = `${top}px`;
      this.dialog.style.right = "auto";
    };
    const stopDrag = (): void => {
      this.dragging = false;
    };
    this.dragMoveHandler = onDrag;
    this.dragStopHandler = stopDrag;
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
    dialog.append(title, size, range, level, effectLabel, effect, valueInput, imageInput, actions);
    host.appendChild(dialog);
    document.documentElement.appendChild(host);
    this.host = host;
    this.dialog = dialog;
    update();
  }

  private onMove = (event: MouseEvent): void => {
    if (!this.selecting) return;
    const target = this.elementAtPoint(event.clientX, event.clientY);
    if (target && !this.isOwnElement(target)) this.highlight(target);
  };

  private onClick = (event: MouseEvent): void => {
    if (!this.selecting) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const target = this.elementAtPoint(event.clientX, event.clientY);
    if (!target || this.isOwnElement(target)) return;
    this.candidates = this.ancestors(target);
    if (this.candidates.length) {
      this.selected = this.candidates[0];
      this.stopPicking();
      this.renderDialog();
    }
  };

  private onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.exit();
      return;
    }
    if (this.selecting) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  };

  triggerAdBlocker(): void {
    void this.inject();
    this.startPicking();
  }

  private startPicking(): void {
    this.dialog?.remove();
    this.dialog = null;
    this.selecting = true;
    this.candidates = [];
    this.selected = null;
    this.ensureOverlay();
    this.ensureShield();
    document.addEventListener("mousemove", this.onMove, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKey, true);
  }

  private stopPicking(): void {
    this.selecting = false;
    document.removeEventListener("mousemove", this.onMove, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.shield?.remove();
    this.shield = null;
    if (this.overlay) this.overlay.style.display = "none";
  }

  private confirmSelection(): void {
    if (!this.selected) return;
    const effect = this.dialog?.querySelector("select")?.value as AdBlockRule["effect"] | undefined;
    const textValue = (this.dialog?.querySelector("textarea") as HTMLTextAreaElement | null)?.value.trim() || "";
    const imageValue = (this.dialog?.querySelector("input[type=file]") as HTMLInputElement | null)?.dataset.value || "";
    const value = effect === "image" || effect === "gif" ? imageValue : textValue;
    if (effect && effect !== "hide" && !value) return;
    const rule: AdBlockRule = {
      xpath: xpathFor(this.selected),
      ...(this.selected.id ? { id: this.selected.id } : {}),
      tagName: this.selected.tagName.toLowerCase(),
      ...(typeof this.selected.className === "string" && this.selected.className
        ? { className: this.selected.className }
        : {}),
      hostname: location.hostname,
      createdAt: new Date().toISOString(),
      effect: effect || "hide",
      ...(value ? { value } : {}),
    };
    const rules = getRules().filter(
      (item) => item.xpath !== rule.xpath && (!rule.id || item.id !== rule.id),
    );
    saveRules([...rules, rule]);
    applyRule(this.selected, rule);
    this.exit();
  }

  private cancelSelection(): void {
    this.removeDragHandlers();
    this.selected = null;
    this.dialog?.remove();
    this.dialog = null;
    this.candidates = [];
    if (this.overlay) this.overlay.style.display = "none";
  }

  private exit(): void {
    this.stopPicking();
    this.cancelSelection();
    this.overlay?.remove();
    this.overlay = null;
    this.host?.remove();
    this.host = null;
  }

  private removeDragHandlers(): void {
    if (this.dragMoveHandler) {
      document.removeEventListener("mousemove", this.dragMoveHandler);
      this.dragMoveHandler = null;
    }
    if (this.dragStopHandler) {
      document.removeEventListener("mouseup", this.dragStopHandler);
      this.dragStopHandler = null;
    }
    this.dragging = false;
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
