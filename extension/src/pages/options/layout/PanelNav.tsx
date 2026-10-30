import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  CSSProperties,
  ComponentType,
  lazy,
  Suspense,
} from "react";

import TacticalOverview from "../views/TacticalOverview";
import HeroSection from "../views/HeroSection";

// 类型定义
import {
  buildDefaultTelemetry,
  STARSHIP_MODULES,
  STARSHIP_STATUS_TEXT,
  StarshipPanelId,
  StarshipStatus,
  type ModuleTelemetry,
  type StarshipModuleMeta,
  type StarshipModuleState,
} from "../views/starshipModules";
import {
  normalizeOptionsPerformanceLevel,
  useOptionsPerformance,
} from "../composables/useOptionsPerformance";
import {
  NUMPAD_PANEL_POSITIONS,
  getPanelTransform,
  getViewportTransform,
  isEditableTarget,
} from "./panel-coordinates";

// 样式
import "./style.scss";

export enum PanelNavs {
  CENTER = "center",
  TOP = "top",
  TOP_RIGHT = "top-right",
  TOP_LEFT = "top-left",
  LEFT = "left",
  RIGHT = "right",
  BOTTOM_RIGHT = "bottom-right",
  BOTTOM_LEFT = "bottom-left",
  BOTTOM = "bottom",
}

export interface PanelBase {
  xPos: number;
  yPos: number;
  page: ComponentType<any> | React.ReactNode;
  title: string;
  meta: StarshipModuleMeta;
}

export interface Panel extends PanelBase {
  navs: PanelNavs;
}

export const DIRECTION_OFFSETS: Record<PanelNavs, { x: number; y: number }> = {
  center: { x: 0, y: 0 },
  top: { x: 0, y: 1 },
  "top-right": { x: 1, y: 1 },
  "top-left": { x: -1, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  "bottom-right": { x: 1, y: -1 },
  "bottom-left": { x: -1, y: -1 },
  bottom: { x: 0, y: -1 },
};

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("[PanelNav] Failed to parse localStorage payload:", error);
    return fallback;
  }
};

const statusText = (status: StarshipStatus) => STARSHIP_STATUS_TEXT[status];

// 常量
const EDGE_THRESHOLD = 56;
const HIDE_DELAY = 1100;
const ANIMATION_DURATION = 480;

export interface PanelNavShellProps {
  /** 是否可见 */
  visible?: boolean;
  /** 子元素 */
  children?: React.ReactNode;
  shipModules: Record<string, Panel>;
}

