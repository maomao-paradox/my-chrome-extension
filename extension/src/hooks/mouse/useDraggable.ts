import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";

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

export interface DraggableProps {
  customClass?: string;
  initialX?: number;
  initialY?: number;
  initialPosition?: InitialPosition;
  edgeDistance?: number;
  adsorbMargin?: number;
  enableAdsorption?: boolean;
  canOverflow?: boolean;
  containerStyle?: CSSProperties;
  easeFactor?: number;
  dragHandle?: string;
  width?: number;
  height?: number;
  children?: ReactNode;
  onDragStart?: (event: MouseEvent | TouchEvent) => void;
  onDragging?: (event: MouseEvent | TouchEvent, x: number, y: number) => void;
  onDragEnd?: (event: MouseEvent | TouchEvent, x: number, y: number) => void;
  onAdsorbed?: (direction: "left" | "right" | "top" | "bottom") => void;
  onClick?: (event: MouseEvent | TouchEvent) => void;
  onMove?: (x: number, y: number) => void;
}

export interface DraggableHandle {
  getCurrentPosition: () => { x: number; y: number };
  setPosition: (x: number, y: number) => void;
  setPositionImmediate: (x: number, y: number) => void;
}

const MOVE_THRESHOLD = 10;
type DragEvent = MouseEvent | TouchEvent;

const getEventPoint = (event: DragEvent) => {
  if (!("touches" in event)) return event;
  return event.touches[0] ?? event.changedTouches[0] ?? null;
};

