/**
 * document_start 阶段运行的轻量广告规则应用器。
 * 这里只做规则匹配和替换，不创建选择器 UI，避免首屏出现广告闪帧。
 */

export interface EarlyAdBlockRule {
  selector?: string;
  xpath?: string;
  id?: string;
  effect?: "hide" | "image" | "gif" | "text" | "html";
  value?: string;
}

export const AD_BLOCK_STORAGE_KEY = "kria-nove:ad-block-rules";

export const readEarlyRules = (): EarlyAdBlockRule[] => {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(AD_BLOCK_STORAGE_KEY) || "[]",
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const writeEarlyRules = (rules: EarlyAdBlockRule[]): void => {
  window.localStorage.setItem(
    AD_BLOCK_STORAGE_KEY,
    JSON.stringify(rules.slice(-200)),
  );
};

export const resolveRuleElement = (rule: EarlyAdBlockRule): HTMLElement | null => {
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

const sanitizeHtml = (value: string): string => {
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

export const applyEarlyRule = (
  element: HTMLElement,
  rule: EarlyAdBlockRule,
): void => {
  if (
    element === document.body ||
    element === document.documentElement ||
    element.dataset.kriaAdBlockedEffect ===
      `${rule.effect || "hide"}:${rule.value || ""}`
  ) {
    return;
  }
  const effect = rule.effect || "hide";
  element.setAttribute("data-kria-ad-blocked", "true");
  if (effect === "hide") {
    element.style.setProperty("display", "none", "important");
    element.dataset.kriaAdBlockedEffect = "hide:";
    return;
  }

  const value = rule.value || "";
  element.dataset.kriaAdBlockedEffect = `${effect}:${value}`;
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
  } else if (effect === "html") {
    element.innerHTML = sanitizeHtml(value || "<span>广告已拦截</span>");
  } else if (/^(?:https?:\/\/|data:image\/|blob:)/i.test(value)) {
    const image = document.createElement("img");
    image.src = value;
    image.alt = "广告替换内容";
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

export const applyEarlyRules = (): void => {
  readEarlyRules().forEach((rule) => {
    const element = resolveRuleElement(rule);
    if (element) applyEarlyRule(element, rule);
  });
};

let earlyObserver: MutationObserver | null = null;

export const installEarlyAdBlocker = (): void => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const start = (): void => {
    applyEarlyRules();
    if (!earlyObserver && document.documentElement) {
      earlyObserver = new MutationObserver(() => applyEarlyRules());
      earlyObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  };
  if (document.documentElement) start();
  else document.addEventListener("readystatechange", start, { once: true });
};

export const stopEarlyAdBlocker = (): void => {
  earlyObserver?.disconnect();
  earlyObserver = null;
};
