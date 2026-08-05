/**
 * GlassCardOverlay.tsx - React 版悬浮毛玻璃卡片
 * 从 Vue 版 GlassCardOverlay.vue 迁移而来
 *
 * 功能：
 * - 可拖拽（使用共享 Draggable 组件，拖拽手柄为标题栏）
 * - 四角缩放（nw/ne/sw/se 四个 resize handle）
 * - 颜色、透明度、玻璃风格实时调节
 * - 双击空白区域关闭
 *
 * 性能要点：
 * - 高频 resize（pointermove）用 ref 暂存状态，避免频繁 setState 触发重渲染
 * - 仅在 pointerup 时同步 ref → state，一次性更新
 * - cardStyle 用 useMemo 缓存，依赖 tint/opacity/preset/width/height
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Draggable } from "@/assets/components/react-index";
import type { DraggableHandle } from "@/assets/components/react-index";
import "./styles/glass-card-overlay.scss";

/** 玻璃风格预设 */
type StylePreset = "frosted" | "crystal" | "aurora" | "smoke";

/** 缩放方向 */
type ResizeDirection = "nw" | "ne" | "sw" | "se";

interface GlassCardOverlayProps {
  /** 是否可见 */
  visible?: boolean;
  /** 关闭回调（对应原 emit('update:visible', false)）*/
  onClose?: () => void;
}

/** 尺寸约束 */
const MIN_WIDTH = 260;
const MAX_WIDTH = 760;
const MIN_HEIGHT = 220;
const MAX_HEIGHT = 600;

/** 默认值 */
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 280;
const DEFAULT_TINT = "#8ec5ff";
const DEFAULT_OPACITY = 0.24;
const DEFAULT_PRESET: StylePreset = "frosted";

