/**
 * FloatingBall.tsx - React 版悬浮球
 * 从 Vue 版 FloatingBall.vue 迁移而来
 *
 * 功能：
 * - 可拖拽（使用共享 Draggable，初始位置 bottom-right，启用边缘吸附）
 * - 点击触发回调（非拖拽）
 * - 拖拽过程实时上报位置（用于卫星轨道效果，目前轨道组件未启用）
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, { useCallback, useRef } from "react";
import { Draggable } from "@/assets/components/react-index";
import type { DraggableHandle } from "@/assets/components/react-index";
import { getStaticAbstractPath } from "@/utils/common";
import {
  trackFloatingBallDrag,
  trackFloatingBallOpen,
} from "@/services/achievements";
import "./styles/floating-ball.scss";

interface FloatingBallProps {
  /** 悬浮球图标 URL */
  icon?: string;
  /** 主题（保留字段，未使用）*/
  theam?: string;
  /** 点击回调（非拖拽时触发）*/
  onClick?: (event: MouseEvent | TouchEvent) => void;
  /** 子节点（替代 Vue 默认插槽）*/
  children?: React.ReactNode;
  /** 图标节点（替代 Vue icon 具名插槽）*/
  iconSlot?: React.ReactNode;
  /** 内容节点（替代 Vue content 具名插槽）*/
  contentSlot?: React.ReactNode;
}

/** Draggable 配置（对应原 draggableProps）*/
const DRAGGABLE_PROPS = {
  initialPosition: "bottom-right" as const,
  edgeDistance: 50,
  adsorbMargin: 15,
  enableAdsorption: true,
};

/** 图标中心偏移（45px 直径 → 中心偏移 22.5）*/
const ICON_CENTER_OFFSET = 22.5;

/**
 * FloatingBall - 悬浮球组件
 */
const FloatingBall: React.FC<FloatingBallProps> = ({
  icon,
  onClick,
  children,
  iconSlot,
  contentSlot,
}) => {
  const draggableRef = useRef<DraggableHandle>(null);

  /** 位置状态（保留用于未来卫星轨道效果）*/
  const positionRef = useRef<{ x: number; y: number }>({
    x: 2000,
    y: 1200,
  });
  const showOrbitRef = useRef(true);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * 处理悬浮球点击事件
   * 仅当点击目标在 Shadow DOM 内时触发回调
   */
  const handleIconClick = useCallback(
    (e: MouseEvent | TouchEvent) => {
      e.stopPropagation();
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const rootNode = target.getRootNode();
      maLogger.info("点击目标", target, rootNode);
      if (rootNode instanceof ShadowRoot) {
        trackFloatingBallOpen();
        onClick?.(e);
      }
    },
    [onClick],
  );

  const handleDragStart = useCallback(() => {
    dragStartRef.current = draggableRef.current?.getCurrentPosition() ?? null;
  }, []);

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent, x: number, y: number) => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (!start) return;
      trackFloatingBallDrag(Math.hypot(x - start.x, y - start.y));
    },
    [],
  );

  /**
   * 处理拖拽中事件
   * 实时更新位置状态（用于卫星轨道效果）
   */
  const handleDragging = useCallback(
    (_event: MouseEvent | TouchEvent, x: number, y: number) => {
      if (!showOrbitRef.current) return;
      // 调整位置，使图标中心对齐
      positionRef.current = {
        x: x + ICON_CENTER_OFFSET,
        y: y + ICON_CENTER_OFFSET,
      };
    },
    [],
  );

  /**
   * 处理初始位置确定事件
   */
  const handleMove = useCallback((x: number, y: number) => {
    positionRef.current = {
      x: x + ICON_CENTER_OFFSET,
      y: y + ICON_CENTER_OFFSET,
    };
  }, []);

  const iconSrc = icon ?? getStaticAbstractPath("icons/floatingball.png");

  return (
    <div className="constraints">
      <Draggable
        ref={draggableRef}
        {...DRAGGABLE_PROPS}
        width={45}
        height={45}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragging={handleDragging}
        onMove={handleMove}
      >
        {/* 悬浮球图标 */}
        <div className="icon" draggable={false}>
          {iconSlot ?? (
            <img src={iconSrc} alt="floating ball" onClick={handleIconClick} />
          )}
        </div>
        {contentSlot ?? children}
      </Draggable>
      {/* 卫星环绕效果组件（未启用）*/}
      {/* <StarOrbit position={position} isVisible={showOrbit} /> */}
    </div>
  );
};

FloatingBall.displayName = "FloatingBall";

export default FloatingBall;
