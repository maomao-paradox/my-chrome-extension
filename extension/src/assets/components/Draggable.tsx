/**
 * Draggable.tsx - React 版共享拖拽组件
 * 从 Vue 版 Draggable.vue 迁移而来，保持完全相同的 Props/API/行为
 *
 * 关键设计：
 * - 高频更新状态（translateX/Y, targetX/Y）用 useRef，避免 rAF 动画触发重渲染
 * - transform 通过 ref 直接操作 DOM style，绕过 React 渲染周期，保证 60fps
 * - 用 forwardRef + useImperativeHandle 暴露 getCurrentPosition/setPosition/setPositionImmediate
 * - 事件用 window.addEventListener capture 模式，解决 iframe 环境下拖动跟丢问题
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import "./Draggable.scss";

/** 预设初始位置类型 */
export type InitialPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "center";

/** 拖拽组件 Props */
export interface DraggableProps {
  /** 自定义类名 */
  customClass?: string;
  /** 初始X坐标 */
  initialX?: number;
  /** 初始Y坐标 */
  initialY?: number;
  /** 预设初始位置 */
  initialPosition?: InitialPosition;
  /** 边缘检测距离 */
  edgeDistance?: number;
  /** 吸附边距 */
  adsorbMargin?: number;
  /** 是否启用吸附功能 */
  enableAdsorption?: boolean;
  /** 是否允许超出屏幕 */
  canOverflow?: boolean;
  /** 容器样式 */
  containerStyle?: React.CSSProperties;
  /** 缓动因子，值越大过渡越慢，范围 0-1 */
  easeFactor?: number;
  /** 拖拽手柄选择器，只有点击该选择器匹配的元素才会触发拖拽 */
  dragHandle?: string;
  /** 元素宽度（用于位置计算，默认 45）*/
  width?: number;
  /** 元素高度（用于位置计算，默认 45）*/
  height?: number;
  /** 子节点 */
  children?: React.ReactNode;
  /** 拖拽开始事件 */
  onDragStart?: (event: MouseEvent | TouchEvent) => void;
  /** 拖拽中事件 */
  onDragging?: (event: MouseEvent | TouchEvent, x: number, y: number) => void;
  /** 拖拽结束事件 */
  onDragEnd?: (event: MouseEvent | TouchEvent, x: number, y: number) => void;
  /** 吸附事件 */
  onAdsorbed?: (direction: "left" | "right" | "top" | "bottom") => void;
  /** 点击事件（非拖拽）*/
  onClick?: (event: MouseEvent | TouchEvent) => void;
  /** 组件挂载/吸附完成事件，返回位置 */
  onMove?: (x: number, y: number) => void;
}

/** 通过 ref 暴露的命令式 API */
export interface DraggableHandle {
  /** 获取当前位置 */
  getCurrentPosition: () => { x: number; y: number };
  /** 设置位置（带平滑过渡动画）*/
  setPosition: (x: number, y: number) => void;
  /** 立即设置位置（无动画）*/
  setPositionImmediate: (x: number, y: number) => void;
}

/** 移动阈值，超过则认为是拖拽 */
const MOVE_THRESHOLD = 10;

/**
 * Draggable 拖拽组件
 * 支持：鼠标/触摸拖拽、边缘吸附、拖拽手柄、预设位置、平滑过渡动画
 */
