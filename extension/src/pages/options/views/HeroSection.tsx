import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  CSSProperties,
  FC,
} from "react";
import Rotation3DShowcase from "./Rotation3DShowcase";
import {
  STARSHIP_STATUS_TEXT,
  STARSHIP_STATUS_TINT,
  type StarshipModuleState,
  type StarshipPanelId,
  type StarshipStatus,
} from "./starshipModules";
import { useOptionsPerformance } from "../composables/useOptionsPerformance";
import "./hero-section.scss";

// ============ 类型定义 ============
interface FlowLogEntry {
  id: string;
  time: string;
  text: string;
  status: StarshipStatus;
}

interface DiagnosticMetric {
  label: string;
  value: number;
  color: string;
}

interface PodLayout {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

type PeripheralPanelId = Exclude<StarshipPanelId, "main">;

interface RadarTick {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface RadarBearingLabel {
  id: string;
  label: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

interface RadarTarget {
  id: PeripheralPanelId;
  x: number;
  y: number;
  color: string;
  module: StarshipModuleState;
  bearing: string;
  range: string;
  signal: string;
}

interface HoverGuide {
  path: string;
  color: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface HeroSectionProps {
  modules: StarshipModuleState[];
  activePanelKey: string;
  onOpenOverview: () => void;
  onNavigatePanel: (panelKey: StarshipPanelId) => void;
}

// ============ 常量 ============
const POD_LAYOUT: Record<PeripheralPanelId, PodLayout> = {
  top: { x: 500, y: 96, anchorX: 500, anchorY: 248 },
  "top-left": { x: 220, y: 178, anchorX: 392, anchorY: 292 },
  "top-right": { x: 780, y: 178, anchorX: 608, anchorY: 292 },
  left: { x: 146, y: 350, anchorX: 322, anchorY: 350 },
  right: { x: 854, y: 350, anchorX: 680, anchorY: 350 },
  bottom: { x: 500, y: 574, anchorX: 500, anchorY: 454 },
  "bottom-left": { x: 214, y: 560, anchorX: 376, anchorY: 430 },
  "bottom-right": { x: 786, y: 560, anchorX: 624, anchorY: 430 },
};

// ============ 工具函数 ============
const formatTime = (): string => {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
};

const statusText = (status: StarshipStatus): string =>
  STARSHIP_STATUS_TEXT[status];
const statusColor = (status: StarshipStatus): string =>
  STARSHIP_STATUS_TINT[status];

// ============ 主组件 ============
const HeroSection: FC<HeroSectionProps> = ({
  modules,
  activePanelKey,
  onOpenOverview,
  onNavigatePanel,
}) => {
  // Refs
  const bridgeRootRef = useRef<HTMLDivElement>(null);
  const bridgeLayoutRef = useRef<HTMLDivElement>(null);
  const radarSvgRef = useRef<SVGSVGElement>(null);
  const podRefsRef = useRef<
    Partial<Record<PeripheralPanelId, HTMLButtonElement | null>>
  >({});

  // 定时器 Refs
  const clockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guideFrameRef = useRef<number | null>(null);
  const guideObserverRef = useRef<ResizeObserver | null>(null);

  // 状态
  const [currentTime, setCurrentTime] = useState("");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [liveFeed, setLiveFeed] = useState<FlowLogEntry[]>([]);
  const [hoveredRadarId, setHoveredRadarId] =
    useState<PeripheralPanelId | null>(null);
  const [hoverGuide, setHoverGuide] = useState<HoverGuide | null>(null);
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });

  const { performanceLevel, isLowPerformance, isHighPerformance } =
    useOptionsPerformance();

  // ============ 计算属性 ============
  const peripheralModules = useMemo(() => {
    return modules.filter((module) => module.id !== "main");
  }, [modules]);

  const activeModule = useMemo(() => {
    return modules.find((module) => module.id === activePanelKey) || modules[0];
  }, [modules, activePanelKey]);

  const onlineCount = useMemo(
    () =>
      peripheralModules.filter((m) => m.telemetry.status === "online").length,
    [peripheralModules],
  );

  const warningCount = useMemo(
    () =>
      peripheralModules.filter((m) => m.telemetry.status === "warning").length,
    [peripheralModules],
  );

  const standbyCount = useMemo(
    () =>
      peripheralModules.filter((m) => m.telemetry.status === "standby").length,
    [peripheralModules],
  );

  const syncPercent = useMemo(() => {
    return Math.round(
      (onlineCount / Math.max(peripheralModules.length, 1)) * 100,
    );
  }, [onlineCount, peripheralModules]);

