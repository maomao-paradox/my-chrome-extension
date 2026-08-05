/**
 * ControlPanel.tsx - React 版控制面板
 * 从 Vue 版 ControlPanel.vue 迁移而来
 *
 * 功能：
 * - 可拖拽毛玻璃面板（拖拽手柄为标题栏）
 * - 双面板切换：AI 对话 / 技能列表
 * - 技能列表用 antd Collapse（accordion 模式）展示工具
 * - 全屏切换（带 rAF 位置动画）
 * - 遮罩点击关闭
 *
 * 关键技术点：
 * - 全屏过渡用 rAF + easeInOutCubic 缓动函数，通过 Draggable 的 setPositionImmediate 命令式 API
 *   直接驱动位置，绕过 React 渲染周期保证 60fps
 * - 全屏过渡中禁用 pointer-events，避免拖拽手柄被打断
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Collapse } from "antd";
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { Draggable } from "@/assets/components/react-index";
import type { DraggableHandle } from "@/assets/components/react-index";
import type { Tool } from "@/types/index.js";
import "./styles/control-panel.scss";

interface ControlPanelProps {
  /** 工具列表 */
  tools: Tool[];
  /** 面板标题 */
  title: string;
  /** 是否可见 */
  visible?: boolean;
  /** 点击工具回调 */
  onClickTool?: (item: Tool) => void;
  /** 关闭面板回调 */
  onClose?: () => void;
}

/** 面板元数据 */
const PANEL_META = [
  {
    key: "chat",
    code: "AI",
    label: "AI 对话",
    shortLabel: "AI CHAT",
    description: "页面会话、上下文分析与即时协作",
  },
  {
    key: "skill",
    code: "SK",
    label: "技能列表",
    shortLabel: "SKILLS",
    description: "快速执行悬浮工具与页面动作",
  },
] as const;

/** 全屏过渡时长（ms）*/
const FULLSCREEN_TRANSITION_MS = 440;

/** easeInOutCubic 缓动函数 */
function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

/**
 * ControlPanel - 控制面板组件
 */
