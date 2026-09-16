/**
 * 元素位置信息类
 * 封装元素的绝对位置信息和相关操作方法
 */

export enum PositionStrategy {
  Top = "top",
  Down = "down",
  Left = "left",
  Right = "right",
  Center = "center",
  TopLeft = "top-left",
  TopRight = "top-right",
  LeftDown = "left-down",
  RightDown = "right-down",
}

export class ElementPositionInfo {
  public element: HTMLElement | null;
  // 视口相对位置
  public top: number;
  public left: number;
  public right: number;
  public bottom: number;
  public width: number;
  public height: number;
  public "z-index": number;

  // 文档绝对位置
  public absoluteTop: number;
  public absoluteLeft: number;

  // 元素属性
  public id: string;
  public className: string;
  public tagName: string;

  // 视口信息
  public viewport: {
    width: number;
    height: number;
  };

  constructor(options: {
    element?: HTMLElement | null;
    rect: DOMRect;
    zIndex: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
  }) {
    this.element = options.element || null;
    // 视口相对位置
    this.top = options.rect.top;
    this.left = options.rect.left;
    this.right = options.rect.right;
    this.bottom = options.rect.bottom;
    this.width = options.rect.width;
    this.height = options.rect.height;
    this["z-index"] = options.zIndex;

    // 文档绝对位置
    this.absoluteTop = options.rect.top + options.scrollY;
    this.absoluteLeft = options.rect.left + options.scrollX;

    // 元素属性
    this.id = options.element?.id || "";
    this.className = options.element?.className || "";
    this.tagName = options.element?.tagName || "";

    // 视口信息
    this.viewport = {
      width: options.viewportWidth,
      height: options.viewportHeight,
    };
  }