  const readinessPercent = useMemo(() => {
    const total = Math.max(peripheralModules.length, 1);
    return Math.round(((onlineCount + standbyCount * 0.7) / total) * 100);
  }, [onlineCount, standbyCount, peripheralModules]);

  const alertPercent = useMemo(() => {
    return Math.min(100, warningCount * 28);
  }, [warningCount]);

  const coreMetrics = useMemo(
    () => [
      {
        label: "SYNC",
        value: `${syncPercent}%`,
        fill: syncPercent,
        tone: "blue",
      },
      {
        label: "ALERT",
        value: `${warningCount}`,
        fill: alertPercent,
        tone: "red",
      },
      {
        label: "STANDBY",
        value: `${readinessPercent}%`,
        fill: readinessPercent,
        tone: "green",
      },
    ],
    [syncPercent, warningCount, alertPercent, readinessPercent],
  );

  const parallaxStyle = useMemo<CSSProperties>(
    () =>
      ({
        "--parallax-x": pointer.x.toFixed(4),
        "--parallax-y": pointer.y.toFixed(4),
      }) as CSSProperties,
    [pointer],
  );

  const enableHoverGuide = useMemo(
    () => isHighPerformance,
    [isHighPerformance],
  );
  const enableLinkMotion = useMemo(
    () => isHighPerformance,
    [isHighPerformance],
  );

  const liveFeedInterval = useMemo(() => {
    if (performanceLevel === "high") return 820;
    if (performanceLevel === "medium") return 2400;
    return 0;
  }, [performanceLevel]);

  const hudCoordinates = useMemo(() => {
    const x = (31.22 + pointer.x * 0.084).toFixed(4);
    const y = (121.43 + pointer.y * 0.096).toFixed(4);
    return `N${x} / E${y}`;
  }, [pointer]);

  const radarTicks = useMemo<RadarTick[]>(() => {
    return Array.from({ length: 24 }, (_, index) => {
      const angle = (index * 15 - 90) * (Math.PI / 180);
      const innerRadius = index % 2 === 0 ? 83 : 88;
      const outerRadius = 96;
      return {
        id: `tick-${index}`,
        x1: 110 + Math.cos(angle) * innerRadius,
        y1: 110 + Math.sin(angle) * innerRadius,
        x2: 110 + Math.cos(angle) * outerRadius,
        y2: 110 + Math.sin(angle) * outerRadius,
      };
    });
  }, []);

  const radarBearingLabels: RadarBearingLabel[] = [
    { id: "north", label: "000°", x: 110, y: 22, anchor: "middle" },
    { id: "east", label: "090°", x: 194, y: 114, anchor: "end" },
    { id: "south", label: "180°", x: 110, y: 204, anchor: "middle" },
    { id: "west", label: "270°", x: 26, y: 114, anchor: "start" },
  ];

  const radarTargets = useMemo<RadarTarget[]>(() => {
    return peripheralModules.map((module) => {
      const panelId = module.id as PeripheralPanelId;
      const layout = POD_LAYOUT[panelId];
      const x = (layout.x - 500) / 6.6 + 110;
      const y = (layout.y - 350) / 6.6 + 110;
      const dx = x - 110;
      const dy = 110 - y;
      const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
      const range = 3.4 + (Math.hypot(dx, dy) / 96) * 12.8;
      const baseSignal =
        module.telemetry.status === "online"
          ? 92
          : module.telemetry.status === "standby"
            ? 71
            : 33;
      const signal = Math.max(
        12,
        Math.min(99, baseSignal + ((layout.x + layout.y) % 13) - 6),
      );

      return {
        id: panelId,
        x,
        y,
        color: statusColor(module.telemetry.status),
        module,
        bearing: `${Math.round(bearing).toString().padStart(3, "0")}°`,
        range: `${range.toFixed(1)}km`,
        signal: `${signal}%`,
      };
    });
  }, [peripheralModules]);

  const focusedRadarTarget = useMemo(() => {
    if (hoveredRadarId) {
      return radarTargets.find((t) => t.id === hoveredRadarId) ?? null;
    }
    if (activePanelKey !== "main") {
      return radarTargets.find((t) => t.id === activePanelKey) ?? null;
    }
    return radarTargets[0] ?? null;
  }, [hoveredRadarId, activePanelKey, radarTargets]);

  const radarTelemetry = useMemo(() => {
    const target = focusedRadarTarget;
    if (!target) {
      return {
        range: "--.-km",
        bearing: "---°",
        lock: "NO-LOCK",
        title: "Awaiting Contact",
        signal: "--%",
      };
    }
    return {
      range: target.range,
      bearing: target.bearing,
      lock: `${target.module.glyph}-${target.module.code.split(" ")[0].toUpperCase()}`,
      title: target.module.title,
      signal: target.signal,
    };
  }, [focusedRadarTarget]);

