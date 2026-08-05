/**
 * AutoClick 自动点击器组件（React 版）
 * 从 AutoClick.vue 迁移而来
 *
 * 关键变更：
 * - Vue ref → useState（渲染相关）/ useRef（定时器、监听器引用）
 * - computed → useMemo
 * - Draggable.vue → React 版 Draggable（@/assets/components/react-index）
 * - 事件监听器用 ref 存储最新版本 + 稳定包装函数，避免 stale closure
 * - setInterval 回调用 ref 存储最新 playNextStep，确保调用最新逻辑
 *
 * 顺序约束：稳定包装函数必须在 add/remove 监听器函数之前声明，
 * 工具函数在业务函数之前，ref.current 赋值在所有函数定义之后。
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Draggable } from "@/assets/components/react-index";
import "./styles/auto-click.scss";

interface AutoClickProps {
  visible: boolean;
}

interface PointerPosition {
  x: number;
  y: number;
}

interface ViewportRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface CrosshairSegment {
  key: string;
  className: string;
  style: React.CSSProperties;
}

const buttonSelector =
  'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]';

const AutoClick: React.FC<AutoClickProps> = ({ visible }) => {
  // ---------- 响应式状态 ----------
  const [intervalMs, setIntervalMs] = useState(500);
  const [clickCounter, setClickCounter] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<PointerPosition[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [recordingPointerPosition, setRecordingPointerPosition] =
    useState<PointerPosition | null>(null);
  const [hoveredButtonRect, setHoveredButtonRect] = useState<ViewportRect | null>(null);

  // ---------- 内部状态（用 ref，不需要触发重渲染） ----------
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingClickListenerTimerRef = useRef<number | null>(null);

  // ---------- ref 存储事件处理函数最新版本 ----------
  const playNextStepRef = useRef<() => void>(() => {});
  const recordingListenerRef = useRef<(e: MouseEvent) => void>(() => {});
  const handleRecordingPointerMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  const refreshRecordingPointerTargetRef = useRef<() => void>(() => {});
  const handleKeydownRef = useRef<(e: KeyboardEvent) => void>(() => {});

  // ---------- 稳定包装函数（引用永远不变，用于 add/removeEventListener） ----------
  const playNextStepStable = useCallback(() => playNextStepRef.current(), []);
  const recordingListenerStable = useCallback(
    (e: MouseEvent) => recordingListenerRef.current(e),
    []
  );
  const handleRecordingPointerMoveStable = useCallback(
    (e: MouseEvent) => handleRecordingPointerMoveRef.current(e),
    []
  );
  const refreshRecordingPointerTargetStable = useCallback(
    () => refreshRecordingPointerTargetRef.current(),
    []
  );
  const handleKeydownStable = useCallback(
    (e: KeyboardEvent) => handleKeydownRef.current(e),
    []
  );

  // ---------- 计算属性 ----------
  const statusText = useMemo(() => {
    if (isRecording) return "录制中";
    if (isPlaying) return "播放中";
    return "空闲";
  }, [isRecording, isPlaying]);

  const statusDotClass = useMemo(() => {
    if (isRecording) return "recording";
    if (isPlaying) return "active";
    return "inactive";
  }, [isRecording, isPlaying]);

  const crosshairSegments = useMemo<CrosshairSegment[]>(() => {
    const pointer = recordingPointerPosition;
    if (!pointer) return [];

    const buttonRect = hoveredButtonRect;
    const x = `${pointer.x}px`;
    const y = `${pointer.y}px`;

    if (!buttonRect) {
      return [
        {
          key: "vertical",
          className: "recording-crosshair-line--vertical",
          style: { left: x, top: "0px", height: "100vh" },
        },
        {
          key: "horizontal",
          className: "recording-crosshair-line--horizontal",
          style: { left: "0px", top: y, width: "100vw" },
        },
      ];
    }

    return [
      {
        key: "vertical-top",
        className: "recording-crosshair-line--vertical",
        style: { left: x, top: "0px", height: `${Math.max(0, buttonRect.top)}px` },
      },
      {
        key: "vertical-bottom",
        className: "recording-crosshair-line--vertical",
        style: {
          left: x,
          top: `${buttonRect.bottom}px`,
          height: `calc(100vh - ${buttonRect.bottom}px)`,
        },
      },
      {
        key: "horizontal-left",
        className: "recording-crosshair-line--horizontal",
        style: { left: "0px", top: y, width: `${Math.max(0, buttonRect.left)}px` },
      },
      {
        key: "horizontal-right",
        className: "recording-crosshair-line--horizontal",
        style: {
          left: `${buttonRect.right}px`,
          top: y,
          width: `calc(100vw - ${buttonRect.right}px)`,
        },
      },
    ];
  }, [recordingPointerPosition, hoveredButtonRect]);

  const coordinateBadgeStyle = useMemo<React.CSSProperties>(() => {
    const pointer = recordingPointerPosition;
    if (!pointer) return {};
    return {
      left: `max(8px, min(calc(100vw - 132px), ${pointer.x + 12}px))`,
      top: `max(8px, min(calc(100vh - 42px), ${pointer.y + 12}px))`,
    };
  }, [recordingPointerPosition]);

  const buttonOutlineStyle = useMemo<React.CSSProperties>(() => {
    const buttonRect = hoveredButtonRect;
    if (!buttonRect) return {};
    return {
      left: `${buttonRect.left}px`,
      top: `${buttonRect.top}px`,
      width: `${buttonRect.width}px`,
      height: `${buttonRect.height}px`,
    };
  }, [hoveredButtonRect]);

  // ---------- 纯工具函数 ----------
  const performClickAt = useCallback((x: number, y: number) => {
    const eventOptions = {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      screenX: window.screenX + x || x,
      screenY: window.screenY + y || y,
      buttons: 1,
      button: 0,
    };

    document.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    document.dispatchEvent(
      new MouseEvent("mouseup", { ...eventOptions, buttons: 0 })
    );
    document.dispatchEvent(
      new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        screenX: window.screenX + x || x,
        screenY: window.screenY + y || y,
        button: 0,
        buttons: 0,
      })
    );
    setClickCounter((prev) => prev + 1);
  }, []);

  const getViewportRect = useCallback((rect: DOMRect): ViewportRect => {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }, []);

  const getButtonRectAtPoint = useCallback(
    (x: number, y: number): ViewportRect | null => {
      const pointedElement = document.elementFromPoint(x, y);
      const buttonElement =
        pointedElement instanceof Element
          ? pointedElement.closest(buttonSelector)
          : null;

      if (!(buttonElement instanceof HTMLElement)) return null;

      const rect = buttonElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      return getViewportRect(rect);
    },
    [getViewportRect]
  );

  const updateRecordingPointer = useCallback(
    (x: number, y: number) => {
      const pointer = { x: Math.round(x), y: Math.round(y) };
      setRecordingPointerPosition(pointer);
      setHoveredButtonRect(getButtonRectAtPoint(pointer.x, pointer.y));
    },
    [getButtonRectAtPoint]
  );

  // ---------- add/remove 监听器函数 ----------
  const addRecordingPointerListeners = useCallback(() => {
    document.addEventListener("mousemove", handleRecordingPointerMoveStable, {
      passive: true,
    });
    document.addEventListener("scroll", refreshRecordingPointerTargetStable, true);
    window.addEventListener("resize", refreshRecordingPointerTargetStable);
  }, [handleRecordingPointerMoveStable, refreshRecordingPointerTargetStable]);

  const removeRecordingPointerListeners = useCallback(() => {
    document.removeEventListener("mousemove", handleRecordingPointerMoveStable);
    document.removeEventListener("scroll", refreshRecordingPointerTargetStable, true);
    window.removeEventListener("resize", refreshRecordingPointerTargetStable);
  }, [handleRecordingPointerMoveStable, refreshRecordingPointerTargetStable]);

  const addRecordingClickListener = useCallback(
    (defer: boolean) => {
      if (recordingClickListenerTimerRef.current !== null) {
        window.clearTimeout(recordingClickListenerTimerRef.current);
        recordingClickListenerTimerRef.current = null;
      }

      if (!defer) {
        document.addEventListener("click", recordingListenerStable);
        return;
      }

      recordingClickListenerTimerRef.current = window.setTimeout(() => {
        recordingClickListenerTimerRef.current = null;
        if (isRecording) {
          document.addEventListener("click", recordingListenerStable);
        }
      }, 0);
    },
    [recordingListenerStable, isRecording]
  );

  const removeRecordingClickListener = useCallback(() => {
    if (recordingClickListenerTimerRef.current !== null) {
      window.clearTimeout(recordingClickListenerTimerRef.current);
      recordingClickListenerTimerRef.current = null;
    }
    document.removeEventListener("click", recordingListenerStable);
  }, [recordingListenerStable]);

  // ---------- 播放/录制控制 ----------
  const stopPlayback = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);
    removeRecordingClickListener();
    removeRecordingPointerListeners();
    setRecordingPointerPosition(null);
    setHoveredButtonRect(null);
  }, [isRecording, removeRecordingClickListener, removeRecordingPointerListeners]);

  const startPlayback = useCallback(() => {
    if (isPlaying) return;
    if (isRecording) {
      stopRecording();
    }
    if (recordedSteps.length === 0) return;

    setCurrentStepIndex(0);
    setIsPlaying(true);

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    intervalIdRef.current = setInterval(playNextStepStable, intervalMs);
    playNextStepStable();
  }, [isPlaying, isRecording, recordedSteps.length, intervalMs, stopRecording, playNextStepStable]);

  const startRecording = useCallback(
    (e?: MouseEvent) => {
      if (isRecording) return;
      if (isPlaying) {
        stopPlayback();
      }

      setRecordedSteps([]);
      setCurrentStepIndex(0);
      setIsRecording(true);

      if (e) {
        updateRecordingPointer(e.clientX, e.clientY);
      }

      addRecordingClickListener(Boolean(e));
      addRecordingPointerListeners();
    },
    [
      isRecording,
      isPlaying,
      stopPlayback,
      updateRecordingPointer,
      addRecordingClickListener,
      addRecordingPointerListeners,
    ]
  );

  const toggleRecording = useCallback(
    (e?: MouseEvent) => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording(e);
      }
    },
    [isRecording, stopRecording, startRecording]
  );

  const onIntervalChange = useCallback(() => {
    setIntervalMs((prev) => {
      let next = prev;
      if (next < 50) next = 50;
      if (next > 10000) next = 10000;
      return next;
    });

    if (isPlaying) {
      stopPlayback();
      // 重启以应用新间隔（延迟一帧确保 state 已更新）
      requestAnimationFrame(() => playNextStepRef.current && startPlayback());
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  const resetCounter = useCallback(() => {
    setClickCounter(0);
  }, []);

  // ---------- ref.current 赋值（每次渲染更新，访问最新 state） ----------
  playNextStepRef.current = () => {
    if (!isPlaying) return;
    if (recordedSteps.length === 0) {
      stopPlayback();
      return;
    }
    const step = recordedSteps[currentStepIndex];
    performClickAt(step.x, step.y);
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      return next >= recordedSteps.length ? 0 : next;
    });
  };

  recordingListenerRef.current = (e: MouseEvent) => {
    if (!isRecording) return;
    const x = e.clientX;
    const y = e.clientY;
    setRecordedSteps((prev) => [...prev, { x, y }]);
  };

  handleRecordingPointerMoveRef.current = (e: MouseEvent) => {
    if (!isRecording) return;
    updateRecordingPointer(e.clientX, e.clientY);
  };

  refreshRecordingPointerTargetRef.current = () => {
    if (!isRecording || !recordingPointerPosition) return;
    const { x, y } = recordingPointerPosition;
    setHoveredButtonRect(getButtonRectAtPoint(x, y));
  };

  handleKeydownRef.current = (e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isCtrl && isShift && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      if (isRecording) {
        stopRecording();
      }
      if (isPlaying) {
        stopPlayback();
      } else {
        startPlayback();
      }
    }

    if (isCtrl && isShift && (e.key === "r" || e.key === "R")) {
      e.preventDefault();
      toggleRecording();
    }
  };

  // ---------- 生命周期 ----------
  useEffect(() => {
    document.addEventListener("keydown", handleKeydownStable);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      removeRecordingClickListener();
      removeRecordingPointerListeners();
      document.removeEventListener("keydown", handleKeydownStable);
    };
  }, [handleKeydownStable, removeRecordingClickListener, removeRecordingPointerListeners]);

  return (
    <>
      {/* 录制时的十字准线 overlay */}
      {isRecording && recordingPointerPosition && (
        <div className="recording-pointer-overlay" aria-hidden="true">
          {crosshairSegments.map((segment) => (
            <div
              key={segment.key}
              className={`recording-crosshair-line ${segment.className}`}
              style={segment.style}
            />
          ))}
          {hoveredButtonRect && (
            <div
              className="recording-button-outline"
              style={buttonOutlineStyle}
            />
          )}
          <div className="recording-coordinate-badge" style={coordinateBadgeStyle}>
            <span>clientX {recordingPointerPosition.x}</span>
            <span>clientY {recordingPointerPosition.y}</span>
          </div>
        </div>
      )}

      {/* 可拖拽的连点器卡片 */}
      <Draggable canOverflow={false}>
        <div
          className="auto-clicker-card"
          style={{ display: visible ? "block" : "none" }}
        >
          <h1>
            <span>🖱️ 连点器 · 统一间隔</span>
          </h1>
          <div className="subhead">
            录制点击序列 · 统一间隔控制 · 快捷键 <kbd>Ctrl+Shift+L</kbd> 切换播放
          </div>

          <div className="control-group">
            <label htmlFor="intervalInput">⏱️ 间隔 (ms)</label>
            <input
              id="intervalInput"
              type="number"
              min={50}
              max={10000}
              step={50}
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              onBlur={onIntervalChange}
            />
            <span className="unit-label">ms</span>
          </div>

          <div className="btn-group">
            <button
              className="btn btn-primary"
              disabled={isPlaying || isRecording}
              onClick={startPlayback}
            >
              ▶ 播放
            </button>
            <button
              className="btn btn-danger"
              disabled={!isPlaying}
              onClick={stopPlayback}
            >
              ⏹ 停止
            </button>
            <button
              className={`btn btn-success ${isRecording ? "btn-recording" : ""}`}
              onClick={() => toggleRecording()}
            >
              {isRecording ? "⏹ 停止录制" : "🔴 录制"}
            </button>
            <button className="btn btn-outline" onClick={resetCounter}>
              ⟳ 重置计数
            </button>
          </div>

          <div className="delay-hint">
            <span>💡</span>
            <span>所有步骤使用统一的间隔时间，适合弹窗延迟较固定的场景</span>
          </div>

          <div className="status-box">
            <div className="status-indicator">
              <span className={`status-dot ${statusDotClass}`} />
              <span style={{ fontWeight: 450, color: "#1e2a44" }}>{statusText}</span>
              <span className="record-steps">步骤: {recordedSteps.length}</span>
            </div>
            <div className="click-counter">
              <span>点击</span>
              <span>{clickCounter}</span>
            </div>
          </div>

          <div className="footer-note">
            <span>⚡ 录制时点击页面任意位置记录坐标</span>
            <span>· 再次点击录制按钮结束</span>
          </div>
        </div>
      </Draggable>
    </>
  );
};

export default AutoClick;
