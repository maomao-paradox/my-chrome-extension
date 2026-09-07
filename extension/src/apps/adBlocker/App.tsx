import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RotateCcw, ShieldCheck, X } from "lucide-react";
import { blockElement, type AdBlockEffect } from "./adBlocker";

const HOST_ID = "ma-extension-adblocker-host";
const HIGHLIGHT_ID = "ma-extension-adblocker-highlight";
const SHIELD_ID = "ma-extension-adblocker-shield";
const MAX_PARENT_LEVELS = 12;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

interface AdBlockerAppProps {
  startRequest: number;
}

type InteractionMode = "idle" | "picking" | "reviewing";

interface ElementSize {
  width: number;
  height: number;
}

interface DragState {
  x: number;
  y: number;
}

const isExtensionElement = (element: Element | null): boolean =>
  Boolean(element?.closest(`#${HOST_ID}`));

const getCandidates = (element: HTMLElement): HTMLElement[] => {
  const candidates: HTMLElement[] = [];
  let current: HTMLElement | null = element;

  while (
    current &&
    current !== document.documentElement &&
    candidates.length < MAX_PARENT_LEVELS
  ) {
    if (current !== document.body && !isExtensionElement(current)) {
      candidates.push(current);
    }
    current = current.parentElement;
  }

  return candidates;
};

const createHighlight = (): HTMLDivElement => {
  const highlight = document.createElement("div");
  highlight.id = HIGHLIGHT_ID;
  highlight.setAttribute("aria-hidden", "true");
  Object.assign(highlight.style, {
    position: "fixed",
    display: "none",
    pointerEvents: "none",
    boxSizing: "border-box",
    border: "2px solid #ff3d81",
    boxShadow:
      "0 0 0 9999px rgba(9, 13, 25, 0.18), 0 0 0 5px rgba(255, 61, 129, 0.25)",
    zIndex: "2147483645",
  });
  document.documentElement.appendChild(highlight);
  return highlight;
};

const createShield = (): HTMLDivElement => {
  const shield = document.createElement("div");
  shield.id = SHIELD_ID;
  shield.setAttribute("aria-hidden", "true");
  Object.assign(shield.style, {
    position: "fixed",
    inset: "0",
    cursor: "crosshair",
    background: "transparent",
    zIndex: "2147483644",
  });
  document.documentElement.appendChild(shield);
  return shield;
};