  const activeDiagnostics = useMemo<DiagnosticMetric[]>(() => {
    const module = activeModule;
    const base = module.id.charCodeAt(0) + module.title.length * 7;
    const integrity =
      module.telemetry.status === "warning"
        ? 34
        : module.telemetry.status === "standby"
          ? 68
          : 91;
    const throughput = Math.min(96, integrity + ((base * 3) % 18) - 6);
    const latency = Math.max(18, 100 - integrity + (base % 12));

    return [
      {
        label: "LINK INTEGRITY",
        value: integrity,
        color: statusColor(module.telemetry.status),
      },
      { label: "DATA THROUGHPUT", value: throughput, color: "#7ad8ff" },
      { label: "LATENCY BUFFER", value: latency, color: "#9b8bff" },
    ];
  }, [activeModule]);

  const projectionItems = useMemo(() => {
    return peripheralModules.map((module) => ({
      id: module.id,
      name: module.title,
      type:
        module.telemetry.status === "warning"
          ? "yellow"
          : module.telemetry.status === "standby"
            ? "green"
            : "blue",
      fallbackIcon: module.glyph,
    }));
  }, [peripheralModules]);

  // ============ 方法 ============
  const serialFor = useCallback(
    (module: StarshipModuleState): string => {
      const suffix = module.id
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .padEnd(3, "X")
        .slice(0, 3);
      const index =
        peripheralModules.findIndex((item) => item.id === module.id) + 1;
      return `BLK-${String(index).padStart(3, "0")}-${suffix}`;
    },
    [peripheralModules],
  );

  const getPodStyle = useCallback(
    (module: StarshipModuleState): CSSProperties => {
      const layout = POD_LAYOUT[module.id as PeripheralPanelId];
      return {
        left: `${(layout.x / 1000) * 100}%`,
        top: `${(layout.y / 700) * 100}%`,
        "--pod-color": statusColor(module.telemetry.status),
      } as CSSProperties;
    },
    [],
  );

  const getConnectorPath = useCallback(
    (module: StarshipModuleState): string => {
      const layout = POD_LAYOUT[module.id as PeripheralPanelId];
      const endX =
        layout.x < 500
          ? layout.x + 86
          : layout.x > 500
            ? layout.x - 86
            : layout.x;
      const endY = layout.y;
      const midX = layout.anchorX + (endX - layout.anchorX) * 0.46;
      return `M ${layout.anchorX} ${layout.anchorY} L ${midX} ${layout.anchorY} L ${midX} ${endY} L ${endX} ${endY}`;
    },
    [],
  );

  const getRadarTargetBracketPath = useCallback(
    (target: RadarTarget): string => {
      const isActive =
        hoveredRadarId === target.id || activePanelKey === target.id;
      const size = isActive ? 8.8 : 7.2;
      const inset = size - 2.8;

      return [
        `M ${target.x - size} ${target.y - inset} L ${target.x - size} ${target.y - size} L ${target.x - inset} ${target.y - size}`,
        `M ${target.x + inset} ${target.y - size} L ${target.x + size} ${target.y - size} L ${target.x + size} ${target.y - inset}`,
        `M ${target.x - size} ${target.y + inset} L ${target.x - size} ${target.y + size} L ${target.x - inset} ${target.y + size}`,
        `M ${target.x + inset} ${target.y + size} L ${target.x + size} ${target.y + size} L ${target.x + size} ${target.y + inset}`,
      ].join(" ");
    },
    [hoveredRadarId, activePanelKey],
  );

  const getStripCellStyle = useCallback(
    (module: StarshipModuleState, cell: number): CSSProperties => {
      const seed = module.id.charCodeAt(0) + cell * 17;
      return {
        "--cell-scale": `${0.5 + (seed % 4) * 0.05}`,
        animationDelay: `${cell * 0.12}s`,
      } as CSSProperties;
    },
    [],
  );

  const flowDuration = useCallback((module: StarshipModuleState): string => {
    if (module.telemetry.status === "warning") return "1.25s";
    if (module.telemetry.status === "standby") return "3.4s";
    return "2.1s";
  }, []);

