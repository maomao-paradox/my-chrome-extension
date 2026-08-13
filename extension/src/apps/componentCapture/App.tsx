/**
 * ComponentCapture 应用主组件（React 版）
 * 从 App.vue 迁移而来
 *
 * 关键变更：
 * - Vue ref → useState（渲染相关）/ useRef（非渲染相关与 DOM 引用）
 * - eventManager.useBus（Vue composable，依赖 onMounted/onUnmounted）→ 直接使用 bus.on/off，在 useEffect 中管理订阅
 * - defineExpose → 不需要，通过事件总线触发内部方法
 * - 事件监听器用 ref 存储最新版本 + 稳定包装函数，避免 stale closure 与 add/removeEventListener 引用不匹配
 *
 * 顺序约束：稳定包装函数（handleMouseMoveStable 等）必须在使用它们的
 * exitCapture/cancelSelection/handleMouseDown/startCapture 之前声明，
 * 否则 TypeScript 会报 "used before declaration"。
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { bus } from "@/event/bus";
import "./styles/app.scss";

interface PopupPosition {
  selectionInfo: { top: number; left: number };
  componentPreview: { top: number; left: number };
}

const ComponentCaptureApp: React.FC = () => {
  // 渲染相关状态
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [capturedCode, setCapturedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({
    selectionInfo: {
      top: 20,
      left: window.innerWidth / 2 - 200,
    },
    componentPreview: {
      top: window.innerHeight / 2 - 250,
      left: window.innerWidth / 2 - 300,
    },
  });

  // 非渲染相关状态（用 ref，避免高频更新触发重渲染）
  const highlightOverlayRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragTargetRef = useRef<string | null>(null);

  // 用 ref 存储所有事件处理函数的最新版本
  // 稳定包装函数通过 .current 调用，始终能访问到最新逻辑
  const exitCaptureRef = useRef<() => void>(() => {});
  const handleMouseMoveRef = useRef<(event: MouseEvent) => void>(() => {});
  const handleClickRef = useRef<(event: MouseEvent) => void>(() => {});
  const handleKeyDownRef = useRef<(event: KeyboardEvent) => void>(() => {});
  const handleDragMoveRef = useRef<(event: MouseEvent) => void>(() => {});
  const handleMouseUpRef = useRef<() => void>(() => {});

  // ===== 稳定包装函数（引用永远不变，用于 add/removeEventListener） =====
  const handleMouseMoveStable = useCallback(
    (e: MouseEvent) => handleMouseMoveRef.current(e),
    [],
  );
  const handleClickStable = useCallback(
    (e: MouseEvent) => handleClickRef.current(e),
    [],
  );
  const handleKeyDownStable = useCallback(
    (e: KeyboardEvent) => handleKeyDownRef.current(e),
    [],
  );
  const handleDragMoveStable = useCallback(
    (e: MouseEvent) => handleDragMoveRef.current(e),
    [],
  );
  const handleMouseUpStable = useCallback(() => handleMouseUpRef.current(), []);

  // ===== 基础工具函数 =====
  const createHighlightOverlay = useCallback((): HTMLDivElement => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      z-index: 999998;
      transition: all 0.1s ease;
      border-radius: 4px;
    `;
    return overlay;
  }, []);

  const updateHighlight = useCallback((element: Element): void => {
    if (!highlightOverlayRef.current) {
      return;
    }
    const rect = element.getBoundingClientRect();
    highlightOverlayRef.current.style.left = `${rect.left + window.scrollX}px`;
    highlightOverlayRef.current.style.top = `${rect.top + window.scrollY}px`;
    highlightOverlayRef.current.style.width = `${rect.width}px`;
    highlightOverlayRef.current.style.height = `${rect.height}px`;
  }, []);

  const removeHighlight = useCallback((): void => {
    if (highlightOverlayRef.current && highlightOverlayRef.current.parentNode) {
      highlightOverlayRef.current.parentNode.removeChild(
        highlightOverlayRef.current,
      );
      highlightOverlayRef.current = null;
    }
  }, []);

  const isExtensionElement = useCallback((element: Element): boolean => {
    if (element.id === "ma-extension-shadow-host") {
      return true;
    }
    let current: Element | null = element;
    while (current) {
      if (current.id === "ma-extension-shadow-host") {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }, []);

  const extractElementStyles = useCallback((element: Element): string => {
    const styles = window.getComputedStyle(element);
    let styleStr = "";
    const importantStyles = [
      "display",
      "position",
      "top",
      "left",
      "width",
      "height",
      "margin",
      "padding",
      "border",
      "border-radius",
      "background",
      "color",
      "font-size",
      "font-family",
      "text-align",
      "line-height",
      "box-shadow",
    ];
    importantStyles.forEach((prop) => {
      const value = styles[prop as any];
      if (value && value !== "auto" && value !== "none") {
        styleStr += `  ${prop}: ${value};\n`;
      }
    });
    return styleStr;
  }, []);

  const extractElementCode = useCallback(
    (element: Element): string => {
      const clone = element.cloneNode(true) as Element;
      const attributesToRemove = [
        "onclick",
        "onload",
        "onerror",
        "onmouseover",
        "onmouseout",
        "onmousedown",
        "onmouseup",
      ];
      attributesToRemove.forEach((attr) => {
        clone.removeAttribute(attr);
        clone
          .querySelectorAll(`[${attr}]`)
          .forEach((el) => el.removeAttribute(attr));
      });

      let html = clone.outerHTML;
      html = html.replace(/></g, ">\n<").replace(/\n\s*\n/g, "\n");

      const styles = extractElementStyles(element);
      const tagName = element.tagName.toLowerCase();
      const idSelector = element.id ? `#${element.id}` : "";
      const classSelector = element.className
        ? `.${(element.className as string).split(" ").join(".")}`
        : "";

      return `<template><!-- 组件HTML结构 -->
${html}

<!-- 组件样式 --></template>
<style>
${tagName}${idSelector}${classSelector} {
${styles}}
</style>`;
    },
    [extractElementStyles],
  );

  // ===== 业务函数 =====
  const exitCapture = useCallback((): void => {
    setIsCapturing(false);
    setSelectedElement(null);
    setIsMinimized(false);
    removeHighlight();
    document.removeEventListener("mousemove", handleMouseMoveStable);
    document.removeEventListener("click", handleClickStable, true);
    document.removeEventListener("keydown", handleKeyDownStable);
    maLogger.log("组件捕获模式已退出");
  }, [
    removeHighlight,
    handleMouseMoveStable,
    handleClickStable,
    handleKeyDownStable,
  ]);

  // 让 exitCapture 可在 ref 中被其他处理函数调用（避免 stale closure）
  exitCaptureRef.current = exitCapture;

  const minimizePopup = useCallback((): void => {
    setIsMinimized(true);
    maLogger.log("组件捕获弹窗已缩小");
  }, []);

  const expandPopup = useCallback((): void => {
    setIsMinimized(false);
    maLogger.log("组件捕获弹窗已展开");
  }, []);

  const closePreview = useCallback((): void => {
    setShowPreview(false);
    setCapturedCode("");
  }, []);

  const copyCode = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(capturedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      maLogger.log("代码已复制到剪贴板");
    } catch (error) {
      maLogger.error("复制代码失败:", error);
      const textarea = document.createElement("textarea");
      textarea.value = capturedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [capturedCode]);

  const confirmSelection = useCallback((): void => {
    if (!selectedElement) {
      return;
    }
    maLogger.log("已选择元素:", selectedElement);
    const code = extractElementCode(selectedElement);
    setCapturedCode(code);
    setShowPreview(true);
    exitCapture();
  }, [selectedElement, extractElementCode, exitCapture]);

  const cancelSelection = useCallback((): void => {
    setSelectedElement(null);
    document.addEventListener("mousemove", handleMouseMoveStable);
    document.addEventListener("click", handleClickStable, true);
    document.addEventListener("keydown", handleKeyDownStable);
  }, [handleMouseMoveStable, handleClickStable, handleKeyDownStable]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent, target: string): void => {
      isDraggingRef.current = true;
      dragTargetRef.current = target;
      dragStartXRef.current = event.clientX;
      dragStartYRef.current = event.clientY;
      document.addEventListener("mousemove", handleDragMoveStable);
      document.addEventListener("mouseup", handleMouseUpStable);
    },
    [handleDragMoveStable, handleMouseUpStable],
  );

  // ===== 事件处理函数实现（每轮渲染更新到 ref，保证访问最新 state） =====
  handleMouseMoveRef.current = (event: MouseEvent): void => {
    if (!isCapturing) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (
        element &&
        element !== highlightOverlayRef.current &&
        !isExtensionElement(element)
      ) {
        updateHighlight(element);
      }
    } catch (error) {
      maLogger.warn("获取元素失败:", error);
    }
  };

  handleClickRef.current = (event: MouseEvent): void => {
    const target = event.target as Element;
    if (target === highlightOverlayRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (
      element &&
      element !== highlightOverlayRef.current &&
      !isExtensionElement(element)
    ) {
      setSelectedElement(element);
      document.removeEventListener("mousemove", handleMouseMoveStable);
      document.removeEventListener("click", handleClickStable, true);
      document.removeEventListener("keydown", handleKeyDownStable);
    }
  };

  handleKeyDownRef.current = (event: KeyboardEvent): void => {
    if (!isCapturing) {
      return;
    }
    if (event.key === "Escape") {
      exitCaptureRef.current();
    }
  };

  handleDragMoveRef.current = (event: MouseEvent): void => {
    if (!isDraggingRef.current || !dragTargetRef.current) {
      return;
    }
    const deltaX = event.clientX - dragStartXRef.current;
    const deltaY = event.clientY - dragStartYRef.current;
    if (dragTargetRef.current === "selectionInfo") {
      setPopupPosition((prev) => ({
        ...prev,
        selectionInfo: {
          top: prev.selectionInfo.top + deltaY,
          left: prev.selectionInfo.left + deltaX,
        },
      }));
    } else if (dragTargetRef.current === "componentPreview") {
      setPopupPosition((prev) => ({
        ...prev,
        componentPreview: {
          top: prev.componentPreview.top + deltaY,
          left: prev.componentPreview.left + deltaX,
        },
      }));
    }
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
  };

  handleMouseUpRef.current = (): void => {
    isDraggingRef.current = false;
    dragTargetRef.current = null;
    document.removeEventListener("mousemove", handleDragMoveStable);
    document.removeEventListener("mouseup", handleMouseUpStable);
  };

  // ===== 开始捕获 =====
  const startCapture = useCallback((): void => {
    setIsCapturing(true);
    setSelectedElement(null);
    setShowPreview(false);
    setCapturedCode("");
    setIsMinimized(false);

    if (!highlightOverlayRef.current) {
      highlightOverlayRef.current = createHighlightOverlay();
      document.body.appendChild(highlightOverlayRef.current);
    }

    document.addEventListener("mousemove", handleMouseMoveStable);
    document.addEventListener("click", handleClickStable, true);
    document.addEventListener("keydown", handleKeyDownStable);

    maLogger.log("组件捕获模式已启动");
  }, [
    createHighlightOverlay,
    handleMouseMoveStable,
    handleClickStable,
    handleKeyDownStable,
  ]);

  // ===== 监听事件总线启动捕获 + 卸载时清理 =====
  useEffect(() => {
    maLogger.log("组件捕获应用挂载，启动监听事件总线");
    // 监听事件总线启动捕获
    const onStart = () => startCapture();
    bus.on("start-component-capture", onStart);

    return () => {
      bus.off("start-component-capture", onStart);
      // 组件卸载时确保退出捕获模式，移除所有监听器与高亮
      document.removeEventListener("mousemove", handleMouseMoveStable);
      document.removeEventListener("click", handleClickStable, true);
      document.removeEventListener("keydown", handleKeyDownStable);
      document.removeEventListener("mousemove", handleDragMoveStable);
      document.removeEventListener("mouseup", handleMouseUpStable);
      removeHighlight();
    };
  }, [
    startCapture,
    handleMouseMoveStable,
    handleClickStable,
    handleKeyDownStable,
    handleDragMoveStable,
    handleMouseUpStable,
    removeHighlight,
  ]);

  const selectedTagName = selectedElement?.tagName.toLowerCase() ?? "";
  const selectedId = selectedElement?.id ?? "";
  const selectedClassName =
    (selectedElement?.className as string | undefined) ?? "";

  return (
    <div className="component-capture-container">
      {/* 悬浮提示框背景 */}
      {isCapturing && <div className="capture-overlay"></div>}

      {/* 圆形缩小图标 */}
      {isCapturing && isMinimized && (
        <div className="minimized-icon" onClick={expandPopup}>
          <span>🔍</span>
        </div>
      )}

      {/* 选中元素信息 */}
      {isCapturing && selectedElement && !isMinimized && (
        <div
          className="selection-info"
          style={{
            top: `${popupPosition.selectionInfo.top}px`,
            left: `${popupPosition.selectionInfo.left}px`,
            transform: "none",
          }}
          onMouseDown={(e) => handleMouseDown(e, "selectionInfo")}
        >
          <div className="info-header" style={{ cursor: "move" }}>
            <span className="element-tag">&lt;{selectedTagName}&gt;</span>
            <div className="header-buttons">
              <button
                className="minimize-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  minimizePopup();
                }}
              >
                −
              </button>
              <button
                className="close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  exitCapture();
                }}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="info-body">
            {selectedId && (
              <div className="info-item">
                <span className="label">ID:</span>
                <span className="value">#{selectedId}</span>
              </div>
            )}
            {selectedClassName && (
              <div className="info-item">
                <span className="label">Class:</span>
                <span className="value">
                  .{selectedClassName.split(" ").join(".")}
                </span>
              </div>
            )}
          </div>
          <div className="info-footer">
            <button
              className="cancel-btn"
              onClick={(e) => {
                e.stopPropagation();
                cancelSelection();
              }}
            >
              取消
            </button>
            <button
              className="confirm-btn"
              onClick={(e) => {
                e.stopPropagation();
                confirmSelection();
              }}
            >
              确认捕获
            </button>
          </div>
        </div>
      )}

      {/* 组件预览和代码展示 */}
      {showPreview && capturedCode && (
        <div
          className="component-preview"
          style={{
            top: `${popupPosition.componentPreview.top}px`,
            left: `${popupPosition.componentPreview.left}px`,
          }}
          onMouseDown={(e) => handleMouseDown(e, "componentPreview")}
        >
          <div className="preview-header" style={{ cursor: "move" }}>
            <h3>🎉 组件捕获成功！</h3>
            <button
              className="close-preview-btn"
              onClick={(e) => {
                e.stopPropagation();
                closePreview();
              }}
            >
              ✕
            </button>
          </div>
          <div className="preview-content">
            <div className="code-section">
              <div className="section-header">
                <span>组件代码</span>
                <button
                  className="copy-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyCode();
                  }}
                >
                  {copied ? "已复制 ✓" : "复制代码"}
                </button>
              </div>
              <textarea
                className="code-display"
                readOnly
                value={capturedCode}
              ></textarea>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentCaptureApp;
