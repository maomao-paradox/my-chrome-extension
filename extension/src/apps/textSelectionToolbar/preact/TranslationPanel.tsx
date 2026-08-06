/**
 * TranslationPanel 组件 - Preact 版本
 * 可拖拽的翻译/AI 解释面板，支持流式更新和震动反馈
 */
import { useState, useEffect, useRef, useCallback } from "react";
import "./styles/translation-panel.scss";

/**
 * 翻译状态类型
 */
type TranslationStatus = "loading" | "success" | "error";

/**
 * 位置接口
 */
interface TranslationPosition {
  left: number;
  top: number;
}

/**
 * TranslationPanel 组件属性接口
 */
interface TranslationPanelProps {
  /** 是否可见 */
  visible: boolean;
  /** 面板标题 */
  title?: string;
  /** 面板内容 */
  content: string;
  /** 翻译状态 */
  status?: TranslationStatus;
  /** 初始位置 */
  position?: TranslationPosition;
  /** 震动触发key（用于触发震动动画） */
  shakeKey?: number;
  /** 关闭事件 */
  onClose?: () => void;
}

/**
 * TranslationPanel 组件
 * 提供可拖拽的翻译面板UI
 */
const TranslationPanel: React.FC<TranslationPanelProps> = ({
  visible,
  title = "AI解释",
  content,
  status = "loading",
  position = { left: 100, top: 100 },
  shakeKey = 0,
  onClose,
}: TranslationPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<TranslationPosition>({
    left: position.left,
    top: position.top,
  });

  // 拖拽相关引用
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });
  const isDraggingRef = useRef(false);
  const handlersRef = useRef<{
    move?: (e: PointerEvent) => void;
    up?: () => void;
  }>({});

  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 限制值在指定范围内
   */
  const clamp = useCallback(
    (value: number, min: number, max: number): number => {
      return Math.min(Math.max(value, min), max);
    },
    [],
  );

  /**
   * 限制位置在可视区域内
   */
  const clampPosition = useCallback(
    (left: number, top: number): TranslationPosition => {
      const margin = 12;
      const panelWidth = panelRef.current?.offsetWidth ?? 560;
      const panelHeight = panelRef.current?.offsetHeight ?? 320;
      const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin);
      const maxTop = Math.max(
        margin,
        window.innerHeight - panelHeight - margin,
      );

      return {
        left: Math.round(clamp(left, margin, maxLeft)),
        top: Math.round(clamp(top, margin, maxTop)),
      };
    },
    [clamp],
  );

  /**
   * 同步位置
   */
  const syncPosition = useCallback(
    (newPosition: TranslationPosition) => {
      setCurrentPosition(clampPosition(newPosition.left, newPosition.top));
    },
    [clampPosition],
  );

  /**
   * 处理指针按下事件（开始拖拽）
   * 使用 ref 存储拖拽状态和处理器，避免闭包陷阱和多次拖拽后的监听器累积
   */
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);

      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startLeft: currentPosition.left,
        startTop: currentPosition.top,
      };

      // 清理之前残留的监听器（防止多次拖拽后累积）
      if (handlersRef.current.move) {
        document.removeEventListener("pointermove", handlersRef.current.move);
      }
      if (handlersRef.current.up) {
        document.removeEventListener("pointerup", handlersRef.current.up);
      }

      const moveHandler = (e: PointerEvent) => {
        if (!isDraggingRef.current) return;

        const deltaX = e.clientX - dragStateRef.current.startX;
        const deltaY = e.clientY - dragStateRef.current.startY;

        syncPosition({
          left: dragStateRef.current.startLeft + deltaX,
          top: dragStateRef.current.startTop + deltaY,
        });
      };

      const upHandler = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.removeEventListener("pointermove", moveHandler);
        document.removeEventListener("pointerup", upHandler);
        handlersRef.current.move = undefined;
        handlersRef.current.up = undefined;
      };

      handlersRef.current.move = moveHandler;
      handlersRef.current.up = upHandler;

      document.addEventListener("pointermove", moveHandler);
      document.addEventListener("pointerup", upHandler);
    },
    [currentPosition, syncPosition],
  );

  /**
   * 触发震动动画
   */
  const triggerShake = useCallback(() => {
    setIsShaking(false);
    requestAnimationFrame(() => {
      setIsShaking(true);
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
      }
      shakeTimerRef.current = setTimeout(() => {
        setIsShaking(false);
      }, 420);
    });
  }, []);

  // 监听 shakeKey 变化触发震动
  useEffect(() => {
    if (shakeKey > 0) {
      triggerShake();
    }
  }, [shakeKey, triggerShake]);

  // 组件卸载时清理残留的拖拽监听器
  useEffect(() => {
    return () => {
      if (handlersRef.current.move) {
        document.removeEventListener("pointermove", handlersRef.current.move);
      }
      if (handlersRef.current.up) {
        document.removeEventListener("pointerup", handlersRef.current.up);
      }
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
      }
    };
  }, []);

  // 位置样式
  const panelStyle = {
    left: `${currentPosition.left}px`,
    top: `${currentPosition.top}px`,
  };

  // 可见性处理
  if (!visible) return null;

  return (
    <div
      ref={panelRef}
      className={`translation-panel${isShaking ? " is-shaking" : ""}`}
      style={panelStyle}
    >
      <div
        className={`translation-panel__header${isDragging ? " is-dragging" : ""}`}
        onPointerDown={(e: PointerEvent) => handlePointerDown(e)}
      >
        <div className="translation-panel__title">{title}</div>
        <button
          className="translation-panel__close"
          type="button"
          aria-label="关闭翻译结果"
          onPointerDown={(e: PointerEvent) => e.stopPropagation()}
          onClick={() => onClose?.()}
        >
          ×
        </button>
      </div>
      <div
        className={`translation-panel__body is-${status}`}
        role="status"
        aria-live="polite"
      >
        {content}
      </div>
    </div>
  );
};

export default TranslationPanel;
export { TranslationPanel };
export type { TranslationStatus, TranslationPosition };