const Draggable = forwardRef<DraggableHandle, DraggableProps>(
  (
    {
      customClass = "",
      initialX = 0,
      initialY = 0,
      initialPosition = "center",
      edgeDistance = 50,
      adsorbMargin = 0,
      enableAdsorption = false,
      canOverflow = false,
      containerStyle,
      easeFactor = 0.2,
      dragHandle = "",
      width = 45,
      height = 45,
      children,
      onDragStart,
      onDragging,
      onDragEnd,
      onAdsorbed,
      onClick,
      onMove,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // 仅 isDragging 需要 React 渲染（控制 mask 显示）
    const [isDragging, setIsDragging] = useState(false);

    // 高频更新状态用 useRef，避免 rAF 触发重渲染
    const translateX = useRef(initialX);
    const translateY = useRef(initialY);
    const targetX = useRef(initialX);
    const targetY = useRef(initialY);
    const animationFrameId = useRef<number | null>(null);
    const isPositionInitialized = useRef(false);
    const hasExceededThreshold = useRef(false);

    // 拖拽临时状态（非响应式）
    const initialLeftRef = useRef(0);
    const initialTopRef = useRef(0);
    const startXRef = useRef(0);
    const startYRef = useRef(0);

    // MutationObserver 引用
    const mutationObserverRef = useRef<MutationObserver | null>(null);

    // 保存最新回调到 ref，避免事件监听器闭包陈旧
    const callbacksRef = useRef({
      onDragStart,
      onDragging,
      onDragEnd,
      onAdsorbed,
      onClick,
      onMove,
      enableAdsorption,
      canOverflow,
      edgeDistance,
      adsorbMargin,
      easeFactor,
      dragHandle,
      width,
      height,
      initialPosition,
    });

    // 同步最新 props 到 callbacksRef
    callbacksRef.current = {
      onDragStart,
      onDragging,
      onDragEnd,
      onAdsorbed,
      onClick,
      onMove,
      enableAdsorption,
      canOverflow,
      edgeDistance,
      adsorbMargin,
      easeFactor,
      dragHandle,
      width,
      height,
      initialPosition,
    };

    /**
     * 直接操作 DOM style 设置 transform，绕过 React 渲染周期
     * 这是保证 60fps 的关键
     */
    const applyTransform = useCallback(() => {
      if (containerRef.current) {
        containerRef.current.style.setProperty(
          "--translate-x",
          `${translateX.current}px`
        );
        containerRef.current.style.setProperty(
          "--translate-y",
          `${translateY.current}px`
        );
      }
    }, []);

    /**
     * 平滑过渡动画函数（递归 rAF）
     */
    const animatePosition = useCallback(() => {
      const dx = targetX.current - translateX.current;
      const dy = targetY.current - translateY.current;

      // 距离小于阈值，直接到位，避免抖动
      if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
        translateX.current = targetX.current;
        translateY.current = targetY.current;
        applyTransform();
        if (animationFrameId.current !== null) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
        return;
      }

      // 转换为基于 60fps 的因子，值越大过渡越慢
      const factor =
        1 - Math.pow(1 - (1 - callbacksRef.current.easeFactor), 60 / 16);

      translateX.current += dx * factor;
      translateY.current += dy * factor;
      applyTransform();

      animationFrameId.current = requestAnimationFrame(animatePosition);
    }, [applyTransform]);

    /**
     * 获取元素宽高（基于子元素计算）
     */
    const getElementWidthAndHeight = useCallback(() => {
      if (!containerRef.current) {
        return { width: 0, height: 0 };
      }
      const childrenEls = containerRef.current.children;
      let elementWidth = 0;
      let elementHeight = 0;
      for (let i = 0; i < childrenEls.length; i++) {
        const rect = childrenEls[i].getBoundingClientRect();
        elementWidth = Math.max(elementWidth, rect.width);
        elementHeight = Math.max(elementHeight, rect.height);
      }
      return {
        width: elementWidth < callbacksRef.current.width ? callbacksRef.current.width : elementWidth,
        height: elementHeight < callbacksRef.current.height ? callbacksRef.current.height : elementHeight,
      };
    }, []);

    /**
     * 获取元素位置
     */
    const getElementRectPosition = useCallback(() => {
      if (!containerRef.current) {
        return { left: 0, top: 0, width: 0, height: 0 };
      }
      const rect = containerRef.current.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }, []);

    /**
     * 计算初始位置（确保元素在屏幕内）
     */
    const calculateInitialPosition = useCallback(() => {
      if (!containerRef.current) return;
      // 已初始化则不再重置（防止吸附后重置）
      if (isPositionInitialized.current) return;

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const { width: elementWidth, height: elementHeight } = getElementWidthAndHeight();

      let newX = translateX.current;
      let newY = translateY.current;

      // 处理预设位置
      const pos = callbacksRef.current.initialPosition;
      const margin = callbacksRef.current.adsorbMargin;
      if (pos) {
        switch (pos) {
          case "top-left":
            newX = margin; newY = margin; break;
          case "top-right":
            newX = windowWidth - elementWidth - margin; newY = margin; break;
          case "bottom-left":
            newX = margin; newY = windowHeight - elementHeight - margin; break;
          case "bottom-right":
            newX = windowWidth - elementWidth - margin; newY = windowHeight - elementHeight - margin; break;
          case "top":
            newX = (windowWidth - elementWidth) / 2; newY = margin; break;
          case "right":
            newX = windowWidth - elementWidth - margin; newY = (windowHeight - elementHeight) / 2; break;
          case "bottom":
            newX = (windowWidth - elementWidth) / 2; newY = windowHeight - elementHeight - margin; break;
          case "left":
            newX = margin; newY = (windowHeight - elementHeight) / 2; break;
          case "center":
            newX = (windowWidth - elementWidth) / 2; newY = (windowHeight - elementHeight) / 2; break;
        }
      }

      // 限制在屏幕范围内
      newX = Math.max(0, Math.min(windowWidth - elementWidth, newX));
      newY = Math.max(0, Math.min(windowHeight - elementHeight, newY));

      // 使用平滑过渡
      targetX.current = newX;
      targetY.current = newY;
      animatePosition();

      isPositionInitialized.current = true;
      callbacksRef.current.onMove?.(translateX.current, translateY.current);
    }, [animatePosition, getElementWidthAndHeight]);

    /**
     * 检查边缘吸附
     */
    const checkAbsorption = useCallback(() => {
      if (!containerRef.current) return;

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const { width: elementWidth, height: elementHeight } = getElementWidthAndHeight();
      const elementRect = containerRef.current.getBoundingClientRect();

      const leftDistance = elementRect.left;
      const topDistance = elementRect.top;
      const rightDistance = windowWidth - elementRect.right;
      const bottomDistance = windowHeight - elementRect.bottom;

      const { edgeDistance, adsorbMargin } = callbacksRef.current;
      let shouldAdsorb = false;
      let newTranslateX = translateX.current;
      let newTranslateY = translateY.current;
      let adsorbedDirection: "left" | "right" | "top" | "bottom" | null = null;

      // X 轴吸附
      if (leftDistance < edgeDistance) {
        newTranslateX = adsorbMargin;
        shouldAdsorb = true;
        adsorbedDirection = "left";
      } else if (rightDistance < edgeDistance) {
        newTranslateX = windowWidth - elementWidth - adsorbMargin;
        shouldAdsorb = true;
        adsorbedDirection = "right";
      }

      // Y 轴吸附
      if (topDistance < edgeDistance) {
        newTranslateY = adsorbMargin;
        shouldAdsorb = true;
        adsorbedDirection = "top";
      } else if (bottomDistance < edgeDistance) {
        newTranslateY = windowHeight - elementHeight - adsorbMargin;
        shouldAdsorb = true;
        adsorbedDirection = "bottom";
      }

      if (shouldAdsorb && adsorbedDirection) {
        translateX.current = newTranslateX;
        translateY.current = newTranslateY;
        applyTransform();
        callbacksRef.current.onMove?.(translateX.current, translateY.current);
        callbacksRef.current.onAdsorbed?.(adsorbedDirection);
      }
    }, [applyTransform, getElementWidthAndHeight]);

    /**
     * 拖拽中事件处理
     */
    const onDrag = useCallback(
      (event: MouseEvent | TouchEvent) => {
        if (!containerRef.current) return;
        setIsDragging(true);

        const e = "touches" in event ? event.touches[0] : event;
        const clientX = e.clientX;
        const clientY = e.clientY;

        const deltaX = clientX - startXRef.current;
        const deltaY = clientY - startYRef.current;
        const distance = deltaX ** 2 + deltaY ** 2;

        if (distance > MOVE_THRESHOLD ** 2) {
          hasExceededThreshold.current = true;
        }

        let newTranslateX = initialLeftRef.current + deltaX;
        let newTranslateY = initialTopRef.current + deltaY;

        // 限制在屏幕范围内
        if (!callbacksRef.current.canOverflow) {
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;
          const { width: elementWidth, height: elementHeight } = getElementWidthAndHeight();
          newTranslateX = Math.max(0, Math.min(windowWidth - elementWidth, newTranslateX));
          newTranslateY = Math.max(0, Math.min(windowHeight - elementHeight, newTranslateY));
        }

        // 拖拽中直接更新位置，不用平滑过渡，确保实时响应
        translateX.current = newTranslateX;
        translateY.current = newTranslateY;
        targetX.current = newTranslateX;
        targetY.current = newTranslateY;
        applyTransform();

        event.preventDefault();
        event.stopPropagation();

        callbacksRef.current.onDragging?.(event, translateX.current, translateY.current);
      },
      [applyTransform, getElementWidthAndHeight]
    );

    /**
     * 结束拖拽事件处理
     */
    const endDrag = useCallback(
      (event: MouseEvent | TouchEvent) => {
        if (!containerRef.current) return;

        window.removeEventListener("mousemove", onDrag, { capture: true } as any);
        window.removeEventListener("mouseup", endDrag, { capture: true } as any);

        if (!hasExceededThreshold.current) {
          // 未超过阈值 → 点击事件
          setTimeout(() => {
            callbacksRef.current.onClick?.(event);
          }, 0);
        } else {
          // 启用吸附则检查
          if (callbacksRef.current.enableAdsorption) {
            checkAbsorption();
          }
          callbacksRef.current.onDragEnd?.(event, translateX.current, translateY.current);
        }

        setIsDragging(false);
        hasExceededThreshold.current = false;

        // 恢复 MutationObserver
        if (mutationObserverRef.current && containerRef.current) {
          mutationObserverRef.current.observe(containerRef.current, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["style", "class"],
            characterData: false,
          });
        }
      },
      [checkAbsorption]
    );

    /**
     * 开始拖拽
     */
    const startDrag = useCallback(
      (event: MouseEvent | TouchEvent) => {
        if (!containerRef.current) return;

        const e = "touches" in event ? event.touches[0] : event;
        const target = e.target as HTMLElement;

        // 检查拖拽手柄
        if (callbacksRef.current.dragHandle) {
          if (!target.closest(callbacksRef.current.dragHandle)) {
            return;
          }
        }

        // 检查可交互元素（antd: .ant-input/.ant-btn；Element Plus: .el-input/.el-button）
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLButtonElement ||
          target.closest("button") ||
          target.closest("input") ||
          target.closest("textarea") ||
          target.closest(".el-input") ||
          target.closest(".el-button") ||
          target.closest(".ant-input") ||
          target.closest(".ant-btn") ||
          target.closest(".ant-select")
        ) {
          return;
        }

        const clientX = e.clientX;
        const clientY = e.clientY;
        const { left, top } = getElementRectPosition();

        initialLeftRef.current = left;
        initialTopRef.current = top;
        hasExceededThreshold.current = false;
        setIsDragging(true);

        // 暂停 MutationObserver
        mutationObserverRef.current?.disconnect();

        startXRef.current = clientX;
        startYRef.current = clientY;

        // window capture 模式，解决 iframe 跟丢
        window.addEventListener("mousemove", onDrag, { capture: true, passive: false });
        window.addEventListener("mouseup", endDrag, { capture: true });

        callbacksRef.current.onDragStart?.(event);

        event.preventDefault();
        event.stopPropagation();
      },
      [getElementRectPosition, onDrag, endDrag]
    );

    // 暴露命令式 API
    useImperativeHandle(
      ref,
      (): DraggableHandle => ({
        getCurrentPosition: () => ({ x: translateX.current, y: translateY.current }),
        setPosition: (x, y) => {
          targetX.current = x;
          targetY.current = y;
          animatePosition();
        },
        setPositionImmediate: (x, y) => {
          targetX.current = x;
          targetY.current = y;
          translateX.current = x;
          translateY.current = y;
          applyTransform();
        },
      }),
      [animatePosition, applyTransform]
    );

    // 挂载：计算初始位置 + 启动 MutationObserver
    useEffect(() => {
      const raf = requestAnimationFrame(calculateInitialPosition);

      const observer = new MutationObserver(() => {
        calculateInitialPosition();
      });
      mutationObserverRef.current = observer;
      if (containerRef.current) {
        observer.observe(containerRef.current, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class"],
          characterData: false,
        });
      }

      return () => {
        cancelAnimationFrame(raf);
        if (animationFrameId.current !== null) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
        observer.disconnect();
      };
    }, [calculateInitialPosition]);

    // 合并容器样式
    const mergedStyle: React.CSSProperties = {
      ...containerStyle,
      // transform 通过 CSS 变量驱动，由 ref 直接操作 DOM
      transform: "translate(var(--translate-x, 0), var(--translate-y, 0))",
    };

    return (
      <>
        {isDragging && (
          <div
            className="drag-mask"
            onMouseMove={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onTouchCancel={(e) => e.stopPropagation()}
            onMouseLeave={(e) => e.stopPropagation()}
          />
        )}
        <div
          ref={containerRef}
          className={`draggable-container ${customClass}`}
          style={mergedStyle}
          onMouseDown={(e) => startDrag(e as unknown as MouseEvent)}
          onTouchStart={(e) => startDrag(e as unknown as TouchEvent)}
        >
          {children}
        </div>
      </>
    );
  }
);

Draggable.displayName = "Draggable";

export default Draggable;