/** 工具函数：hex → rgb */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const safeHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  const value = Number.parseInt(safeHex, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

/** 工具函数：数值限幅 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 风格预设配置表 */
function getPresetConfig(preset: StylePreset) {
  switch (preset) {
    case "crystal":
      return {
        blur: 22,
        saturate: 180,
        borderAlpha: 0.42,
        shadow: "0 28px 60px rgba(15, 23, 42, 0.2)",
        sheen:
          "linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.08))",
      };
    case "aurora":
      return {
        blur: 26,
        saturate: 205,
        borderAlpha: 0.3,
        shadow: "0 28px 68px rgba(29, 78, 216, 0.22)",
        sheen:
          "linear-gradient(135deg, rgba(255,255,255,0.32), rgba(76, 201, 240, 0.18) 45%, rgba(167, 139, 250, 0.18))",
      };
    case "smoke":
      return {
        blur: 18,
        saturate: 125,
        borderAlpha: 0.22,
        shadow: "0 24px 52px rgba(15, 23, 42, 0.28)",
        sheen:
          "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(15,23,42,0.14))",
      };
    default:
      return {
        blur: 20,
        saturate: 155,
        borderAlpha: 0.34,
        shadow: "0 24px 56px rgba(15, 23, 42, 0.18)",
        sheen:
          "linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.08))",
      };
  }
}

/** resize 过程中的临时状态（不触发渲染，仅记录起点）*/
interface ResizeState {
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
}

/**
 * GlassCardOverlay - 悬浮毛玻璃卡片
 */
const GlassCardOverlay: React.FC<GlassCardOverlayProps> = ({
  visible = false,
  onClose,
}) => {
  const draggableRef = useRef<DraggableHandle>(null);

  // 用户配置项（低频更新，用 useState 触发渲染）
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [tint, setTint] = useState(DEFAULT_TINT);
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [stylePreset, setStylePreset] = useState<StylePreset>(DEFAULT_PRESET);

  // 状态标志
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // resize 过程中的临时状态（高频更新，用 ref 避免 React 渲染压力）
  const resizeStateRef = useRef<ResizeState | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  // resize 过程中的实时尺寸（用于一次性同步到 state）
  const resizeWidthRef = useRef(width);
  const resizeHeightRef = useRef(height);

  /** 风格预设配置（原 computed） */
  const presetConfig = useMemo(() => getPresetConfig(stylePreset), [
    stylePreset,
  ]);

  /** 透明度百分比标签 */
  const opacityLabel = useMemo(
    () => `${Math.round(opacity * 100)}%`,
    [opacity]
  );

  /** 是否展开（显示内容和 resize handle） */
  const isCardExpanded = isHovered || isDragging || isResizing;

  /** 卡片 inline style（原 computed cardStyle） */
  const cardStyle = useMemo<React.CSSProperties>(() => {
    const rgb = hexToRgb(tint);
    const panelOpacity = opacity;
    const opacityProgress = clamp((panelOpacity - 0.02) / 0.96, 0, 1);
    const blurStrength = 0.4 + presetConfig.blur * opacityProgress;
    const saturateStrength =
      100 + (presetConfig.saturate - 100) * opacityProgress;
    const borderOpacity = Math.min(
      panelOpacity + presetConfig.borderAlpha,
      0.9
    );

    return {
      width: `${width}px`,
      height: `${height}px`,
      background: `${presetConfig.sheen}, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${panelOpacity})`,
      border: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
      boxShadow: presetConfig.shadow,
      backdropFilter: `blur(${blurStrength.toFixed(2)}px) saturate(${saturateStrength.toFixed(
        0
      )}%)`,
      WebkitBackdropFilter: `blur(${blurStrength.toFixed(2)}px) saturate(${saturateStrength.toFixed(
        0
      )}%)`,
    } as React.CSSProperties;
  }, [width, height, tint, opacity, presetConfig]);

  /** 关闭卡片 */
  const closeCard = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /** 重置卡片样式 */
  const resetCard = useCallback(() => {
    setWidth(DEFAULT_WIDTH);
    setHeight(DEFAULT_HEIGHT);
    setTint(DEFAULT_TINT);
    setOpacity(DEFAULT_OPACITY);
    setStylePreset(DEFAULT_PRESET);
  }, []);

  /** 获取当前位置（通过 Draggable 暴露的命令式 API） */
  const getCurrentPosition = useCallback((): {
    x: number;
    y: number;
  } => {
    if (!draggableRef.current?.getCurrentPosition) {
      return { x: 0, y: 0 };
    }
    return draggableRef.current.getCurrentPosition();
  }, []);

  /** 设置当前位置（优先用 setPositionImmediate） */
  const setCurrentPosition = useCallback((x: number, y: number) => {
    if (draggableRef.current?.setPositionImmediate) {
      draggableRef.current.setPositionImmediate(x, y);
      return;
    }
    draggableRef.current?.setPosition(x, y);
  }, []);

  /** resize pointermove 处理（高频，不触发 setState） */
  const handleResizeMove = useCallback(
    (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState || activePointerIdRef.current !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - resizeState.startX;
      const deltaY = event.clientY - resizeState.startY;

      let nextWidth = resizeState.startWidth;
      let nextHeight = resizeState.startHeight;
      let nextLeft = resizeState.startLeft;
      let nextTop = resizeState.startTop;

      if (resizeState.direction.includes("e")) {
        nextWidth = clamp(
          resizeState.startWidth + deltaX,
          MIN_WIDTH,
          MAX_WIDTH
        );
      }
      if (resizeState.direction.includes("s")) {
        nextHeight = clamp(
          resizeState.startHeight + deltaY,
          MIN_HEIGHT,
          MAX_HEIGHT
        );
      }
      if (resizeState.direction.includes("w")) {
        nextWidth = clamp(
          resizeState.startWidth - deltaX,
          MIN_WIDTH,
          MAX_WIDTH
        );
        nextLeft = resizeState.startLeft + (resizeState.startWidth - nextWidth);
      }
      if (resizeState.direction.includes("n")) {
        nextHeight = clamp(
          resizeState.startHeight - deltaY,
          MIN_HEIGHT,
          MAX_HEIGHT
        );
        nextTop = resizeState.startTop + (resizeState.startHeight - nextHeight);
      }

      nextLeft = clamp(
        nextLeft,
        0,
        Math.max(window.innerWidth - nextWidth, 0)
      );
      nextTop = clamp(nextTop, 0, Math.max(window.innerHeight - nextHeight, 0));

      // 更新 ref（用于 pointerup 时同步到 state）
      resizeWidthRef.current = nextWidth;
      resizeHeightRef.current = nextHeight;

      // 直接同步到 state（React 18 会自动批处理 pointermove 内的多次 setState）
      setWidth(nextWidth);
      setHeight(nextHeight);
      setCurrentPosition(nextLeft, nextTop);
      event.preventDefault();
    },
    [setCurrentPosition]
  );

  /** resize 结束清理 */
  const stopResize = useCallback(
    (event?: PointerEvent) => {
      if (event && activePointerIdRef.current !== event.pointerId) {
        return;
      }
      setIsResizing(false);
      activePointerIdRef.current = null;
      resizeStateRef.current = null;
      window.removeEventListener("pointermove", handleResizeMove, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("pointerup", stopResize, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("pointercancel", stopResize, {
        capture: true,
      } as EventListenerOptions);
      document.body.style.userSelect = "";
    },
    [handleResizeMove]
  );

  /** 开始 resize */
  const startResize = useCallback(
    (direction: ResizeDirection, event: React.PointerEvent) => {
      const position = getCurrentPosition();
      resizeStateRef.current = {
        direction,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: width,
        startHeight: height,
        startLeft: position.x,
        startTop: position.y,
      };
      resizeWidthRef.current = width;
      resizeHeightRef.current = height;

      setIsResizing(true);
      activePointerIdRef.current = event.pointerId;

      // 监听 window 事件（capture 模式确保不丢事件）
      window.addEventListener("pointermove", handleResizeMove, {
        capture: true,
        passive: false,
      });
      window.addEventListener("pointerup", stopResize, { capture: true });
      window.addEventListener("pointercancel", stopResize, { capture: true });
      document.body.style.userSelect = "none";
    },
    [width, height, getCurrentPosition, handleResizeMove, stopResize]
  );

  /** 拖拽开始/结束 */
  const handleDragStart = useCallback(() => setIsDragging(true), []);
  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  // visible 变化时重置交互状态（对应原 watch(() => props.visible)）
  useEffect(() => {
    if (!visible) {
      setIsHovered(false);
      setIsDragging(false);
      setIsResizing(false);
      // 清理可能残留的 resize 事件
      if (resizeStateRef.current) {
        stopResize();
      }
    }
  }, [visible, stopResize]);

  // 组件卸载清理（对应原 onBeforeUnmount）
  useEffect(() => {
    return () => {
      if (resizeStateRef.current) {
        stopResize();
      }
    };
  }, [stopResize]);

  if (!visible) return null;

  return (
    <Draggable
      ref={draggableRef}
      initialPosition="center"
      enableAdsorption={false}
      dragHandle=".glass-card-header"
      canOverflow={false}
      width={width}
      height={height}
      containerStyle={{ "--z-index": 2147483646 } as React.CSSProperties}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={`glass-card${isCardExpanded ? " glass-card--expanded" : ""}`}
        style={cardStyle}
        onDoubleClick={closeCard}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="glass-card-content">
          <div
            className="glass-card-header"
            onDoubleClick={(e) => {
              e.stopPropagation();
              closeCard();
            }}
          >
            <div className="title-block">
              <strong>悬浮毛玻璃卡片</strong>
              <span>拖动标题栏移动，右下角可缩放，双击空白区域关闭</span>
            </div>
            <button
              type="button"
              className="close-button"
              onClick={(e) => {
                e.stopPropagation();
                closeCard();
              }}
            >
              关闭
            </button>
          </div>

          <div
            className="glass-card-body"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className="glass-card-controls">
              <label className="control-item color-item">
                <div className="control-item-content">
                  <span>颜色</span>
                  <strong>{tint}</strong>
                </div>
                <input
                  type="color"
                  value={tint}
                  onChange={(e) => setTint(e.target.value)}
                />
              </label>

              <label className="control-item">
                <div className="control-item-content">
                  <span>透明度</span>
                  <strong>{opacityLabel}</strong>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.98}
                  step={0.02}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                />
              </label>

              <label className="control-item">
                <span>玻璃风格</span>
                <select
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value as StylePreset)}
                >
                  <option value="frosted">柔雾</option>
                  <option value="crystal">水晶</option>
                  <option value="aurora">极光</option>
                  <option value="smoke">烟幕</option>
                </select>
              </label>
            </div>
          </div>

          <div
            className="glass-card-footer"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ghost-button"
              onClick={resetCard}
            >
              重置样式
            </button>
          </div>
        </div>

        {/* 四角缩放 handle */}
        <div
          className="resize-handle resize-handle-nw"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize("nw", e);
          }}
        />
        <div
          className="resize-handle resize-handle-ne"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize("ne", e);
          }}
        />
        <div
          className="resize-handle resize-handle-sw"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize("sw", e);
          }}
        />
        <div
          className="resize-handle resize-handle-se"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize("se", e);
          }}
        />
      </div>
    </Draggable>
  );
};

GlassCardOverlay.displayName = "GlassCardOverlay";

export default GlassCardOverlay;
