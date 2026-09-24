// ============ 枚举定义（原文件未给出，这里补全以便代码可运行） ============
export enum PositionStrategy {
  Top = "top",
  Down = "down",
  Left = "left",
  Right = "right",
  TopLeft = "top-left",
  TopRight = "top-right",
  LeftDown = "left-down",
  RightDown = "right-down",
}

// ============ ElementPositionInfo ============
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

    // 元素属性（用 getAttribute 兼容 SVGAnimatedString）
    this.id = options.element?.id || "";
    this.className =
      (options.element?.getAttribute?.("class") as string | null) || "";
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

    // 确定目标 Shadow Root
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

    // 设置位置样式：默认用元素自身 z-index，style 可覆盖
    const positionStyle: Record<string, string> = {
      position: "fixed",
      top: `${this.top}px`,
      left: `${this.left}px`,
      width: `${this.width}px`,
      height: `${this.height}px`,
      zIndex: String(this["z-index"] || 9999),
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

    // 插入到 Shadow DOM
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
      alignment = "center",
      offset,
      observeReference = false,
      pinned = false,
      containment = "outside",
    } = options;

    const offsetX = offset?.x ?? 0;
    const offsetY = offset?.y ?? 0;
    const inside = containment === "inside";

    if (pinned) {
      Object.assign(targetElement.style, {
        position: "fixed",
        zIndex: String(this["z-index"] || 9999),
      });
    }

    const elemW = targetElement.offsetWidth;
    const elemH = targetElement.offsetHeight;

    const isVertical =
      strategy === PositionStrategy.Top || strategy === PositionStrategy.Down;

    let x = 0;
    let y = 0;

    // ---- 主方向：贴哪条边 ----
    if (strategy === PositionStrategy.Top) {
      y = inside ? this.top + offsetY : this.top - elemH - offsetY;
    } else if (strategy === PositionStrategy.Down) {
      y = inside ? this.bottom - elemH - offsetY : this.bottom + offsetY;
    } else if (strategy === PositionStrategy.Left) {
      x = inside ? this.left + offsetX : this.left - elemW - offsetX;
    } else if (strategy === PositionStrategy.Right) {
      x = inside ? this.right - elemW - offsetX : this.right + offsetX;
    }

    // ---- 交叉轴：alignment ----
    if (isVertical) {
      if (alignment === "start") {
        x = inside ? this.left + offsetX : this.left - elemW - offsetX;
      } else if (alignment === "center") {
        x = this.left + (this.width - elemW) / 2 + offsetX;
      } else {
        x = inside ? this.right - elemW - offsetX : this.right + offsetX;
      }
    } else {
      if (alignment === "start") {
        y = inside ? this.top + offsetY : this.top - elemH - offsetY;
      } else if (alignment === "center") {
        y = this.top + (this.height - elemH) / 2 + offsetY;
      } else {
        y = inside ? this.bottom - elemH - offsetY : this.bottom + offsetY;
      }
    }

    // ---- 视口裁剪 ----
    let finalX = Math.max(
      0,
      Math.min(x, Math.max(0, this.viewport.width - elemW)),
    );
    let finalY = Math.max(
      0,
      Math.min(y, Math.max(0, this.viewport.height - elemH)),
    );

    // ---- inside 时，额外 clamp 到参考元素矩形内 ----
    if (inside) {
      // 参考元素自身的可用区间
      const innerLeft = this.left;
      const innerRight = this.right - elemW; // 元素左上角 x 的上限
      const innerTop = this.top;
      const innerBottom = this.bottom - elemH; // 元素左上角 y 的上限

      // 若参考元素比元素还小，则退化为「居中在参考元素内」
      if (innerRight < innerLeft) {
        finalX = this.left + (this.width - elemW) / 2;
      } else {
        finalX = Math.max(innerLeft, Math.min(finalX, innerRight));
      }

      if (innerBottom < innerTop) {
        finalY = this.top + (this.height - elemH) / 2;
      } else {
        finalY = Math.max(innerTop, Math.min(finalY, innerBottom));
      }
    }

    targetElement.style.left = `${finalX}px`;
    targetElement.style.top = `${finalY}px`;
    targetElement.style.transform = "";

    if (observeReference) {
      setupReferenceObserver(this.element, targetElement);
    }

    return targetElement;
  }
}

// ============ 参考元素观察器 ============
const setupReferenceObserver = (
  referenceElement: Node | null,
  targetElement: HTMLElement,
): void => {
  // 先断开旧的 observer，避免泄漏
  const prev = (targetElement as any).__referenceObserver as
    | MutationObserver
    | undefined;
  if (prev) {
    prev.disconnect();
    (targetElement as any).__referenceObserver = undefined;
  }

  if (!referenceElement) {
    return;
  }

  const checkAndRemove = () => {
    let exists = false;
    try {
      exists = document.contains(referenceElement);
    } catch {
      exists = false;
    }

    if (exists && referenceElement instanceof Element) {
      const style = window.getComputedStyle(referenceElement);
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
      (targetElement as any).__referenceObserver = undefined;
    }
  };

  const observer = new MutationObserver(checkAndRemove);

  // 只观察 body 的子节点变化 + 参考元素自身的属性/样式变化
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  if (referenceElement instanceof Element) {
    observer.observe(referenceElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  }

  (targetElement as any).__referenceObserver = observer;
};

// ============ 获取元素绝对位置 ============
export function getElementAbsolutePosition(
  element: HTMLElement | Element,
): ElementPositionInfo {
  // 用 Element 判断，兼容 SVGElement 等
  if (!element || !(element instanceof Element)) {
    throw new Error("Invalid element provided");
  }

  // 获取元素的绝对位置
  const rect = element.getBoundingClientRect();

  // 计算视口滚动偏移
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  // 获取视口尺寸
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  // 获取元素的 zIndex
  const zIndex = getActualZIndex(element as HTMLElement);

  // 返回 ElementPositionInfo 类的实例
  return new ElementPositionInfo({
    element: element as HTMLElement,
    rect,
    zIndex,
    scrollX,
    scrollY,
    viewportWidth,
    viewportHeight,
  });
}

// ============ 获取实际的 z-index 值 ============
export function getActualZIndex(element: HTMLElement | null): number {
  let current: HTMLElement | null = element;

  while (current && current !== document.documentElement) {
    const cs = window.getComputedStyle(current);

    // z-index 只在 position 非 static 时生效
    if (cs.position !== "static") {
      const zIndex = cs.zIndex;
      if (zIndex !== "auto") {
        const parsed = parseInt(zIndex, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }

    current = current.parentElement;
  }

  return 0;
}
