/**
 * App.tsx - React 版悬浮球应用主组件
 * 从 Vue 版 App.vue 迁移而来
 *
 * 功能：
 * - 组合 FloatingBall + GlassCardOverlay + ControlPanel + ToolDrawer 四个子组件
 * - 通过 Zustand store 管理面板/抽屉的显隐状态
 * - 处理悬浮球点击行为（dialog / sidepanel）
 * - 监听 chrome.storage 配置变化
 *
 * 关键技术点：
 * - Zustand selector 订阅特定状态，避免组件无关状态变更触发重渲染
 * - 非组件代码（事件回调内）通过 getState() 获取最新状态，避免闭包陈旧
 * - GlassCardOverlay 关闭后通过 store.changeTool(null) 重置工具状态
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
import { getStaticAbstractPath } from "@/utils/common";
import type { Tool, PluginConfig, PluginConfigMap } from "@/types";
import { appConfigKey } from "@/config";
import { useFloatingballStore } from "@/stores/floatingball";
import FloatingBall from "./FloatingBall";
import GlassCardOverlay from "./GlassCardOverlay";
import ControlPanel from "./ControlPanel";
import ToolDrawer from "./ToolDrawer";

/** 抽屉方向（与 Element Plus direction 对齐）*/
type DrawerDirection = "rtl" | "ltr" | "ttb" | "btt";

interface AppProps {
  /** 悬浮球图标 URL */
  icon?: string;
  /** 工具列表 */
  tools?: Tool[];
  /** 菜单标题（无激活工具时的抽屉标题）*/
  menuTitle?: string;
  /** 抽屉方向 */
  drawerDirection?: DrawerDirection;
  /** Drawer 挂载容器（用于 shadow DOM 内挂载）*/
  drawerContainer?: HTMLElement | null;
}

/** 默认工具列表 */
const DEFAULT_TOOLS: Tool[] = [
  { id: "script", label: "执行脚本", icon: "Script" },
  {
    id: "spectrum",
    label: "光谱效应",
    icon: "BgColors",
    details: "预览棱镜、极光、光谱环和衍射薄膜等 CSS 视觉效果",
  },
];

/**
 * App - 悬浮球应用主组件
 */
const App: React.FC<AppProps> = ({
  icon,
  tools = DEFAULT_TOOLS,
  menuTitle = "小工具箱",
  drawerDirection = "rtl",
  drawerContainer,
}) => {
  // 通过 selector 订阅 store 状态（避免无关更新触发重渲染）
  const openDialog = useFloatingballStore((s) => s.openDialog);
  const openDrawer = useFloatingballStore((s) => s.openDrawer);
  const activeTool = useFloatingballStore((s) => s.activeTool);
  const isEnabled = useFloatingballStore((s) => s.isEnabled);

  // 毛玻璃卡片局部状态（不进 store，组件内部管理）
  const [glassCardVisible, setGlassCardVisible] = useState(false);

  // 用于保存最新的 store actions 引用，避免事件监听器闭包陈旧
  const storeActionsRef = useRef(useFloatingballStore.getState());
  storeActionsRef.current = useFloatingballStore.getState();

  /** 抽屉标题 */
  const drawerTitle = useMemo(
    () => (activeTool ? activeTool.label : (menuTitle ?? "未命名的工具")),
    [activeTool, menuTitle],
  );

  /** 悬浮球点击处理 */
  const handleFloatingBallClick = useCallback(() => {
    const store = storeActionsRef.current;
    if (!store.isEnabled) return;
    try {
      maLogger.log("clickBehavior:", store.clickBehavior);
      if (store.clickBehavior === "sidepanel") {
        // 调用 store 中的 toggleSidepanel 方法打开侧边栏
        store.toggleSidepanel(true);
      } else {
        // 默认显示弹窗
        store.toggle("dialog");
      }
    } catch (error) {
      maLogger.error("处理点击事件失败:", error);
    }
  }, []);

  /** 点击工具处理 */
  const handleClickTool = useCallback((tool: Tool) => {
    const store = storeActionsRef.current;
    // 毛玻璃卡片特殊处理
    if (tool.id === "glass-card") {
      setGlassCardVisible(true);
      store.changeTool(null);
      store.toggle("dialog", false);
      store.toggle("drawer", false);
      return;
    }

    store.changeTool(tool);
    store.toggle("dialog", false);
    store.toggle("drawer", true);
    maLogger.info("点击了工具：", tool.label);
  }, []);

  /** 关闭面板 */
  const handleClosePanel = useCallback(() => {
    const store = storeActionsRef.current;
    store.toggle("dialog", false);
    store.toggle("drawer", false);
  }, []);

  /** 关闭抽屉（关闭后延迟 100ms 重新打开面板）*/
  const handleCloseDrawer = useCallback(() => {
    const store = storeActionsRef.current;
    store.changeTool(null);
    store.toggle("drawer", false);
    // 延迟打开对话框，确保 DOM 更新完成
    window.setTimeout(() => {
      storeActionsRef.current.toggle("dialog", true);
    }, 100);
  }, []);

  /** 毛玻璃卡片关闭 */
  const handleGlassCardClose = useCallback(() => {
    setGlassCardVisible(false);
  }, []);

  /**
   * chrome.storage 配置变化监听器
   * 对应原 setupConfigListener
   */
  useEffect(() => {
    const setupConfigListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string,
    ) => {
      if (namespace === "local" && changes[appConfigKey]) {
        maLogger.log("应用配置变化:", changes[appConfigKey]);
        const newConfig = changes[appConfigKey].newValue as PluginConfigMap;
        if (newConfig && newConfig.floatingball) {
          const store = storeActionsRef.current;
          store.setEnabled(newConfig.floatingball.enabled !== false);
        }
      }
    };

    chrome.storage.onChanged.addListener(setupConfigListener);
    // 加载初始配置
    storeActionsRef.current.loadConfig();

    return () => {
      chrome.storage.onChanged.removeListener(setupConfigListener);
    };
  }, []);

  // Drawer getContainer 函数（memoize 避免每次渲染都创建新函数）
  const getDrawerContainer = useCallback(() => {
    return drawerContainer ?? undefined;
  }, [drawerContainer]);

  return (
    <>
      {/* 悬浮球 */}
      <FloatingBall
        icon={icon ?? getStaticAbstractPath("icons/floatingball.png")}
        onClick={handleFloatingBallClick}
      />

      {/* 悬浮毛玻璃卡片 */}
      <GlassCardOverlay
        visible={glassCardVisible}
        onClose={handleGlassCardClose}
      />

      {/* 控制面板 */}
      <ControlPanel
        tools={tools}
        title="控制面板"
        visible={openDialog}
        onClickTool={handleClickTool}
        onClose={handleClosePanel}
      />

      {/* 工具抽屉 */}
      <ToolDrawer
        useMask
        direction={drawerDirection}
        visible={openDrawer}
        activeTool={activeTool}
        title={drawerTitle}
        getContainer={getDrawerContainer}
        onClose={handleCloseDrawer}
      />
    </>
  );
};

App.displayName = "App";

export default App;
