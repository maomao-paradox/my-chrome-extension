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

import GlowingArrow from "@icons/GlowingArrow";
import Static404 from "@/assets/components/Static404";

// 类型定义
import {
  buildDefaultTelemetry,
  STARSHIP_MODULES,
  STARSHIP_STATUS_TEXT,
  type ModuleTelemetry,
  type StarshipModuleMeta,
  type StarshipModuleState,
  type StarshipPanelId,
  type StarshipStatus,
} from "@/pages/options/views/starshipModules";
import {
  normalizeOptionsPerformanceLevel,
  useOptionsPerformance,
} from "@/pages/options/composables/useOptionsPerformance";

export interface PanelNavs {
  top: boolean;
  "top-right": boolean;
  "top-left": boolean;
  left: boolean;
  right: boolean;
  "bottom-right": boolean;
  "bottom-left": boolean;
  bottom: boolean;
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

export const DIRECTION_OFFSETS: Record<
  keyof PanelNavs,
  { x: number; y: number }
> = {
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
  shipModules: Record<string, Panel>;
}

const PanelNavShell: React.FC<PanelNavShellProps> = ({
  visible,
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
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [showTacticalOverview, setShowTacticalOverview] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
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

  const activePanelKey = useMemo(() => {
    return (
      panelEntries.find(
        ([, panel]) => panel.xPos === -posX && panel.yPos === posY,
      )?.[0] || "main"
    );
  }, [panelEntries, posX, posY]);

  const isBridgeView = useMemo(
    () => activePanelKey === "main",
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
        warningCount > 0 ? "warning" : standbyCount > 0 ? "standby" : "online",
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

  const panelWrapStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate3d(${posX * 100}%, ${posY * 100}%, 0)`,
    }),
    [posX, posY],
  );

  const getPanelStyle = useCallback(
    (panel: Panel): CSSProperties =>
      ({
        "--panel-x": `${panel.xPos * 100}%`,
        "--panel-y": `${panel.yPos * -100}%`,
      }) as CSSProperties,
    [],
  );

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
      setGlitchActive(false);
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

  const pulseGlitch = useCallback(() => {
    if (!isHighPerformance) {
      setGlitchActive(false);
      if (glitchTimerRef.current) {
        clearTimeout(glitchTimerRef.current);
        glitchTimerRef.current = null;
      }
      return;
    }

    setGlitchActive(false);

    if (glitchTimerRef.current) {
      clearTimeout(glitchTimerRef.current);
    }

    requestAnimationFrame(() => {
      setGlitchActive(true);
      glitchTimerRef.current = setTimeout(() => {
        setGlitchActive(false);
        glitchTimerRef.current = null;
      }, 140);
    });
  }, [isHighPerformance]);

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
    (panelKey: string) => {
      const panel = panels[panelKey];
      if (!panel) {
        return;
      }

      setPosX(-panel.xPos);
      setPosY(panel.yPos);
      rememberPanel(panelKey);
      triggerAnimation();
      pulseGlitch();
      setShowTacticalOverview(false);
    },
    [panels, rememberPanel, triggerAnimation, pulseGlitch],
  );

  const navigate = useCallback(
    (direction: keyof PanelNavs) => {
      if (!activePanel) return;

      const offset = DIRECTION_OFFSETS[direction];
      if (!offset) return;

      const targetKey = panelEntries.find(
        ([, candidate]) =>
          candidate.xPos === activePanel.xPos + offset.x &&
          candidate.yPos === activePanel.yPos + offset.y,
      )?.[0];

      if (targetKey) {
        focusPanel(targetKey);
      }
    },
    [activePanel, panelEntries, focusPanel],
  );

  const moveUp = useCallback(() => navigate("top"), [navigate]);
  const moveUpRight = useCallback(() => navigate("top-right"), [navigate]);
  const moveUpLeft = useCallback(() => navigate("top-left"), [navigate]);
  const moveLeft = useCallback(() => navigate("left"), [navigate]);
  const moveRight = useCallback(() => navigate("right"), [navigate]);
  const moveDown = useCallback(() => navigate("bottom"), [navigate]);
  const moveDownRight = useCallback(() => navigate("bottom-right"), [navigate]);
  const moveDownLeft = useCallback(() => navigate("bottom-left"), [navigate]);

  const openTacticalOverview = useCallback(() => {
    pulseGlitch();
    setShowTacticalOverview(true);
  }, [pulseGlitch]);

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
        status: debugMode ? "warning" : "online",
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
            ? "standby"
            : enabledUsers === totalUsers
              ? "online"
              : "warning",
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
        status: enabledRoutes > 0 ? "online" : "standby",
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
            ? "standby"
            : masteredNodes > 0
              ? "online"
              : "standby",
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
          ? "standby"
          : callbackUrl
            ? "online"
            : "warning",
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
        status: enabledRules > 0 ? "online" : "standby",
        metric: `${enabledRules}/${rules.length}`,
        headline: enabledRules > 0 ? "拦截矩阵已部署" : "拦截矩阵空载",
        detail: `白名单 ${xhrWhitelist.length} 个域名入口`,
      };

      // @ts-ignore
      const platformLabel =
        navigator.userAgentData?.platform || navigator.platform || "runtime";
      next["top-right"] = {
        status: navigator.onLine ? "online" : "warning",
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
        status: aiReady ? "online" : aiPartial ? "warning" : "standby",
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

      if (
        (event.key === "o" || event.key === "O") &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        openTacticalOverview();
        return;
      }

      if (showTacticalOverview) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveUp();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveDown();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveLeft();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveRight();
      }
    },
    [
      showTacticalOverview,
      openTacticalOverview,
      moveUp,
      moveDown,
      moveLeft,
      moveRight,
    ],
  );

  // 监听性能级别变化
  useEffect(() => {
    syncPerformanceMode();
  }, [performanceLevel, syncPerformanceMode]);

  // 初始化和清理
  useEffect(() => {
    isCoarsePointerRef.current = window.matchMedia("(pointer: coarse)").matches;
    setShowNav(isLowPerformance || isCoarsePointerRef.current);

    syncPerformanceMode();
    window.addEventListener("keydown", handleKeydown);
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
      window.removeEventListener("keydown", handleKeydown);
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
        {/* <TacticalOverview
          modules={moduleStates}
          activePanelKey={activePanelKey}
          onClose={() => setShowTacticalOverview(false)}
          onSelectPanel={focusPanel}
        /> */}
        <Static404 />
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
        {/* 扫描线效果 */}
        <div className="screen-scanlines"></div>

        {/* 故障效果 */}
        <div
          className={`screen-glitch ${glitchActive ? "screen-glitch--active" : ""}`}
        ></div>

        <div className="panel-stage">
          {/* 导航箭头 */}
          {showNav && (
            <nav className="edge-nav">
              <GlowingArrow
                aria-label="向上"
                direction="top"
                size="36px"
                color="#FFFFFF"
                className="nav-arrow panel__nav--top panel__nav"
                onClick={moveUp}
              />
              <GlowingArrow
                aria-label="右上"
                direction="right-top"
                size="36px"
                color="#FFFFFF"
                className="nav-arrow panel__nav--right-top panel__nav"
                onClick={moveUpRight}
              />
              <GlowingArrow
                aria-label="向右"
                direction="right"
                size="36px"
                color="#FFFFFF"
                className="nav-arrow panel__nav--right panel__nav"
                onClick={moveRight}
              />
              <GlowingArrow
                aria-label="右下"
                direction="right-bottom"
                size="36px"
                color="#FFFFFF"
                className="nav-arrow panel__nav--right-bottom panel__nav"
                onClick={moveDownRight}
              />
              <GlowingArrow
                aria-label="向下"
                direction="bottom"
                size="36px"
                color="#FFFFFF"
                className="nav-arrow panel__nav--bottom panel__nav"
                onClick={moveDown}
              />
              <GlowingArrow
                aria-label="左下"
                direction="left-bottom"
                size="36px"
                color="#FFFFFF"
                className="nav-arrow panel__nav--left-bottom panel__nav"
                onClick={moveDownLeft}
              />
              <GlowingArrow
                aria-label="向左"
                direction="left"
                size="36px"
                color="#FFFFFF"
                className="nav-arrow panel__nav--left panel__nav"
                onClick={moveLeft}
              />
              <GlowingArrow
                aria-label="左上"
                direction="left-top"
                size="36px"
                color="#FFFFFF"
                className="nav-arrow panel__nav--left-top panel__nav"
                onClick={moveUpLeft}
              />
            </nav>
          )}

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
                    key !== "main" ? "panel-content--module" : ""
                  }`}
                >
                  {key === "main" && shouldRenderPanel(key) && (
                    <Suspense fallback={null}>
                      <panel.page
                        modules={moduleStates}
                        activePanelKey={activePanelKey}
                        onOpenOverview={openTacticalOverview}
                        onNavigatePanel={focusPanel}
                      />
                    </Suspense>
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
                          <h1>{resolvePanelState(key).title}</h1>
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

                        <div className="module-shell__actions">
                          <button
                            type="button"
                            className="module-shell__btn"
                            onClick={() => focusPanel("main")}
                          >
                            返回指挥中心
                          </button>
                          <button
                            type="button"
                            className="module-shell__btn module-shell__btn--accent"
                            onClick={openTacticalOverview}
                          >
                            总览
                          </button>
                        </div>
                      </header>

                      <div className="module-shell__body">
                        <Suspense fallback={null}>
                          <panel.page />
                        </Suspense>
                      </div>
                    </section>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* 底部状态栏 */}
        <footer
          className={`bridge-footer ${!isBridgeView ? "bridge-footer--module" : ""}`}
        >
          {isBridgeView ? (
            <>
              <span>EDGE NAV ACTIVE</span>
              <span>
                {activeModuleState.code} / {activeModuleState.section}
              </span>
              <span>模块 {moduleStates.length - 1} 个</span>
              <span>`O` 打开总览</span>
            </>
          ) : (
            <>
              <span>
                {activeModuleState.code} / {activeModuleState.section}
              </span>
              <span>{activeModuleState.telemetry.headline}</span>
              <span>`O` 总览</span>
              <span>返回指挥中心可用</span>
            </>
          )}
        </footer>
      </div>

      {/* 样式 */}
      <style>{`
        .panel-nav-shell {
          position: relative;
          min-height: 100vh;
        }

        .site-wrap {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background:
            radial-gradient(circle at top, rgba(54, 92, 166, 0.24), transparent 35%),
            radial-gradient(circle at 20% 25%, rgba(26, 214, 214, 0.08), transparent 22%),
            linear-gradient(180deg, #040812 0%, #07111f 45%, #03060d 100%);
        }

        .site-wrap--module {
          background:
            radial-gradient(circle at top right, rgba(53, 114, 184, 0.14), transparent 28%),
            radial-gradient(circle at 18% 16%, rgba(44, 210, 198, 0.05), transparent 20%),
            linear-gradient(180deg, #08111d 0%, #0b1421 48%, #050a12 100%);
        }

        .site-wrap::before,
        .site-wrap::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .site-wrap::before {
          background-image:
            radial-gradient(circle at 12% 18%, rgba(122, 247, 208, 0.7) 0 1px, transparent 1.5px),
            radial-gradient(circle at 32% 64%, rgba(255, 255, 255, 0.6) 0 1.2px, transparent 1.8px),
            radial-gradient(circle at 84% 34%, rgba(122, 198, 255, 0.7) 0 1px, transparent 1.5px),
            radial-gradient(circle at 74% 78%, rgba(255, 179, 71, 0.55) 0 1px, transparent 1.8px);
          opacity: 0.8;
        }

        .site-wrap::after {
          background:
            linear-gradient(transparent 96%, rgba(76, 157, 214, 0.06) 100%),
            linear-gradient(90deg, transparent 96%, rgba(76, 157, 214, 0.05) 100%);
          background-size: 100% 28px, 28px 100%;
          mix-blend-mode: screen;
          opacity: 0.18;
        }

        .screen-scanlines,
        .screen-glitch {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 12;
        }

        .screen-scanlines {
          opacity: 0.13;
          background: repeating-linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.02) 0 1px,
            transparent 1px 4px
          );
          mix-blend-mode: screen;
        }

        .site-wrap--module .screen-scanlines {
          opacity: 0.08;
        }

        .screen-glitch {
          opacity: 0;
        }

        .screen-glitch--active {
          animation: bridge-glitch 0.14s steps(2, end);
        }

        .site-wrap.blur-active {
          filter: blur(8px);
          pointer-events: none;
          user-select: none;
        }

        .panel-stage {
          position: absolute;
          inset: 0;
        }

        .panel-wrap {
          position: absolute;
          inset: 0;
          transition: transform 0.55s cubic-bezier(0.55, 0, 0.1, 1);
          will-change: transform;
        }

        .panel-wrap.is-transitioning {
          filter: drop-shadow(0 0 22px rgba(39, 165, 255, 0.16));
        }

        .panel {
          position: absolute;
          inset: 0;
          width: 100vw;
          height: 100vh;
          transform: translate3d(var(--panel-x), var(--panel-y), 0);
          background: transparent;
        }

        .panel.is-active {
          z-index: 2;
        }

        .panel-content {
          height: 100%;
          padding: 46px;
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-width: none;
        }

        .panel-content::-webkit-scrollbar {
          display: none;
        }

        .panel-content--module {
          min-height: 100%;
        }

        .module-shell {
          height: 100%;
          padding-bottom: 20px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid rgba(86, 170, 235, 0.16);
          border-radius: 28px;
          background:
            linear-gradient(180deg, rgba(7, 16, 29, 0.94), rgba(4, 10, 18, 0.9)),
            radial-gradient(circle at top right, rgba(60, 146, 255, 0.08), transparent 42%);
          box-shadow:
            0 18px 60px rgba(0, 0, 0, 0.32),
            0 0 28px rgba(68, 165, 255, 0.06),
            inset 0 1px 0 rgba(183, 231, 255, 0.05);
        }

        .module-shell--ai {
          height: auto;
          min-height: 100%;
        }

        .module-shell[data-status='online'] {
          border-color: rgba(105, 183, 255, 0.2);
        }

        .module-shell[data-status='warning'] {
          border-color: rgba(255, 179, 71, 0.24);
        }

        .module-shell[data-status='standby'] {
          border-color: rgba(122, 247, 208, 0.18);
        }

        .module-shell__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 16px;
        }

        .module-shell__title {
          min-width: 0;
        }

        .module-shell__eyebrow,
        .module-shell__status span,
        .module-shell__status strong,
        .module-shell__btn {
          font-family: 'JetBrains Mono', 'Consolas', monospace;
          letter-spacing: 0.12em;
        }

        .module-shell__eyebrow {
          display: block;
          margin-bottom: 10px;
          font-size: 10px;
          text-transform: uppercase;
          color: rgba(137, 205, 241, 0.76);
        }

        .module-shell__title h1 {
          margin: 0 0 10px;
          font-size: 32px;
          line-height: 1.05;
          color: #f2fbff;
        }

        .module-shell__title p {
          margin: 0;
          max-width: 780px;
          color: rgba(197, 225, 241, 0.8);
          line-height: 1.6;
        }

        .module-shell__actions {
          display: flex;
          gap: 10px;
        }

        .module-shell__btn {
          border: 1px solid rgba(94, 177, 237, 0.18);
          border-radius: 14px;
          padding: 10px 14px;
          background: rgba(5, 14, 24, 0.7);
          color: #def7ff;
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
          cursor: pointer;
        }

        .module-shell__btn:hover {
          transform: translateY(-1px);
          border-color: rgba(122, 247, 208, 0.34);
          box-shadow: 0 0 18px rgba(122, 247, 208, 0.08);
        }

        .module-shell__btn--accent {
          background: linear-gradient(135deg, rgba(61, 129, 255, 0.64), rgba(56, 204, 214, 0.24));
          border-color: rgba(118, 220, 255, 0.3);
        }

        .module-shell__status {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          margin-top: 50px;
          padding: 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(94, 177, 237, 0.14);
          background: rgba(4, 11, 21, 0.72);
          color: rgba(163, 216, 243, 0.8);
        }

        .module-shell__status strong {
          color: #f3fbff;
          font-size: 12px;
        }

        .module-shell__status span {
          font-size: 11px;
        }

        .module-shell__status span:last-child {
          margin-left: auto;
        }

        .module-shell__body {
          position: relative;
        }

        .edge-nav {
          position: absolute;
          inset: 0;
          z-index: 35;
          pointer-events: none;
          justify-content: center;
          display: flex;
        }

        .panel__nav {
          position: absolute;
          border: 0;
          background: transparent;
          opacity: 0.3;
          transition: opacity 0.25s ease, transform 0.25s ease;
          pointer-events: auto;
          cursor: pointer;
        }

        .panel__nav:hover {
          opacity: 1;
        }

        .panel__nav--top {
          top: 10px;
          left: 50%;
        }

        .panel__nav--left {
          left: 12px;
          top: 50%;
        }

        .panel__nav--left-top {
          left: 12px;
          top: 10px;
        }

        .panel__nav--left-bottom {
          left: 12px;
          bottom: 56px;
        }

        .panel__nav--right {
          right: 12px;
          top: 50%;
        }

        .panel__nav--right-top {
          right: 12px;
          top: 10px;
        }

        .panel__nav--right-bottom {
          right: 12px;
          bottom: 56px;
        }

        .panel__nav--bottom {
          left: 50%;
          bottom: 56px;
        }

        .nav-arrow {
          display: block;
          filter:
            drop-shadow(0 0 12px rgba(120, 215, 255, 0.8))
            drop-shadow(0 0 24px rgba(120, 215, 255, 0.45));
        }

        .panel__nav:hover .nav-arrow {
          transform: scale(1.08);
        }

        .bridge-footer {
          position: absolute;
          left: 22px;
          right: 22px;
          bottom: 14px;
          z-index: 25;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 11px;
          color: rgba(151, 207, 240, 0.8);
          border: 1px solid rgba(82, 177, 255, 0.22);
          background: linear-gradient(180deg, rgba(4, 14, 26, 0.88), rgba(2, 8, 18, 0.68));
          box-shadow:
            0 14px 50px rgba(0, 0, 0, 0.35),
            inset 0 1px 0 rgba(159, 220, 255, 0.08);
          backdrop-filter: blur(16px);
          font-family: 'JetBrains Mono', 'Consolas', monospace;
          letter-spacing: 0.12em;
        }

        .bridge-footer--module {
          justify-content: flex-start;
          background: rgba(4, 12, 22, 0.76);
        }

        @keyframes bridge-glitch {
          0% {
            opacity: 0;
            transform: translateX(0);
            filter: hue-rotate(0deg);
          }

          20% {
            opacity: 0.22;
            transform: translateX(-6px);
            background:
              linear-gradient(90deg, rgba(255, 0, 84, 0.12), transparent 26%),
              linear-gradient(180deg, transparent 68%, rgba(105, 183, 255, 0.16) 100%);
            filter: hue-rotate(12deg);
          }

          60% {
            opacity: 0.14;
            transform: translateX(4px);
            background:
              linear-gradient(90deg, transparent 30%, rgba(0, 255, 209, 0.12) 55%, transparent 100%);
          }

          100% {
            opacity: 0;
            transform: translateX(0);
            filter: hue-rotate(0deg);
          }
        }

        @media (max-width: 1100px) {
          .bridge-footer {
            flex-wrap: wrap;
          }

          .module-shell__header {
            flex-direction: column;
          }

          .module-shell__actions {
            width: 100%;
          }
        }

        @media (max-width: 768px) {
          .panel-content {
            padding: calc(var(--bridge-hud-height, 108px) + 16px) 12px 74px;
          }

          .bridge-footer {
            left: 12px;
            right: 12px;
            bottom: 10px;
          }

          .panel__nav--left,
          .panel__nav--left-top,
          .panel__nav--left-down {
            left: 2px;
          }

          .panel__nav--right,
          .panel__nav--right-top,
          .panel__nav--right-down {
            right: 2px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .panel-wrap,
          .panel__nav {
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PanelNavShell;