export function useDraggable(
  props: DraggableProps,
  forwardedRef: ForwardedRef<DraggableHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const translateX = useRef(props.initialX ?? 0);
  const translateY = useRef(props.initialY ?? 0);
  const targetX = useRef(props.initialX ?? 0);
  const targetY = useRef(props.initialY ?? 0);
  const animationFrameId = useRef<number | null>(null);
  const isPositionInitialized = useRef(false);
  const hasExceededThreshold = useRef(false);
  const initialLeft = useRef(0);
  const initialTop = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const observerRef = useRef<MutationObserver | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const removeGlobalListenersRef = useRef<() => void>(() => undefined);
  const propsRef = useRef(props);
  propsRef.current = props;

  const applyTransform = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.setProperty("--translate-x", `${translateX.current}px`);
    container.style.setProperty("--translate-y", `${translateY.current}px`);
  }, []);

  const animatePosition = useCallback(() => {
    const deltaX = targetX.current - translateX.current;
    const deltaY = targetY.current - translateY.current;
    if (Math.abs(deltaX) < 0.1 && Math.abs(deltaY) < 0.1) {
      translateX.current = targetX.current;
      translateY.current = targetY.current;
      applyTransform();
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      return;
    }

    const easeFactor = propsRef.current.easeFactor ?? 0.2;
    const factor = 1 - Math.pow(1 - (1 - easeFactor), 60 / 16);
    translateX.current += deltaX * factor;
    translateY.current += deltaY * factor;
    applyTransform();
    animationFrameId.current = requestAnimationFrame(animatePosition);
  }, [applyTransform]);

  const getElementSize = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { width: 0, height: 0 };
    let width = 0;
    let height = 0;
    for (const child of Array.from(container.children)) {
      const rect = child.getBoundingClientRect();
      width = Math.max(width, rect.width);
      height = Math.max(height, rect.height);
    }
    return {
      width: Math.max(width, propsRef.current.width ?? 45),
      height: Math.max(height, propsRef.current.height ?? 45),
    };
  }, []);

  const calculateInitialPosition = useCallback(() => {
    if (!containerRef.current || isPositionInitialized.current) return;
    const { width, height } = getElementSize();
    const margin = propsRef.current.adsorbMargin ?? 0;
    let x = translateX.current;
    let y = translateY.current;

    switch (propsRef.current.initialPosition ?? "center") {
      case "top-left": x = margin; y = margin; break;
      case "top-right": x = window.innerWidth - width - margin; y = margin; break;
      case "bottom-left": x = margin; y = window.innerHeight - height - margin; break;
      case "bottom-right": x = window.innerWidth - width - margin; y = window.innerHeight - height - margin; break;
      case "top": x = (window.innerWidth - width) / 2; y = margin; break;
      case "right": x = window.innerWidth - width - margin; y = (window.innerHeight - height) / 2; break;
      case "bottom": x = (window.innerWidth - width) / 2; y = window.innerHeight - height - margin; break;
      case "left": x = margin; y = (window.innerHeight - height) / 2; break;
      case "center": x = (window.innerWidth - width) / 2; y = (window.innerHeight - height) / 2; break;
    }

    targetX.current = Math.max(0, Math.min(window.innerWidth - width, x));
    targetY.current = Math.max(0, Math.min(window.innerHeight - height, y));
    animatePosition();
    isPositionInitialized.current = true;
    propsRef.current.onMove?.(translateX.current, translateY.current);
  }, [animatePosition, getElementSize]);

  const checkAbsorption = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = getElementSize();
    const rect = container.getBoundingClientRect();
    const edgeDistance = propsRef.current.edgeDistance ?? 50;
    const margin = propsRef.current.adsorbMargin ?? 0;
    let direction: "left" | "right" | "top" | "bottom" | null = null;
    let x = translateX.current;
    let y = translateY.current;

    if (rect.left < edgeDistance) {
      x = margin;
      direction = "left";
    } else if (window.innerWidth - rect.right < edgeDistance) {
      x = window.innerWidth - width - margin;
      direction = "right";
    }
    if (rect.top < edgeDistance) {
      y = margin;
      direction = "top";
    } else if (window.innerHeight - rect.bottom < edgeDistance) {
      y = window.innerHeight - height - margin;
      direction = "bottom";
    }

    if (!direction) return;
    translateX.current = x;
    translateY.current = y;
    applyTransform();
    propsRef.current.onMove?.(x, y);
    propsRef.current.onAdsorbed?.(direction);
  }, [applyTransform, getElementSize]);

  const onDrag = useCallback((event: DragEvent) => {
    if (!containerRef.current) return;
    const point = getEventPoint(event);
    if (!point) return;
    setIsDragging(true);
    const deltaX = point.clientX - startX.current;
    const deltaY = point.clientY - startY.current;
    if (deltaX ** 2 + deltaY ** 2 > MOVE_THRESHOLD ** 2) {
      hasExceededThreshold.current = true;
    }

    let x = initialLeft.current + deltaX;
    let y = initialTop.current + deltaY;
    if (!propsRef.current.canOverflow) {
      const { width, height } = getElementSize();
      x = Math.max(0, Math.min(window.innerWidth - width, x));
      y = Math.max(0, Math.min(window.innerHeight - height, y));
    }

    translateX.current = x;
    translateY.current = y;
    targetX.current = x;
    targetY.current = y;
    applyTransform();
    event.preventDefault();
    event.stopPropagation();
    propsRef.current.onDragging?.(event, x, y);
  }, [applyTransform, getElementSize]);

  const endDrag = useCallback((event: DragEvent, cancelled = false) => {
    if (!containerRef.current) return;
    removeGlobalListenersRef.current();
    if (!cancelled && !hasExceededThreshold.current) {
      clickTimerRef.current = window.setTimeout(() => {
        propsRef.current.onClick?.(event);
        clickTimerRef.current = null;
      }, 0);
    } else if (!cancelled) {
      if (propsRef.current.enableAdsorption) checkAbsorption();
      propsRef.current.onDragEnd?.(event, translateX.current, translateY.current);
    }

    setIsDragging(false);
    hasExceededThreshold.current = false;
    const container = containerRef.current;
    if (observerRef.current && container) {
      observerRef.current.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }
  }, [checkAbsorption]);

  const onTouchCancel = useCallback((event: TouchEvent) => {
    endDrag(event, true);
  }, [endDrag]);

  const removeGlobalListeners = useCallback(() => {
    window.removeEventListener("mousemove", onDrag, true);
    window.removeEventListener("mouseup", endDrag, true);
    window.removeEventListener("touchmove", onDrag, true);
    window.removeEventListener("touchend", endDrag, true);
    window.removeEventListener("touchcancel", onTouchCancel, true);
  }, [onDrag, endDrag, onTouchCancel]);
  removeGlobalListenersRef.current = removeGlobalListeners;

  const startDrag = useCallback((event: DragEvent) => {
    const container = containerRef.current;
    const point = getEventPoint(event);
    const target = event.target;
    if (!container || !point || !(target instanceof Element)) return;
    const dragHandle = propsRef.current.dragHandle;
    if (dragHandle && !target.closest(dragHandle)) return;
    if (target.closest("button, input, textarea, .el-input, .el-button, .ant-input, .ant-btn, .ant-select")) return;

    const rect = container.getBoundingClientRect();
    initialLeft.current = rect.left;
    initialTop.current = rect.top;
    startX.current = point.clientX;
    startY.current = point.clientY;
    hasExceededThreshold.current = false;
    setIsDragging(true);
    observerRef.current?.disconnect();

    window.addEventListener("mousemove", onDrag, { capture: true, passive: false });
    window.addEventListener("mouseup", endDrag, true);
    window.addEventListener("touchmove", onDrag, { capture: true, passive: false });
    window.addEventListener("touchend", endDrag, true);
    window.addEventListener("touchcancel", onTouchCancel, true);
    propsRef.current.onDragStart?.(event);
    event.preventDefault();
    event.stopPropagation();
  }, [endDrag, onDrag, onTouchCancel]);

  const handleMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    startDrag(event.nativeEvent);
  }, [startDrag]);
  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    startDrag(event.nativeEvent);
  }, [startDrag]);

  useImperativeHandle(forwardedRef, () => ({
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
  }), [animatePosition, applyTransform, forwardedRef]);

  useEffect(() => {
    const frameId = requestAnimationFrame(calculateInitialPosition);
    const observer = new MutationObserver(calculateInitialPosition);
    observerRef.current = observer;
    const container = containerRef.current;
    if (container) {
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }

    return () => {
      cancelAnimationFrame(frameId);
      removeGlobalListenersRef.current();
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      observer.disconnect();
      observerRef.current = null;
    };
  }, [calculateInitialPosition]);

  return { containerRef, isDragging, handleMouseDown, handleTouchStart };
}