const ControlPanel: React.FC<ControlPanelProps> = ({
  tools,
  title,
  visible = false,
  onClickTool,
  onClose,
}) => {
  const [activePanel, setActivePanel] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenTransitioning, setIsFullscreenTransitioning] = useState(
    false
  );

  const draggableRef = useRef<DraggableHandle>(null);
  const savedPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const fullscreenTimerRef = useRef<number | null>(null);
  const fullscreenAnimationFrameRef = useRef<number | null>(null);

  /** 清理全屏定时器 */
  const clearFullscreenTimer = useCallback(() => {
    if (fullscreenTimerRef.current !== null) {
      window.clearTimeout(fullscreenTimerRef.current);
      fullscreenTimerRef.current = null;
    }
  }, []);

  /** 清理全屏动画帧 */
  const clearFullscreenAnimation = useCallback(() => {
    if (fullscreenAnimationFrameRef.current !== null) {
      cancelAnimationFrame(fullscreenAnimationFrameRef.current);
      fullscreenAnimationFrameRef.current = null;
    }
  }, []);

  /**
   * 动画驱动 Draggable 位置（通过命令式 API，绕过 React 渲染周期）
   */
  const animateDraggablePosition = useCallback(
    (targetX: number, targetY: number) => {
      const draggableApi = draggableRef.current;
      if (
        !draggableApi?.getCurrentPosition ||
        !draggableApi?.setPositionImmediate
      ) {
        return;
      }

      const startPosition = draggableApi.getCurrentPosition();
      const deltaX = targetX - startPosition.x;
      const deltaY = targetY - startPosition.y;

      clearFullscreenAnimation();

      // 距离过小直接到位
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
        draggableApi.setPositionImmediate(targetX, targetY);
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        const rawProgress = Math.min(
          (now - startTime) / FULLSCREEN_TRANSITION_MS,
          1
        );
        const easedProgress = easeInOutCubic(rawProgress);

        draggableApi.setPositionImmediate(
          startPosition.x + deltaX * easedProgress,
          startPosition.y + deltaY * easedProgress
        );

        if (rawProgress < 1) {
          fullscreenAnimationFrameRef.current = requestAnimationFrame(step);
          return;
        }

        draggableApi.setPositionImmediate(targetX, targetY);
        fullscreenAnimationFrameRef.current = null;
      };

      fullscreenAnimationFrameRef.current = requestAnimationFrame(step);
    },
    [clearFullscreenAnimation]
  );

  /** 结束全屏过渡 */
  const finishFullscreenTransition = useCallback(() => {
    clearFullscreenTimer();
    setIsFullscreenTransitioning(false);
  }, [clearFullscreenTimer]);

  /** 调度全屏过渡结束 */
  const scheduleFullscreenTransitionEnd = useCallback(() => {
    clearFullscreenTimer();
    fullscreenTimerRef.current = window.setTimeout(() => {
      finishFullscreenTransition();
    }, FULLSCREEN_TRANSITION_MS + 80);
  }, [clearFullscreenTimer, finishFullscreenTransition]);

  /** 切换全屏 */
  const toggleFullscreen = useCallback(() => {
    const draggableApi = draggableRef.current;
    if (!draggableApi?.getCurrentPosition) return;
    if (isFullscreenTransitioning) return;

    setIsFullscreenTransitioning(true);

    if (!isFullscreen) {
      // 进入全屏：保存当前位置，动画到 (0, 0)
      savedPositionRef.current = draggableApi.getCurrentPosition();
      setIsFullscreen(true);
      animateDraggablePosition(0, 0);
    } else {
      // 退出全屏：动画到保存的位置
      setIsFullscreen(false);
      animateDraggablePosition(
        savedPositionRef.current.x,
        savedPositionRef.current.y
      );
    }

    scheduleFullscreenTransitionEnd();
  }, [
    isFullscreen,
    isFullscreenTransitioning,
    animateDraggablePosition,
    scheduleFullscreenTransitionEnd,
  ]);

  /** 处理工具点击 */
  const handleClick = useCallback(
    (item: Tool) => {
      onClickTool?.(item);
    },
    [onClickTool]
  );

  /** 关闭面板 */
  const close = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /** 切换面板 */
  const togglePanel = useCallback((panelIndex: number) => {
    setActivePanel(panelIndex);
  }, []);

  /** Draggable 容器样式（全屏过渡中禁用 pointer-events）*/
  const draggableContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      pointerEvents: isFullscreenTransitioning ? "none" : "auto",
    }),
    [isFullscreenTransitioning]
  );

  // 组件卸载清理（对应原 onUnmounted）
  useEffect(() => {
    return () => {
      clearFullscreenTimer();
      clearFullscreenAnimation();
    };
  }, [clearFullscreenTimer, clearFullscreenAnimation]);

  // antd Collapse items 配置（工具列表）
  const collapseItems = useMemo(
    () =>
      tools.map((item) => ({
        key: item.label,
        label: (
          <div className="item-wrapper">
            <span className="item-title">{item.label}</span>
            <span className="item-tag">TOOL</span>
          </div>
        ),
        children: (
          <div className="content-row">
            <div className="description-text">
              {item.details || item.label}
            </div>
            <Button
              type="primary"
              size="small"
              className="execute-button"
              onClick={(e) => {
                e.stopPropagation();
                handleClick(item);
              }}
            >
              执行
            </Button>
          </div>
        ),
      })),
    [tools, handleClick]
  );

  if (!visible) return null;

  return (
    <div className="control-panel-wrapper">
      <div className="mask" onClick={close} />

      <Draggable
        ref={draggableRef}
        initialPosition="center"
        enableAdsorption={false}
        dragHandle=".drag-area"
        containerStyle={draggableContainerStyle}
      >
        <div
          className={`ma-collapse-container${
            isFullscreen ? " is-fullscreen" : ""
          }${isFullscreenTransitioning ? " is-transitioning" : ""}`}
        >
          {/* 拖拽区域 + 标题栏 */}
          <div className="drag-area">
            <div className="title-shell">
              <div className="title-emblem">
                <span className="title-emblem-core"></span>
              </div>
              <div className="title-copy">
                <div className="title-eyebrow">FLOATING CONSOLE</div>
                <div className="title-line">
                  <div className="title-wrapper">{title}</div>
                  <div className="title-subtitle">
                    AI Chat 与 Skills (MCP开发中)
                  </div>
                </div>
              </div>
            </div>

            <div className="header-actions">
              <div className="header-pills">
                {PANEL_META.map((panel, index) => (
                  <button
                    key={panel.key}
                    type="button"
                    className={`header-pill${
                      activePanel === index ? " is-active" : ""
                    }`}
                    title={panel.label}
                    aria-label={panel.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePanel(index);
                    }}
                  >
                    <span className="pill-code">{panel.code}</span>
                    <span className="pill-label">{panel.label}</span>
                  </button>
                ))}
              </div>

              <div className="top-buttons">
                <button
                  type="button"
                  className={`fullscreen-btn${
                    isFullscreenTransitioning ? " is-busy" : ""
                  }`}
                  disabled={isFullscreenTransitioning}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                  }}
                >
                  {isFullscreen ? (
                    <FullscreenExitOutlined />
                  ) : (
                    <FullscreenOutlined />
                  )}
                </button>
                <button
                  type="button"
                  className="close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                  }}
                >
                  <CloseOutlined />
                </button>
              </div>
            </div>
          </div>

          {/* 双面板容器 */}
          <div className="push-panel-container">
            {/* AI 对话面板 */}
            <div
              className={`push-panel panel-ai${
                activePanel === 0 ? " active" : " collapsed"
              }`}
              onClick={() => togglePanel(0)}
            >
              <div className="panel-surface">
                {activePanel === 0 && (
                  <div className="panel-content">
                    {/* AIConversation 组件未迁移，保持注释状态 */}
                  </div>
                )}
                {activePanel !== 0 && (
                  <div className="panel-handle">
                    <span className="handle-code">
                      {PANEL_META[0].code}
                    </span>
                    <span className="handle-label">
                      {PANEL_META[0].shortLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 技能列表面板 */}
            <div
              className={`push-panel panel-tools${
                activePanel === 1 ? " active" : " collapsed"
              }`}
              onClick={() => togglePanel(1)}
            >
              <div className="panel-surface">
                {activePanel === 1 && (
                  <div className="panel-content">
                    <Collapse
                      accordion
                      items={collapseItems}
                      expandIconPosition="end"
                    />
                  </div>
                )}
                {activePanel !== 1 && (
                  <div className="panel-handle">
                    <span className="handle-code">
                      {PANEL_META[1].code}
                    </span>
                    <span className="handle-label">
                      {PANEL_META[1].shortLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Draggable>
    </div>
  );
};

ControlPanel.displayName = "ControlPanel";

export default ControlPanel;