const AdBlockerApp: React.FC<AdBlockerAppProps> = ({ startRequest }) => {
  const [mode, setMode] = useState<InteractionMode>("idle");
  const [candidates, setCandidates] = useState<HTMLElement[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<ElementSize | null>(null);
  const [effect, setEffect] = useState<AdBlockEffect>("hide");
  const [textValue, setTextValue] = useState("");
  const [imageData, setImageData] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [dialogPosition, setDialogPosition] = useState(() => ({
    top: 24,
    left: Math.max(window.innerWidth - 344, 16),
  }));
  const [dragOffset, setDragOffset] = useState<DragState | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const shieldRef = useRef<HTMLDivElement | null>(null);
  const lastStartRequestRef = useRef(0);

  const selectedElement = candidates[selectedIndex] ?? null;
  const isImageEffect = effect === "image" || effect === "gif";
  const replacementValue = isImageEffect ? imageData : textValue.trim();
  const isConfirmDisabled =
    !selectedElement || (effect !== "hide" && !replacementValue);

  const hideHighlight = useCallback(() => {
    if (highlightRef.current) {
      highlightRef.current.style.display = "none";
    }
  }, []);

  const highlightElement = useCallback(
    (element: HTMLElement | null, updateSize = false) => {
      if (!element || !element.isConnected) {
        hideHighlight();
        if (updateSize) setSelectedSize(null);
        return;
      }

      const rect = element.getBoundingClientRect();
      const highlight = highlightRef.current ?? createHighlight();
      highlightRef.current = highlight;
      Object.assign(highlight.style, {
        display: "block",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${Math.max(rect.width, 1)}px`,
        height: `${Math.max(rect.height, 1)}px`,
      });

      if (updateSize) {
        setSelectedSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    },
    [hideHighlight],
  );

  const stopInteraction = useCallback(() => {
    setMode("idle");
    setCandidates([]);
    setSelectedIndex(0);
    setSelectedSize(null);
    setErrorMessage("");
    setDragOffset(null);
    hideHighlight();
  }, [hideHighlight]);

  const startPicking = useCallback(() => {
    setCandidates([]);
    setSelectedIndex(0);
    setSelectedSize(null);
    setErrorMessage("");
    setDragOffset(null);
    hideHighlight();
    setMode("picking");
  }, [hideHighlight]);

  useEffect(() => {
    if (!startRequest || startRequest === lastStartRequestRef.current) return;
    lastStartRequestRef.current = startRequest;
    startPicking();
  }, [startPicking, startRequest]);

  useEffect(() => {
    if (mode !== "picking") return;

    const shield = createShield();
    shieldRef.current = shield;

    const elementAtPoint = (x: number, y: number): HTMLElement | null => {
      shield.style.display = "none";
      if (highlightRef.current) highlightRef.current.style.display = "none";
      const element = document.elementFromPoint(x, y) as HTMLElement | null;
      shield.style.display = "block";
      return element;
    };

    const preventPageInteraction = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleMouseMove = (event: MouseEvent): void => {
      const element = elementAtPoint(event.clientX, event.clientY);
      if (element && !isExtensionElement(element)) {
        highlightElement(element);
      } else {
        hideHighlight();
      }
    };

    const handleClick = (event: MouseEvent): void => {
      preventPageInteraction(event);
      const element = elementAtPoint(event.clientX, event.clientY);
      if (!element || isExtensionElement(element)) return;

      const nextCandidates = getCandidates(element);
      if (!nextCandidates.length) return;
      setCandidates(nextCandidates);
      setSelectedIndex(0);
      setMode("reviewing");
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        preventPageInteraction(event);
        stopInteraction();
        return;
      }
      preventPageInteraction(event);
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("pointerdown", preventPageInteraction, true);
    document.addEventListener("pointerup", preventPageInteraction, true);
    document.addEventListener("contextmenu", preventPageInteraction, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("pointerdown", preventPageInteraction, true);
      document.removeEventListener("pointerup", preventPageInteraction, true);
      document.removeEventListener("contextmenu", preventPageInteraction, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      shield.remove();
      shieldRef.current = null;
    };
  }, [hideHighlight, highlightElement, mode, stopInteraction]);

  useEffect(() => {
    if (mode !== "reviewing" || !selectedElement) return;

    const refreshHighlight = (): void =>
      highlightElement(selectedElement, true);
    refreshHighlight();

    const resizeObserver = new ResizeObserver(refreshHighlight);
    resizeObserver.observe(selectedElement);
    window.addEventListener("resize", refreshHighlight);
    document.addEventListener("scroll", refreshHighlight, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", refreshHighlight);
      document.removeEventListener("scroll", refreshHighlight, true);
      hideHighlight();
    };
  }, [hideHighlight, highlightElement, mode, selectedElement]);

  useEffect(() => {
    if (!dragOffset) return;

    const handleMouseMove = (event: MouseEvent): void => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const left = Math.min(
        Math.max(event.clientX - dragOffset.x, 8),
        Math.max(8, window.innerWidth - dialog.offsetWidth - 8),
      );
      const top = Math.min(
        Math.max(event.clientY - dragOffset.y, 8),
        Math.max(8, window.innerHeight - dialog.offsetHeight - 8),
      );
      setDialogPosition({ left, top });
    };
    const stopDragging = (): void => setDragOffset(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopDragging);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopDragging);
    };
  }, [dragOffset]);

  useEffect(
    () => () => {
      shieldRef.current?.remove();
      highlightRef.current?.remove();
      shieldRef.current = null;
      highlightRef.current = null;
    },
    [],
  );

  const effectLabel = useMemo(() => {
    if (effect === "text") return "替换文字";
    if (effect === "html") return "自定义 HTML（危险标签会被过滤）";
    if (isImageEffect) return "本地图片/GIF";
    return "拦截效果";
  }, [effect, isImageEffect]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setImageData("");
    setErrorMessage("");
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      event.currentTarget.value = "";
      setErrorMessage("文件不能超过 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageData(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => setErrorMessage("图片读取失败，请重新选择");
    reader.readAsDataURL(file);
  };

  const handleConfirm = (): void => {
    if (!selectedElement || isConfirmDisabled) return;
    blockElement(selectedElement, effect, replacementValue);
    stopInteraction();
  };

  if (mode === "idle") return null;

  if (mode === "picking") {
    return (
      <div className="ad-blocker-picking-tip" role="status">
        <span>点击要拦截的广告区域</span>
        <kbd>Esc</kbd>
      </div>
    );
  }

  return (
    <div className="ad-blocker-container">
      <section
        ref={dialogRef}
        className="ad-blocker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-blocker-title"
        style={{ top: dialogPosition.top, left: dialogPosition.left }}
      >
        <header
          className="ad-blocker-dialog__header"
          onMouseDown={(event) => {
            if (!dialogRef.current) return;
            event.preventDefault();
            setDragOffset({
              x: event.clientX - dialogRef.current.offsetLeft,
              y: event.clientY - dialogRef.current.offsetTop,
            });
          }}
        >
          <div>
            <span className="ad-blocker-dialog__eyebrow">AD BLOCKER</span>
            <h2 id="ad-blocker-title">选择拦截区域</h2>
          </div>
          <button
            className="ad-blocker-icon-button"
            type="button"
            title="取消拦截"
            aria-label="取消拦截"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={stopInteraction}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="ad-blocker-dialog__body">
          <div className="ad-blocker-measurement" aria-live="polite">
            <span>
              {selectedSize
                ? `${selectedSize.width} x ${selectedSize.height} px`
                : "区域不可见"}
            </span>
            <code>&lt;{selectedElement?.tagName.toLowerCase() ?? "?"}&gt;</code>
          </div>

          <label className="ad-blocker-field" htmlFor="ad-blocker-level">
            <span>
              元素层级
              <strong>
                {selectedIndex + 1} / {candidates.length}
              </strong>
            </span>
            <input
              id="ad-blocker-level"
              type="range"
              min="0"
              max={Math.max(candidates.length - 1, 0)}
              value={selectedIndex}
              onChange={(event) => {
                setErrorMessage("");
                setSelectedIndex(Number(event.currentTarget.value));
              }}
            />
          </label>

          <label className="ad-blocker-field" htmlFor="ad-blocker-effect">
            <span>{effectLabel}</span>
            <select
              id="ad-blocker-effect"
              value={effect}
              onChange={(event) => {
                setEffect(event.currentTarget.value as AdBlockEffect);
                setErrorMessage("");
              }}
            >
              <option value="hide">隐藏元素</option>
              <option value="image">替换为本地图片/GIF</option>
              <option value="text">替换为文字</option>
              <option value="html">替换为自定义 HTML</option>
            </select>
          </label>

          {effect !== "hide" && !isImageEffect && (
            <label className="ad-blocker-field" htmlFor="ad-blocker-value">
              <span>{effect === "text" ? "替换内容" : "HTML 内容"}</span>
              <textarea
                id="ad-blocker-value"
                rows={3}
                value={textValue}
                placeholder={
                  effect === "text"
                    ? "例如：广告已拦截"
                    : "例如：<span>广告已拦截</span>"
                }
                onChange={(event) => {
                  setTextValue(event.currentTarget.value);
                  setErrorMessage("");
                }}
              />
            </label>
          )}

          {isImageEffect && (
            <label className="ad-blocker-field" htmlFor="ad-blocker-image">
              <span>选择图片（最大 2MB）</span>
              <input
                id="ad-blocker-image"
                type="file"
                accept="image/*,.gif"
                onChange={handleFileChange}
              />
            </label>
          )}

          {errorMessage && (
            <p className="ad-blocker-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <footer className="ad-blocker-dialog__actions">
          <button
            className="ad-blocker-button ad-blocker-button--secondary"
            type="button"
            onClick={startPicking}
          >
            <RotateCcw size={15} aria-hidden="true" />
            重新选择
          </button>
          <button
            className="ad-blocker-button ad-blocker-button--primary"
            type="button"
            disabled={isConfirmDisabled}
            onClick={handleConfirm}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            确定拦截
          </button>
        </footer>
      </section>
    </div>
  );
};

export default AdBlockerApp;