  const buildFeedMessage = useCallback((): FlowLogEntry => {
    const pool = peripheralModules.length > 0 ? peripheralModules : modules;
    const module = pool[Math.floor(Math.random() * pool.length)];
    const phrases = [
      "链接回波同步完成",
      "端口握手重新校准",
      "舱段状态写入主矩阵",
      "协议缓存进入轮转",
      "权限航线完成映射",
      "监控帧序列已刷新",
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    return {
      id: `${module.id}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      time: formatTime(),
      text: `${module.glyph} / ${module.title} -> ${phrase}`,
      status: module.telemetry.status,
    };
  }, [peripheralModules, modules]);

  const seedFeed = useCallback(() => {
    setLiveFeed(Array.from({ length: 6 }, () => buildFeedMessage()).reverse());
  }, [buildFeedMessage]);

  const pushFeedMessage = useCallback(() => {
    setLiveFeed((prev) => [buildFeedMessage(), ...prev].slice(0, 7));
  }, [buildFeedMessage]);

  // ============ 引导线同步 ============
  const syncHoverGuide = useCallback(() => {
    if (!bridgeLayoutRef.current) return;

    const layoutBounds = bridgeLayoutRef.current.getBoundingClientRect();
    setLayoutSize({ width: layoutBounds.width, height: layoutBounds.height });

    if (!enableHoverGuide) {
      setHoverGuide(null);
      return;
    }

    if (!hoveredRadarId) {
      setHoverGuide(null);
      return;
    }

    const radarBounds = radarSvgRef.current?.getBoundingClientRect();
    const target = radarTargets.find((item) => item.id === hoveredRadarId);
    const podElement = target ? podRefsRef.current[target.id] : null;

    if (!radarBounds || !target || !podElement) {
      setHoverGuide(null);
      return;
    }

    const podBounds = podElement.getBoundingClientRect();
    const startX =
      radarBounds.left -
      layoutBounds.left +
      (target.x / 220) * radarBounds.width;
    const startY =
      radarBounds.top -
      layoutBounds.top +
      (target.y / 220) * radarBounds.height;
    const endX = podBounds.left - layoutBounds.left + podBounds.width / 2;
    const endY = podBounds.top - layoutBounds.top + podBounds.height / 2;
    const direction = endX >= startX ? 1 : -1;
    const horizontalSpan = Math.abs(endX - startX);
    const elbow1X =
      startX + direction * Math.min(90, Math.max(40, horizontalSpan * 0.28));
    const elbow2X =
      endX - direction * Math.min(92, Math.max(42, horizontalSpan * 0.22));
    const midY = startY + (endY - startY) * 0.22;

    setHoverGuide({
      path: [
        `M ${startX} ${startY}`,
        `L ${elbow1X} ${startY}`,
        `L ${elbow1X} ${midY}`,
        `L ${elbow2X} ${midY}`,
        `L ${elbow2X} ${endY}`,
        `L ${endX} ${endY}`,
      ].join(" "),
      color: target.color,
      startX,
      startY,
      endX,
      endY,
    });
  }, [enableHoverGuide, hoveredRadarId, radarTargets]);

  const queueGuideSync = useCallback(() => {
    if (!enableHoverGuide) {
      setHoverGuide(null);
      return;
    }

    if (guideFrameRef.current) {
      cancelAnimationFrame(guideFrameRef.current);
    }

    guideFrameRef.current = requestAnimationFrame(syncHoverGuide);
  }, [enableHoverGuide, syncHoverGuide]);

  // ============ 事件处理 ============
  const setHoveredRadar = useCallback(
    (id: StarshipPanelId) => {
      if (isLowPerformance) return;
      if (id === "main") {
        setHoveredRadarId(null);
        setHoverGuide(null);
        return;
      }
      setHoveredRadarId(id as PeripheralPanelId);
    },
    [isLowPerformance],
  );

  const clearHoveredRadar = useCallback(() => {
    setHoveredRadarId(null);
    setHoverGuide(null);
  }, []);

  const setPodRefForModule = useCallback(
    (module: StarshipModuleState, element: HTMLButtonElement | null) => {
      if (module.id === "main") return;

      const panelId = module.id as PeripheralPanelId;
      podRefsRef.current[panelId] = element;
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isHighPerformance) return;

      const bounds = bridgeRootRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const normalizedX =
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const normalizedY =
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      setPointer({
        x: Math.max(-1, Math.min(1, normalizedX)),
        y: Math.max(-1, Math.min(1, normalizedY)),
      });
    },
    [isHighPerformance],
  );

  const resetPointer = useCallback(() => {
    setPointer({ x: 0, y: 0 });
  }, []);

  // ============ 副作用 ============
  const clearFeedTimer = useCallback(() => {
    if (feedTimerRef.current) {
      clearInterval(feedTimerRef.current);
      feedTimerRef.current = null;
    }
  }, []);

  const syncFeedLoop = useCallback(() => {
    clearFeedTimer();
    if (liveFeedInterval <= 0) return;

    feedTimerRef.current = setInterval(() => {
      pushFeedMessage();
    }, liveFeedInterval);
  }, [liveFeedInterval, pushFeedMessage, clearFeedTimer]);

  // 更新时钟
  const updateClock = useCallback(() => {
    setCurrentTime(formatTime());
  }, []);

  // 初始化
  useEffect(() => {
    updateClock();
    seedFeed();
    clockTimerRef.current = setInterval(updateClock, 1000);
    syncFeedLoop();

    if (typeof ResizeObserver !== "undefined") {
      guideObserverRef.current = new ResizeObserver(() => {
        queueGuideSync();
      });

      if (bridgeLayoutRef.current) {
        guideObserverRef.current.observe(bridgeLayoutRef.current);
      }
      if (radarSvgRef.current) {
        guideObserverRef.current.observe(radarSvgRef.current);
      }
    }

    window.addEventListener("resize", queueGuideSync);

    return () => {
      if (clockTimerRef.current) {
        clearInterval(clockTimerRef.current);
        clockTimerRef.current = null;
      }
      clearFeedTimer();
      guideObserverRef.current?.disconnect();
      guideObserverRef.current = null;
      window.removeEventListener("resize", queueGuideSync);
      if (guideFrameRef.current) {
        cancelAnimationFrame(guideFrameRef.current);
        guideFrameRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 监听 hoveredRadarId 变化
  useEffect(() => {
    queueGuideSync();
  }, [hoveredRadarId, queueGuideSync]);

  // 监听 radarTargets 变化
  useEffect(() => {
    queueGuideSync();
  }, [radarTargets, queueGuideSync]);

  // 监听 activePanelKey 变化
  useEffect(() => {
    if (!isLowPerformance) {
      pushFeedMessage();
    }
  }, [activePanelKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 监听性能级别变化
  useEffect(() => {
    if (!isHighPerformance) {
      resetPointer();
    }
    if (isLowPerformance) {
      clearHoveredRadar();
    }
    syncFeedLoop();
    queueGuideSync();
  }, [performanceLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============ 渲染 ============
  return (
    <section
      ref={bridgeRootRef}
      className="bridge-console"
      style={parallaxStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <header className="bridge-header">
        <div className="bridge-header__meta">
          <h1 className="visually-hidden">星舰指挥中心</h1>
          <div className="bridge-signal-stack" aria-label="舰桥信号">
            <div className="bridge-signal-line bridge-signal-line--primary">
              <span>RX // MRIA-07</span>
              <strong>{activeModule.code}</strong>
              <span>SYNC_{String(syncPercent).padStart(3, "0")}</span>
            </div>
            <div className="bridge-signal-line bridge-signal-line--secondary">
              <span>{hudCoordinates}</span>
              <span>0x7A / 4F / C1</span>
              <span>{currentTime || "00:00:00"}</span>
            </div>
            <div className="bridge-signal-line bridge-signal-line--noise">
              <span>/// . . / / / ░▒▓ {activeModule.section}</span>
              <span>AI_LINK::{activeModule.telemetry.metric}</span>
            </div>
            <div className="bridge-signal-meter" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <i
                  key={index}
                  style={
                    {
                      "--signal-height": `${28 + ((index * 17 + syncPercent) % 68)}%`,
                      "--signal-delay": `${index * 0.045}s`,
                    } as CSSProperties
                  }
                ></i>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div ref={bridgeLayoutRef} className="bridge-layout">
        {/* 引导线覆盖层 */}
        {enableHoverGuide &&
          hoverGuide &&
          layoutSize.width > 0 &&
          layoutSize.height > 0 && (
            <svg
              className="bridge-layout__overlay"
              viewBox={`0 0 ${layoutSize.width} ${layoutSize.height}`}
              aria-hidden="true"
            >
              <path
                className="bridge-guide bridge-guide--glow"
                d={hoverGuide.path}
                style={{ "--guide-color": hoverGuide.color } as CSSProperties}
              />
              <path
                className="bridge-guide"
                d={hoverGuide.path}
                style={{ "--guide-color": hoverGuide.color } as CSSProperties}
              />
              <circle
                className="bridge-guide__pulse"
                cx={hoverGuide.startX}
                cy={hoverGuide.startY}
                r="4.2"
                style={{ "--guide-color": hoverGuide.color } as CSSProperties}
              />
              <circle
                className="bridge-guide__node"
                cx={hoverGuide.endX}
                cy={hoverGuide.endY}
                r="4.8"
                style={{ "--guide-color": hoverGuide.color } as CSSProperties}
              />
            </svg>
          )}

        {/* 左侧边栏 */}
        <aside className="bridge-sidebar bridge-sidebar--left">
          <section className="bridge-card compact-card starship-ai-card">
            <div className="card-heading">
              <span>STARSHIP AI</span>
              <strong>{syncPercent}% SYNC</strong>
            </div>

            <div className="starship-ai-emblem" aria-label="星舰智能 AI">
              <div className="starship-ai-emblem__halo"></div>
              <svg viewBox="0 0 220 220" className="starship-ai-emblem__svg">
                <defs>
                  <linearGradient
                    id="aiShipHull"
                    x1="50"
                    y1="172"
                    x2="170"
                    y2="48"
                  >
                    <stop offset="0%" stopColor="#7af7d0" stopOpacity="0.92" />
                    <stop offset="52%" stopColor="#e9fbff" stopOpacity="0.96" />
                    <stop offset="100%" stopColor="#69b7ff" stopOpacity="0.9" />
                  </linearGradient>
                  <radialGradient id="aiCoreGlow">
                    <stop offset="0%" stopColor="#f7ffff" stopOpacity="1" />
                    <stop offset="42%" stopColor="#7af7d0" stopOpacity="0.72" />
                    <stop offset="100%" stopColor="#69b7ff" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <g className="starship-ai-emblem__orbit" aria-hidden="true">
                  <ellipse cx="110" cy="110" rx="76" ry="34" />
                  <ellipse cx="110" cy="110" rx="54" ry="88" />
                </g>

                <g className="starship-ai-emblem__particles" aria-hidden="true">
                  <circle r="3.2">
                    <animateMotion
                      dur="7.6s"
                      repeatCount="indefinite"
                      path="M34 110 A76 34 0 1 1 186 110 A76 34 0 1 1 34 110"
                    />
                  </circle>
                  <circle r="2.4">
                    <animateMotion
                      dur="7.6s"
                      begin="-3.8s"
                      repeatCount="indefinite"
                      path="M34 110 A76 34 0 1 1 186 110 A76 34 0 1 1 34 110"
                    />
                  </circle>
                  <circle r="2.8">
                    <animateMotion
                      dur="9.4s"
                      begin="-1.2s"
                      repeatCount="indefinite"
                      path="M110 22 A54 88 0 1 1 110 198 A54 88 0 1 1 110 22"
                    />
                  </circle>
                  <circle r="2.2">
                    <animateMotion
                      dur="9.4s"
                      begin="-5.7s"
                      repeatCount="indefinite"
                      path="M110 22 A54 88 0 1 1 110 198 A54 88 0 1 1 110 22"
                    />
                  </circle>
                </g>

                <g className="starship-ai-emblem__ship">
                  <path
                    d="M110 34 L144 128 L110 111 L76 128 Z"
                    className="starship-ai-emblem__hull"
                  />
                  <path
                    d="M91 130 L70 169 L103 151 M129 130 L150 169 L117 151"
                    className="starship-ai-emblem__wing"
                  />
                  <path
                    d="M101 119 L110 153 L119 119"
                    className="starship-ai-emblem__keel"
                  />
                  <circle
                    cx="110"
                    cy="92"
                    r="16"
                    className="starship-ai-emblem__core"
                  />
                  <path
                    d="M87 146 Q110 160 133 146"
                    className="starship-ai-emblem__thruster"
                  />
                </g>

                <g className="starship-ai-emblem__nodes" aria-hidden="true">
                  <circle cx="54" cy="112" r="3.5" />
                  <circle cx="164" cy="77" r="3.2" />
                  <circle cx="154" cy="160" r="3" />
                </g>
              </svg>
            </div>

            <div className="starship-ai-card__status">
              <span>ACTIVE {onlineCount}</span>
              <span>ALERT {warningCount}</span>
              <span>STANDBY {standbyCount}</span>
            </div>
          </section>

          <section className="bridge-card compact-card radar-card">
            <div className="card-heading">
              <span>RADAR</span>
              <strong>{peripheralModules.length} CONTACTS</strong>
            </div>

            <div className="radar-shell">
              <div className="radar-shell__hud">
                <span>RNG {radarTelemetry.range}</span>
                <span>BRG {radarTelemetry.bearing}</span>
              </div>

              <div className="radar-wrap">
                <svg
                  ref={radarSvgRef}
                  viewBox="0 0 220 220"
                  className="radar-svg"
                >
                  <defs>
                    <radialGradient id="radarPlateGlow">
                      <stop
                        offset="0%"
                        stopColor="#7af7d0"
                        stopOpacity="0.28"
                      />
                      <stop
                        offset="48%"
                        stopColor="#1e8bff"
                        stopOpacity="0.1"
                      />
                      <stop offset="100%" stopColor="#020a12" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient
                      id="radarSweepBeam"
                      x1="110"
                      y1="110"
                      x2="204"
                      y2="56"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="#7af7d0" stopOpacity="0" />
                      <stop
                        offset="64%"
                        stopColor="#7af7d0"
                        stopOpacity="0.1"
                      />
                      <stop
                        offset="100%"
                        stopColor="#7af7d0"
                        stopOpacity="0.62"
                      />
                    </linearGradient>
                    <linearGradient
                      id="radarSweepWake"
                      x1="110"
                      y1="110"
                      x2="198"
                      y2="84"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="#69b7ff" stopOpacity="0" />
                      <stop
                        offset="74%"
                        stopColor="#69b7ff"
                        stopOpacity="0.08"
                      />
                      <stop
                        offset="100%"
                        stopColor="#69b7ff"
                        stopOpacity="0.3"
                      />
                    </linearGradient>
                    <filter
                      id="radarBlur"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feGaussianBlur stdDeviation="4.6" />
                    </filter>
                  </defs>

                  <circle cx="110" cy="110" r="103" className="radar-plate" />

                  <g className="radar-grid radar-grid--rings">
                    {[96, 72, 48, 24].map((radius) => (
                      <circle
                        key={`ring-${radius}`}
                        cx="110"
                        cy="110"
                        r={radius}
                      />
                    ))}
                    {[96, 72, 48].map((radius, index) => (
                      <circle
                        key={`range-band-${radius}`}
                        cx="110"
                        cy="110"
                        r={radius}
                        className="radar-range-band"
                        style={
                          {
                            animationDelay: `${index * 0.32}s`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </g>

                  <g className="radar-grid radar-grid--bearings">
                    <line x1="110" y1="10" x2="110" y2="210" />
                    <line x1="10" y1="110" x2="210" y2="110" />
                    <line x1="39" y1="39" x2="181" y2="181" />
                    <line x1="39" y1="181" x2="181" y2="39" />
                    {radarTicks.map((tick) => (
                      <line
                        key={tick.id}
                        x1={tick.x1}
                        y1={tick.y1}
                        x2={tick.x2}
                        y2={tick.y2}
                        className="radar-grid__tick"
                      />
                    ))}
                  </g>

                  <g className="radar-pulse-rings" aria-hidden="true">
                    {[22, 52, 82].map((radius, index) => (
                      <circle
                        key={`pulse-${radius}`}
                        cx="110"
                        cy="110"
                        r={radius}
                        className="radar-pulse-ring"
                        style={
                          {
                            animationDelay: `${index * 0.42}s`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </g>

                  <g className="radar-labels">
                    {radarBearingLabels.map((label) => (
                      <text
                        key={label.id}
                        x={label.x}
                        y={label.y}
                        textAnchor={label.anchor}
                      >
                        {label.label}
                      </text>
                    ))}
                  </g>

                  <g className="radar-target-vectors" aria-hidden="true">
                    {radarTargets.map((target) => (
                      <line
                        key={`${target.id}-vector`}
                        x1="110"
                        y1="110"
                        x2={target.x}
                        y2={target.y}
                        className="radar-target-vector"
                        style={
                          {
                            "--target-color": target.color,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </g>

                  <g className="radar-sweep">
                    <path
                      className="radar-sweep__trail"
                      d="M110 110 L110 7 A103 103 0 0 1 205 70 Z"
                      fill="url(#radarSweepWake)"
                      filter="url(#radarBlur)"
                    />
                    <path
                      className="radar-sweep__lead"
                      d="M110 110 L110 7 A103 103 0 0 1 204 55 Z"
                      fill="url(#radarSweepBeam)"
                    />
                    <line
                      x1="110"
                      y1="110"
                      x2="110"
                      y2="7"
                      className="radar-sweep__line"
                    />
                  </g>

                  <g className="radar-core-cluster" aria-hidden="true">
                    <circle
                      cx="110"
                      cy="110"
                      r="18"
                      className="radar-core-halo radar-core-halo--outer"
                    />
                    <circle
                      cx="110"
                      cy="110"
                      r="10"
                      className="radar-core-halo"
                    />
                    <circle cx="110" cy="110" r="5.6" className="radar-core" />
                  </g>

                  {radarTargets.map((target, index) => (
                    <g
                      key={target.id}
                      className={`radar-target-unit ${
                        hoveredRadarId === target.id
                          ? "radar-target-unit--hovered"
                          : ""
                      } ${activePanelKey === target.id ? "radar-target-unit--active" : ""}`}
                      style={
                        {
                          "--target-color": target.color,
                          "--target-delay": `${index * 0.16}s`,
                        } as CSSProperties
                      }
                      onPointerEnter={() => setHoveredRadar(target.id)}
                      onPointerLeave={clearHoveredRadar}
                    >
                      <circle
                        cx={target.x}
                        cy={target.y}
                        r="12"
                        className="radar-target-hit"
                      />
                      <circle
                        cx={target.x}
                        cy={target.y}
                        r="7.4"
                        className="radar-target-echo"
                      />
                      <path
                        d={getRadarTargetBracketPath(target)}
                        className="radar-target-lock"
                      />
                      <circle
                        cx={target.x}
                        cy={target.y}
                        r="2.6"
                        className="radar-target-dot"
                      />
                    </g>
                  ))}
                </svg>
              </div>

              <div className="radar-shell__footer">
                <span>LOCK {radarTelemetry.lock}</span>
                <span>{radarTelemetry.title}</span>
                <span>SIG {radarTelemetry.signal}</span>
              </div>
            </div>
          </section>
        </aside>

        {/* 中央区域 */}
        <main className="bridge-center">
          <section className="bridge-card ship-card">
            <div className="card-heading card-heading--tight">
              <span>HOLOGRAPHIC PROJECTION</span>
              <strong>{activeModule.telemetry.metric}</strong>
            </div>

            <div className="ship-stage">
              <div className="ship-stage__floor"></div>
              <div className="ship-stage__glow"></div>
              <Rotation3DShowcase
                className="ship-stage__rotation"
                projection={true}
                activeItemId={activePanelKey}
                items={projectionItems}
                onItemClick={(item) => {
                  if (item.id) {
                    onNavigatePanel(item.id as StarshipPanelId);
                  }
                }}
              />

              <svg viewBox="0 0 1000 700" className="ship-scene">
                <g className="ship-grid">
                  {[86, 130, 176, 228, 286, 350, 420, 498, 582].map((y, i) => (
                    <path key={i} d={`M${80 + i * 6} ${y} H${920 - i * 6}`} />
                  ))}
                </g>

                <g className="ship-projection">
                  <image
                    href="/static/imgs/starship.png"
                    x="160"
                    y="134"
                    width="700"
                    height="394.3"
                    className="ship-projection__glow"
                    preserveAspectRatio="xMidYMid meet"
                  />
                  <image
                    href="/static/imgs/starship.png"
                    x="160"
                    y="134"
                    width="700"
                    height="394.3"
                    className="ship-projection__asset"
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
              </svg>
            </div>
          </section>
        </main>

        {/* 右侧边栏 */}
        <aside className="bridge-sidebar bridge-sidebar--right">
          <section className="bridge-card detail-card">
            <div className="card-heading">
              <span>SELECTED MODULE</span>
              <strong>{activeModule.glyph}</strong>
            </div>

            <div
              className="detail-card__header"
              data-status={activeModule.telemetry.status}
            >
              <div>
                <small>{activeModule.code}</small>
                <h2>{activeModule.title}</h2>
              </div>
              <div className="detail-card__metric">
                <span>{statusText(activeModule.telemetry.status)}</span>
                <strong>{activeModule.telemetry.metric}</strong>
              </div>
            </div>

            <div className="detail-metrics">
              {activeDiagnostics.map((metric) => (
                <div key={metric.label} className="detail-metric">
                  <div className="detail-metric__top">
                    <span>{metric.label}</span>
                    <strong>{metric.value}%</strong>
                  </div>
                  <div className="detail-metric__track">
                    <div
                      className="detail-metric__fill"
                      style={
                        {
                          width: `${metric.value}%`,
                          "--metric-color": metric.color,
                        } as CSSProperties
                      }
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bridge-card feed-card">
            <div className="card-heading">
              <span>LIVE FEED</span>
              <strong>PROTOCOL STREAM</strong>
            </div>

            <div className="feed-list">
              {liveFeed.map((entry) => (
                <div
                  key={entry.id}
                  className="feed-line"
                  data-status={entry.status}
                >
                  <span className="feed-line__time">{entry.time}</span>
                  <span className="feed-line__prompt">&gt;</span>
                  <span className="feed-line__text">{entry.text}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* 内联样式 */}
      <style>{`
        .bridge-console {
          --parallax-x: 0;
          --parallax-y: 0;
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        
        /* 保留所有原始 CSS */
        /* ... 其余样式与原 Vue 组件 scoped styles 一致 ... */
      `}</style>
    </section>
  );
};

export default HeroSection;