const PanelNavShell: React.FC<PanelNavShellProps> = ({
  visible,
  children,
  shipModules,
}) => {
  // 性能相关
  const { performanceLevel, isLowPerformance, isHighPerformance } =
    useOptionsPerformance();

  // Refs
  const siteWrapRef = useRef<HTMLDivElement>(null);
  const panelWrapRef = useRef<HTMLDivElement>(null);
  const bridgeHudRef = useRef<HTMLDivElement>(null);

  // 状态
  const [panels] = useState<Record<string, Panel>>(shipModules);
  const [telemetry, setTelemetry] = useState<
    Record<StarshipPanelId, ModuleTelemetry>
  >(buildDefaultTelemetry());
  // 当前视口对准的面板坐标（与 panel.xPos / panel.yPos 同一套语义）
  const [panelX, setPanelX] = useState(0);
  const [panelY, setPanelY] = useState(0);
  const [showTacticalOverview, setShowTacticalOverview] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [renderedPanelKeys, setRenderedPanelKeys] = useState<Set<string>>(
    new Set(["main"]),
  );
  const [hudHeight, setHudHeight] = useState(108);

  // 定时器 Refs
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseFrameRef = useRef<number | null>(null);
  const telemetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const glitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPointerPositionRef = useRef({ x: 0, y: 0 });

  // 其他 Refs
  const isCoarsePointerRef = useRef(false);
  const hudResizeObserverRef = useRef<ResizeObserver | null>(null);

  // 计算属性
  const panelEntries = useMemo<[string, Panel][]>(
    () => Object.entries(panels),
    [panels],
  );

  const activePanelKey = useMemo<StarshipPanelId>(() => {
    return (panelEntries.find(
      ([, panel]) => panel.xPos === panelX && panel.yPos === panelY,
    )?.[0] || StarshipPanelId.Main) as StarshipPanelId;
  }, [panelEntries, panelX, panelY]);

  const isBridgeView = useMemo(
    () => activePanelKey === StarshipPanelId.Main,
    [activePanelKey],
  );

  const activePanel = useMemo(() => {
    return panels[activePanelKey] || panelEntries[0]?.[1];
  }, [panels, activePanelKey, panelEntries]);

  const moduleStates = useMemo<StarshipModuleState[]>(() => {
    const peripheralStates = STARSHIP_MODULES.filter(
      (module) => module.id !== "main",
    ).map((module) => ({
      ...module,
      telemetry: telemetry[module.id] || module.defaultTelemetry,
    }));

    const onlineCount = peripheralStates.filter(
      (module) => module.telemetry.status === "online",
    ).length;
    const warningCount = peripheralStates.filter(
      (module) => module.telemetry.status === "warning",
    ).length;
    const standbyCount = peripheralStates.filter(
      (module) => module.telemetry.status === "standby",
    ).length;

    const mainTelemetry: ModuleTelemetry = {
      status:
        warningCount > 0
          ? StarshipStatus.Warning
          : standbyCount > 0
            ? StarshipStatus.Standby
            : StarshipStatus.Online,
      metric: `${onlineCount}/${peripheralStates.length}`,
      headline:
        warningCount > 0 ? `${warningCount} 个舱段需要复核` : "全舰链路稳定",
      detail: `待命舱段 ${standbyCount} 个 / 当前焦点 ${activePanel?.meta.code || ""}`,
    };

    return STARSHIP_MODULES.map((module) => ({
      ...module,
      telemetry:
        module.id === "main"
          ? mainTelemetry
          : telemetry[module.id] || module.defaultTelemetry,
    }));
  }, [telemetry, activePanel]);

  const activeModuleState = useMemo(() => {
    return (
      moduleStates.find((module) => module.id === activePanelKey) ||
      moduleStates[0]
    );
  }, [moduleStates, activePanelKey]);

  const resolvePanelState = useCallback(
    (key: string) => {
      return (
        moduleStates.find((module) => module.id === key) || moduleStates[0]
      );
    },
    [moduleStates],
  );

  const layoutVars = useMemo<CSSProperties>(
    () =>
      ({
        "--bridge-hud-height": `${hudHeight}px`,
      }) as CSSProperties,
    [hudHeight],
  );

  const panelWrapStyle = useMemo<CSSProperties>(() => {
    const viewport = getViewportTransform({ x: panelX, y: panelY });
    return {
      transform: `translate3d(${viewport.x}%, ${viewport.y}%, 0)`,
    };
  }, [panelX, panelY]);

  const getPanelStyle = useCallback((panel: Panel): CSSProperties => {
    const offset = getPanelTransform({ x: panel.xPos, y: panel.yPos });
    return {
      "--panel-x": `${offset.x}%`,
      "--panel-y": `${offset.y}%`,
    } as CSSProperties;
  }, []);

  const shouldRenderPanel = useCallback(
    (key: string) => renderedPanelKeys.has(key),
    [renderedPanelKeys],
  );

  // 工具函数
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const clearMouseFrame = useCallback(() => {
    if (mouseFrameRef.current !== null) {
      cancelAnimationFrame(mouseFrameRef.current);
      mouseFrameRef.current = null;
    }
  }, []);

  const detachPointerTracking = useCallback(() => {
    siteWrapRef.current?.removeEventListener("pointermove", handlePointerMove);
  }, []);

  const attachPointerTracking = useCallback(() => {
    if (isLowPerformance || !siteWrapRef.current) {
      return;
    }
    siteWrapRef.current.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
  }, [isLowPerformance]);

  const syncPerformanceMode = useCallback(() => {
    if (isLowPerformance) {
      clearHideTimer();
      clearMouseFrame();
      detachPointerTracking();
      setShowNav(true);
      setIsAnimating(false);
      return;
    }

    attachPointerTracking();
    setShowNav(isCoarsePointerRef.current);
  }, [
    isLowPerformance,
    clearHideTimer,
    clearMouseFrame,
    detachPointerTracking,
    attachPointerTracking,
  ]);

  const updateNavVisibility = useCallback(
    (x: number, y: number) => {
      if (isCoarsePointerRef.current) {
        setShowNav(true);
        return;
      }

      const nearEdge =
        x < EDGE_THRESHOLD ||
        x > window.innerWidth - EDGE_THRESHOLD ||
        y < EDGE_THRESHOLD ||
        y > window.innerHeight - EDGE_THRESHOLD;

      if (nearEdge) {
        setShowNav(true);
        clearHideTimer();
        return;
      }

      if (showNav && !hideTimerRef.current) {
        hideTimerRef.current = setTimeout(() => {
          setShowNav(false);
          hideTimerRef.current = null;
        }, HIDE_DELAY);
      }
    },
    [showNav, clearHideTimer],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (isLowPerformance) {
        return;
      }

      pendingPointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      if (mouseFrameRef.current !== null) {
        return;
      }

      mouseFrameRef.current = window.requestAnimationFrame(() => {
        mouseFrameRef.current = null;
        updateNavVisibility(
          pendingPointerPositionRef.current.x,
          pendingPointerPositionRef.current.y,
        );
      });
    },
    [isLowPerformance, updateNavVisibility],
  );

  const triggerAnimation = useCallback(() => {
    if (isLowPerformance) {
      setIsAnimating(false);
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      return;
    }

    setIsAnimating(true);

    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }

    animationTimerRef.current = setTimeout(() => {
      setIsAnimating(false);
      animationTimerRef.current = null;
    }, ANIMATION_DURATION);
  }, [isLowPerformance]);

  const syncHudHeight = useCallback(() => {
    const nextHeight = Math.ceil(
      bridgeHudRef.current?.getBoundingClientRect().height || 108,
    );
    setHudHeight(Math.max(92, nextHeight));
  }, []);

  const rememberPanel = useCallback((key: string) => {
    setRenderedPanelKeys((prev) => {
      if (prev.has(key)) return prev;
      return new Set(prev).add(key);
    });
  }, []);

  const focusPanel = useCallback(
    (options: { panelKey?: string; panelPos?: { x: number; y: number } }) => {
      if (!options.panelKey && options.panelPos === void 0) return;
      const { panelKey, panelPos } = options;
      if (panelKey) {
        const panel = panels[panelKey];
        if (!panel) return;
        setPanelX(panel.xPos);
        setPanelY(panel.yPos);
        rememberPanel(panelKey);
      } else {
        setPanelX(panelPos?.x ?? 0);
        setPanelY(panelPos?.y ?? 0);
        const targetKey = panelEntries.find(
          ([, candidate]) =>
            candidate.xPos === (panelPos?.x ?? 0) &&
            candidate.yPos === (panelPos?.y ?? 0),
        )?.[0];
        rememberPanel(targetKey || PanelNavs.CENTER);
      }

      triggerAnimation();
      setShowTacticalOverview(false);
    },
    [panels, panelEntries, rememberPanel, triggerAnimation],
  );

  const navigate = useCallback(
    (direction: PanelNavs) => {
      if (!activePanel) return;

      const offset = DIRECTION_OFFSETS[direction];
      if (!offset) return;

      const targetKey = panelEntries.find(
        ([, candidate]) =>
          candidate.xPos === activePanel.xPos + offset.x &&
          candidate.yPos === activePanel.yPos + offset.y,
      )?.[0];

      if (targetKey) {
        focusPanel({ panelKey: targetKey });
      }
    },
    [activePanel, panelEntries, focusPanel],
  );

  const moveUp = useCallback(() => navigate(PanelNavs.TOP), [navigate]);
  const moveLeft = useCallback(() => navigate(PanelNavs.LEFT), [navigate]);
  const moveRight = useCallback(() => navigate(PanelNavs.RIGHT), [navigate]);
  const moveDown = useCallback(() => navigate(PanelNavs.BOTTOM), [navigate]);
  const moveUpRight = useCallback(
    () => navigate(PanelNavs.TOP_RIGHT),
    [navigate],
  );
  const moveUpLeft = useCallback(
    () => navigate(PanelNavs.TOP_LEFT),
    [navigate],
  );
  const moveDownRight = useCallback(
    () => navigate(PanelNavs.BOTTOM_RIGHT),
    [navigate],
  );
  const moveDownLeft = useCallback(
    () => navigate(PanelNavs.BOTTOM_LEFT),
    [navigate],
  );

  // 加载遥测数据
  const loadTelemetry = useCallback(async () => {
    const next = buildDefaultTelemetry();

    try {
      const canUseChromeStorage =
        typeof chrome !== "undefined" && !!chrome.storage?.local;
      const snapshot = canUseChromeStorage
        ? await chrome.storage.local.get([
            "userInfo",
            "domainConfigs",
            "extensionSettings",
            "themeColor",
            "language",
            "errorMonitorConfig",
          ])
        : {};

      const extensionSettings = (snapshot.extensionSettings || {}) as Record<
        string,
        unknown
      >;
      const themeColor =
        typeof snapshot.themeColor === "string"
          ? snapshot.themeColor
          : "#409EFF";
      const language =
        typeof snapshot.language === "string"
          ? snapshot.language
          : navigator.language || "zh-CN";
      const debugMode = Boolean(extensionSettings.debugMode);
      const autoUpdate = extensionSettings.autoCheckUpdate !== false;
      const performanceMode = normalizeOptionsPerformanceLevel(
        extensionSettings.performanceMode,
      );

      next.left = {
        status: debugMode ? StarshipStatus.Warning : StarshipStatus.Online,
        metric: autoUpdate ? "AUTO" : "MANUAL",
        headline: debugMode ? "调试模式已开启" : "基础设置稳定",
        detail: `主题 ${themeColor.toUpperCase()} / 语言 ${language.toUpperCase()} / 性能 ${performanceMode.toUpperCase()}`,
      };

      const users = (snapshot.userInfo || {}) as Record<
        string,
        { enabled?: boolean }
      >;
      const totalUsers = Object.keys(users).length;
      const enabledUsers = Object.values(users).filter(
        (user) => user?.enabled !== false,
      ).length;
      next.right = {
        status:
          totalUsers === 0
            ? StarshipStatus.Standby
            : enabledUsers === totalUsers
              ? StarshipStatus.Online
              : StarshipStatus.Warning,
        metric: String(totalUsers).padStart(2, "0"),
        headline:
          totalUsers === 0
            ? "暂无船员档案"
            : `${enabledUsers} 名船员处于启用态`,
        detail:
          totalUsers === 0
            ? "进入模块创建首个自动登录用户"
            : `已备案 ${totalUsers} / 禁用 ${totalUsers - enabledUsers}`,
      };

      const domainConfigs = (snapshot.domainConfigs || {}) as Record<
        string,
        { enabled?: boolean } | string
      >;
      const domainEntries = Object.values(domainConfigs);
      const enabledRoutes = domainEntries.filter((config) => {
        if (typeof config === "string") {
          return true;
        }
        return config?.enabled !== false;
      }).length;
      next.bottom = {
        status:
          enabledRoutes > 0 ? StarshipStatus.Online : StarshipStatus.Standby,
        metric: `${enabledRoutes}/${domainEntries.length}`,
        headline:
          domainEntries.length === 0
            ? "尚未建立域名航线"
            : `${enabledRoutes} 条航线保持开放`,
        detail:
          domainEntries.length === 0
            ? "首次打开后会自动生成默认域名矩阵"
            : `总脚本模块 ${domainEntries.length} 个`,
      };

      const knowledgeNodes = safeJsonParse<any[]>(
        window.localStorage.getItem("mria_knowledge_graph_nodes"),
        [],
      );
      const masteredNodes = knowledgeNodes.filter(
        (node) => node?.status === "mastered",
      ).length;
      const activeNodes = knowledgeNodes.filter(
        (node) => node?.status === "active",
      ).length;
      next["bottom-left"] = {
        status:
          knowledgeNodes.length === 0
            ? StarshipStatus.Standby
            : masteredNodes > 0
              ? StarshipStatus.Online
              : StarshipStatus.Standby,
        metric:
          knowledgeNodes.length > 0
            ? String(knowledgeNodes.length).padStart(2, "0")
            : "SEED",
        headline:
          knowledgeNodes.length === 0
            ? "等待生成技能图谱"
            : `${activeNodes} 个节点处于实践中`,
        detail:
          knowledgeNodes.length === 0
            ? "首次进入后会加载内置技能书模板"
            : `已掌握 ${masteredNodes} / 总节点 ${knowledgeNodes.length}`,
      };

      const monitorConfig = (snapshot.errorMonitorConfig || {}) as Record<
        string,
        any
      >;
      const monitorEnabled = Boolean(monitorConfig.enabled);
      const callbackUrl =
        typeof monitorConfig.webhookUrl === "string"
          ? monitorConfig.webhookUrl
          : typeof monitorConfig.wsUrl === "string"
            ? monitorConfig.wsUrl
            : "";
      const whitelistCount = Array.isArray(monitorConfig.domainWhitelist)
        ? monitorConfig.domainWhitelist.length
        : 0;
      const blacklistCount = Array.isArray(monitorConfig.domainBlacklist)
        ? monitorConfig.domainBlacklist.length
        : 0;
      next.top = {
        status: !monitorEnabled
          ? StarshipStatus.Standby
          : callbackUrl
            ? StarshipStatus.Online
            : StarshipStatus.Warning,
        metric: monitorEnabled
          ? `${monitorConfig.throttleInterval || 0}s`
          : "OFF",
        headline: !monitorEnabled
          ? "异常监控关闭"
          : callbackUrl
            ? "监控回传已就绪"
            : "缺少 Webhook 地址",
        detail: `白名单 ${whitelistCount} / 黑名单 ${blacklistCount}`,
      };

      const rules = safeJsonParse<any[]>(
        window.localStorage.getItem("mria_xhr_rules"),
        [],
      );
      const xhrWhitelist = safeJsonParse<string[]>(
        window.localStorage.getItem("mria_xhr_whitelist"),
        [],
      );
      const enabledRules = rules.filter(
        (rule) => rule?.enabled !== false,
      ).length;
      next["top-left"] = {
        status:
          enabledRules > 0 ? StarshipStatus.Online : StarshipStatus.Standby,
        metric: `${enabledRules}/${rules.length}`,
        headline: enabledRules > 0 ? "拦截矩阵已部署" : "拦截矩阵空载",
        detail: `白名单 ${xhrWhitelist.length} 个域名入口`,
      };

      // @ts-ignore
      const platformLabel =
        navigator.userAgent || navigator.platform || "runtime";
      next["top-right"] = {
        status: navigator.onLine
          ? StarshipStatus.Online
          : StarshipStatus.Warning,
        metric: (navigator.language || "N/A").toUpperCase(),
        headline: navigator.onLine ? "页面遥测在线" : "浏览器离线",
        detail: `${platformLabel} / Cookie ${navigator.cookieEnabled ? "ON" : "OFF"}`,
      };

      const aiConfig = safeJsonParse<Record<string, string>>(
        window.localStorage.getItem("ai_assistant_config"),
        {},
      );
      const rawProvider =
        typeof aiConfig.provider === "string" ? aiConfig.provider.trim() : "";
      const customProvider =
        typeof aiConfig.customProvider === "string"
          ? aiConfig.customProvider.trim()
          : "";
      const aiProvider = rawProvider || customProvider || "deepseek";
      const aiModel =
        typeof aiConfig.modelId === "string" ? aiConfig.modelId.trim() : "";
      const aiApiKey =
        typeof aiConfig.apiKey === "string" ? aiConfig.apiKey.trim() : "";
      const aiApiBaseUrl =
        typeof aiConfig.apiBaseUrl === "string"
          ? aiConfig.apiBaseUrl.trim()
          : "";
      const standardProviders = ["openai", "anthropic", "google", "deepseek"];
      const isCustomProvider =
        aiProvider !== "deepseek" && !standardProviders.includes(aiProvider);
      const aiReady =
        aiProvider === "deepseek"
          ? true
          : Boolean(aiModel && aiApiKey && (!isCustomProvider || aiApiBaseUrl));
      const aiPartial = Boolean(
        rawProvider || customProvider || aiModel || aiApiKey || aiApiBaseUrl,
      );

      next["bottom-right"] = {
        status: aiReady
          ? StarshipStatus.Online
          : aiPartial
            ? StarshipStatus.Warning
            : StarshipStatus.Standby,
        metric: aiModel
          ? aiModel.slice(0, 8).toUpperCase()
          : aiReady
            ? aiProvider.slice(0, 8).toUpperCase()
            : "OFF",
        headline: aiReady
          ? "舰桥 AI 链路已挂接"
          : aiPartial
            ? "AI 链路参数未完整"
            : "等待绑定 AI 模型链路",
        detail: aiReady
          ? `${aiProvider.toUpperCase()} / ${aiModel || "DEEPSEEK-CHAT"}`
          : "填写 Provider、Model 与鉴权信息后即可启用",
      };
    } catch (error) {
      console.error("[PanelNav] Failed to load starship telemetry:", error);
    }

    setTelemetry(next);
  }, []);

  // 事件处理
  const handleStorageChange = useCallback(() => {
    loadTelemetry();
  }, [loadTelemetry]);

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (showTacticalOverview && event.key === "Escape") {
        setShowTacticalOverview(false);
        return;
      }

      // 输入框 / 文本域 / 下拉框内不劫持按键，避免输入数字时误跳面板
      if (isEditableTarget(event.target)) {
        return;
      }

      if (
        (event.key === "o" || event.key === "O") &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        return;
      }

      if (showTacticalOverview) {
        return;
      }

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveUp();
          return;
        case "ArrowDown":
          event.preventDefault();
          moveDown();
          return;
        case "ArrowLeft":
          event.preventDefault();
          moveLeft();
          return;
        case "ArrowRight":
          event.preventDefault();
          moveRight();
          return;
        default:
          break;
      }

      // 小键盘 1-9：直接跳到九宫格中对应的面板
      const numpadPosition = NUMPAD_PANEL_POSITIONS[event.key];
      if (numpadPosition) {
        event.preventDefault();
        focusPanel({ panelPos: numpadPosition });
      }
    },
    [
      showTacticalOverview,
      moveUp,
      moveDown,
      moveLeft,
      moveRight,
      focusPanel,
    ],
  );

  // 监听性能级别变化
  useEffect(() => {
    syncPerformanceMode();
  }, [performanceLevel, syncPerformanceMode]);

  // 键盘导航单独注册：handleKeydown 每次渲染都会重建，
  // 这样方向键才能拿到最新的 activePanel 做相对位移，而不是停留在初始面板。
  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [handleKeydown]);

  // 初始化和清理
  useEffect(() => {
    isCoarsePointerRef.current = window.matchMedia("(pointer: coarse)").matches;
    setShowNav(isLowPerformance || isCoarsePointerRef.current);

    syncPerformanceMode();
    window.addEventListener("resize", syncHudHeight);

    if (
      typeof chrome !== "undefined" &&
      chrome.storage?.onChanged?.addListener
    ) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    if (typeof ResizeObserver !== "undefined" && bridgeHudRef.current) {
      hudResizeObserverRef.current = new ResizeObserver(() => {
        syncHudHeight();
      });
      hudResizeObserverRef.current.observe(bridgeHudRef.current);
    }

    syncHudHeight();
    loadTelemetry();
    telemetryTimerRef.current = setInterval(() => {
      loadTelemetry();
    }, 15000);

    return () => {
      clearHideTimer();

      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }

      if (glitchTimerRef.current) {
        clearTimeout(glitchTimerRef.current);
        glitchTimerRef.current = null;
      }

      if (telemetryTimerRef.current) {
        clearInterval(telemetryTimerRef.current);
        telemetryTimerRef.current = null;
      }

      if (mouseFrameRef.current !== null) {
        clearMouseFrame();
      }

      detachPointerTracking();
      window.removeEventListener("resize", syncHudHeight);

      if (
        typeof chrome !== "undefined" &&
        chrome.storage?.onChanged?.removeListener
      ) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }

      if (hudResizeObserverRef.current) {
        hudResizeObserverRef.current.disconnect();
        hudResizeObserverRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 渲染过渡动画
  const overviewTransition = showTacticalOverview ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        opacity: showTacticalOverview ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      <Suspense fallback={null}>
        <TacticalOverview
          modules={moduleStates}
          activePanelKey={activePanelKey}
          onClose={() => setShowTacticalOverview(false)}
          onSelectPanel={(panelKey) => focusPanel({ panelKey })}
        />
      </Suspense>
    </div>
  ) : null;

  return (
    <div
      className="panel-nav-shell"
      style={{ position: "relative", minHeight: "100vh" }}
    >
      {overviewTransition}

      <div
        ref={siteWrapRef}
        className={`site-wrap ${showTacticalOverview ? "blur-active" : ""} ${
          isBridgeView ? "site-wrap--bridge" : "site-wrap--module"
        }`}
        style={layoutVars}
      >
        <div className="panel-stage">
          <div
            ref={panelWrapRef}
            className={`panel-wrap ${isAnimating ? "is-transitioning" : ""}`}
            style={panelWrapStyle}
          >
            {panelEntries.map(([key, panel]) => (
              <article
                key={key}
                className={`panel ${key === activePanelKey ? "is-active" : ""}`}
                style={getPanelStyle(panel)}
              >
                <div
                  className={`panel-content ${
                    key !== "main"
                      ? "panel-content--module"
                      : "panel-content--hero"
                  }`}
                >
                  {key === "main" && shouldRenderPanel(key) && (
                    <Suspense fallback={null}>{children}</Suspense>
                  )}

                  {key !== "main" && shouldRenderPanel(key) && (
                    <section
                      className={`module-shell ${
                        key === "downRight" ? "module-shell--ai" : ""
                      }`}
                      data-status={resolvePanelState(key).telemetry.status}
                    >
                      <header className="module-shell__header">
                        <div className="module-shell__title">
                          <span className="module-shell__eyebrow">
                            {resolvePanelState(key).glyph} /{" "}
                            {resolvePanelState(key).section}
                          </span>
                          <h3>{resolvePanelState(key).title}</h3>
                          <p>{resolvePanelState(key).description}</p>
                        </div>

                        <div className="module-shell__status">
                          <span>{resolvePanelState(key).code}</span>
                          <strong>
                            {statusText(
                              resolvePanelState(key).telemetry.status,
                            )}
                          </strong>
                          <span>{resolvePanelState(key).telemetry.metric}</span>
                        </div>
                      </header>

                      <div className="module-shell__body">
                        <Suspense fallback={null}>
                          {(() => {
                            const PanelPage = panel.page as ComponentType<any>;
                            return <PanelPage />;
                          })()}
                        </Suspense>
                      </div>
                    </section>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanelNavShell;