  public insertToShadow(options: {
    shadowRoot?: ShadowRoot;
    shadowHostId?: string;
    content?: string | HTMLElement;
    style?: Record<string, string>;
    attrs?: Record<string, string>;
  }): HTMLElement {
    const { shadowRoot, shadowHostId, content, style, attrs } = options;

    // 确定目标Shadow Root
    let targetShadowRoot: ShadowRoot;

    if (shadowRoot) {
      targetShadowRoot = shadowRoot;
    } else if (shadowHostId) {
      const shadowHost = document.getElementById(shadowHostId);
      if (!shadowHost || !shadowHost.shadowRoot) {
        throw new Error(
          `Shadow host with id "${shadowHostId}" not found or has no shadow root`,
        );
      }
      targetShadowRoot = shadowHost.shadowRoot;
    } else {
      throw new Error("Either shadowRoot or shadowHostId must be provided");
    }

    // 创建容器元素
    const container = document.createElement("div");

    // 设置位置样式
    const positionStyle = {
      position: "fixed",
      top: `${this.top}px`,
      left: `${this.left}px`,
      width: `${this.width}px`,
      height: `${this.height}px`,
      zIndex: "9999",
      ...style,
    };

    // 应用样式
    Object.assign(container.style, positionStyle);

    // 应用属性
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        container.setAttribute(key, value);
      });
    }

    // 添加内容
    if (content) {
      if (typeof content === "string") {
        container.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        container.appendChild(content);
      }
    }

    // 插入到Shadow DOM
    targetShadowRoot.appendChild(container);

    return container;
  }

  public positionElement(options: {
    targetElement: { _observers?: any } & HTMLElement;
    strategy?: PositionStrategy;
    alignment?: "start" | "center" | "end";
    offset?: { x?: number; y?: number };
    observeReference?: boolean;
    pinned?: boolean;
    containment?: "inside" | "outside";
  }): HTMLElement {
    const {
      targetElement,
      strategy = PositionStrategy.Down,
      alignment = "start",
      offset,
      observeReference = false,
      pinned = false,
      containment = "outside",
    } = options;
    const offsetX = offset?.x ?? 0,
      offsetY = offset?.y ?? 0,
      inside = containment === "inside";
    const elemW = targetElement.offsetWidth,
      elemH = targetElement.offsetHeight;

    if (pinned) {
      Object.assign(targetElement.style, {
        position: "fixed",
        zIndex: "9999",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
      });
    }

    const positionMap: Record<string, { x?: number; y?: number }> = {
      top: { y: inside ? this.top + offsetY : this.top - elemH - offsetY },
      down: {
        y: inside ? this.bottom - elemH - offsetY : this.bottom + offsetY,
      },
      left: { x: inside ? this.left + offsetX : this.left - elemW - offsetX },
      right: {
        x: inside ? this.right - elemW - offsetX : this.right + offsetX,
      },
      "top-left": inside
        ? { x: this.left + offsetX, y: this.top + offsetY }
        : { x: this.left - elemW - offsetX, y: this.top - elemH - offsetY },
      "top-right": inside
        ? { x: this.right - elemW - offsetX, y: this.top + offsetY }
        : { x: this.right + offsetX, y: this.top - elemH - offsetY },
      "left-down": inside
        ? { x: this.left + offsetX, y: this.bottom - elemH - offsetY }
        : { x: this.left - elemW - offsetX, y: this.bottom + offsetY },
      "right-down": inside
        ? { x: this.right - elemW - offsetX, y: this.bottom - elemH - offsetY }
        : { x: this.right + offsetX, y: this.bottom + offsetY },
    };

    let { x, y } = positionMap[strategy as keyof typeof positionMap] ?? {};
    x ??= this.left + (this.width - elemW) / 2 + offsetX;
    y ??= this.top + (this.height - elemH) / 2 + offsetY;

    if (alignment === "center") {
      strategy === "top" || strategy === "down"
        ? (x = this.left + (this.width - elemW) / 2 + offsetX)
        : (y = this.top + (this.height - elemH) / 2 + offsetY);
    } else if (alignment === "end") {
      strategy === "top" || strategy === "down"
        ? (x = this.right - elemW + offsetX)
        : (y = this.bottom - elemH + offsetY);
    }

    const finalX = Math.max(0, Math.min(x, this.viewport.width - elemW));
    const finalY = Math.max(0, Math.min(y, this.viewport.height - elemH));

    Object.defineProperties(targetElement.style, {
      left: { value: `${finalX}px` },
      top: { value: `${finalY}px` },
    });

    if (observeReference) {
      setupReferenceObserver(this.element, targetElement);
    }

    return targetElement;
  }
}

const setupReferenceObserver = (
  referenceElement: Node | null,
  targetElement: HTMLElement,
): void => {
  const observer = new MutationObserver(() => {
    let exists = false;
    try {
      exists = document.contains(referenceElement);
    } catch {
      exists = false;
    }
    if (exists) {
      const style = window.getComputedStyle(referenceElement as Element);
      exists =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0";
    }
    if (!exists) {
      try {
        targetElement.remove();
      } catch {}
      observer.disconnect();
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "display", "visibility"],
  });
  (targetElement as any).__referenceObserver = observer;
};

export function getElementAbsolutePosition(
  element: HTMLElement | Node,
): ElementPositionInfo {
  // 检查元素是否有效
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error("Invalid HTML element provided");
  }

  // 获取元素的绝对位置
  const rect = element.getBoundingClientRect();

  maLogger.log("元素的绝对位置：", rect);

  // 计算视口滚动偏移
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  // 获取视口尺寸
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  // 获取元素的zIndex
  const zIndex = getActualZIndex(element);

  // 返回ElementPositionInfo类的实例
  return new ElementPositionInfo({
    element,
    rect,
    zIndex,
    scrollX,
    scrollY,
    viewportWidth,
    viewportHeight,
  });
}

// 获取实际的 z-index 值
export function getActualZIndex(element: HTMLElement | null) {
  let current = element;
  while (current && current !== document.documentElement) {
    const zIndex = window.getComputedStyle(current).zIndex;
    if (zIndex !== "auto" && !isNaN(parseInt(zIndex, 10))) {
      return parseInt(zIndex, 10);
    }
    current = current.parentElement;
  }
  return 0;
}
