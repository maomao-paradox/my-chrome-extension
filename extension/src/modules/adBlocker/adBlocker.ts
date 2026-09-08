import { getCSSSelector } from "@/utils/element-control";

export interface AdBlockRule {
  selector?: string;
  xpath?: string;
  id?: string;
  tagName: string;
  className?: string;
  hostname: string;
  createdAt: string;
  /** hide keeps the legacy behavior; other effects replace the element contents. */
  effect?: "hide" | "image" | "gif" | "text" | "html";
  value?: string;
}

export type AdBlockEffect = NonNullable<AdBlockRule["effect"]>;

const STORAGE_KEY = "kria-nove:ad-block-rules";

export const getRules = (): AdBlockRule[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveRules = (rules: AdBlockRule[]): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules.slice(-200)));
};

const safeHtml = (value: string): string => {
  const template = document.createElement("template");
  template.innerHTML = value;
  template.content
    .querySelectorAll("script,iframe,object,embed,link,style")
    .forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (
        /^on/i.test(attribute.name) ||
        (["href", "src", "srcdoc"].includes(attribute.name) &&
          /^javascript:/i.test(attribute.value))
      ) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return template.innerHTML;
};

export const applyRule = (element: HTMLElement, rule: AdBlockRule): void => {
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
    Object.assign(text.style, {
      display: "block",
      padding: "12px",
      textAlign: "center",
    });
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
    Object.assign(image.style, {
      display: "block",
      width: "100%",
      height: "auto",
      objectFit: "contain",
    });
    element.appendChild(image);
  } else {
    element.textContent = effect === "gif" ? "GIF 地址无效" : "图片地址无效";
  }
};

const xpathLiteral = (value: string): string => {
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  const parts = value.split('"');
  return `concat(${parts.map((part, index) => `${index ? `,'"',` : ""}"${part}"`).join("")})`;
};

export const xpathFor = (element: Element): string => {
  if (element.id) {
    return `//*[@id=${xpathLiteral(element.id)}]`;
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

export const createRule = (element: HTMLElement, effect: AdBlockEffect, value = ""): AdBlockRule => ({
  selector: getCSSSelector(element),
  xpath: xpathFor(element),
  id: element.id || undefined,
  tagName: element.tagName.toLowerCase(),
  className: typeof element.className === "string" && element.className ? element.className : undefined,
  hostname: location.hostname,
  createdAt: new Date().toISOString(),
  effect,
  value: value || undefined,
});

export const blockElement = (element: HTMLElement, effect: AdBlockEffect = "hide", value = ""): AdBlockRule => {
  const rule = createRule(element, effect, value);
  const rules = getRules().filter((item) => {
    if (rule.id && item.id === rule.id) return false;
    if (rule.selector && item.selector === rule.selector) return false;
    if (rule.xpath && item.xpath === rule.xpath) return false;
    return true;
  });
  saveRules([...rules, rule]);
  applyRule(element, rule);
  return rule;
};

export const resolveRuleElement = (
  rule: AdBlockRule,
): HTMLElement | null => {
  if (rule.id) {
    const byId = document.getElementById(rule.id);
    if (byId) return byId;
  }
  if (rule.selector) {
    const bySelector = document.querySelector<HTMLElement>(rule.selector);
    if (bySelector) return bySelector;
  }
  if (rule.xpath) {
    const byXPath = document.evaluate(
      rule.xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue as HTMLElement | null;
    if (byXPath) return byXPath;
  }
  return null;
};

export const applyRules = (): void => {
  getRules().forEach((rule) => {
    const element = resolveRuleElement(rule) as HTMLElement | null;
    if (element) applyRule(element, rule);
  });
};
