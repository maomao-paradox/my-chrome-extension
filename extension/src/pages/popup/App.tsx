/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/App.tsx
 * @description React 版 Popup 主组件 - 包含 tab 导航和页面切换
 */
import React, { useState, useEffect } from "react";
import {
  SettingOutlined,
  CameraOutlined,
  PushpinOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import BookmarkPage from "./views/BookmarkPage";
import SettingPage from "./views/SettingPage";
import CapturePage from "./views/CapturePage";
import TOTPTokenPage from "./views/TOTPTokenPage";
import { useDomainState } from "./composables/useDomainState";
import { usePopupTheme } from "./composables/usePopupTheme";
import { usePopupMouseTrail } from "./composables/usePopupMouseTrail";
import "./styles/app.scss";

/**
 * Tab 配置项类型
 */
interface TabConfig {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  component: React.ComponentType;
}

/**
 * Tab 配置列表
 */
const TABS: TabConfig[] = [
  {
    key: "bookmarks",
    label: "笔记",
    hint: "管理片段笔记，快速回溯对应页面。",
    icon: <PushpinOutlined />,
    component: BookmarkPage,
  },
  // {
  //   key: "capture",
  //   label: "捕获",
  //   hint: "从当前页面拾取组件，结果同步到开发者工具。",
  //   icon: <CameraOutlined />,
  //   component: CapturePage,
  // },
  {
    key: "tokens",
    label: "令牌",
    hint: "查看后端生成的动态验证码。",
    icon: <ClockCircleOutlined />,
    component: TOTPTokenPage,
  },
  {
    key: "settings",
    label: "设置",
    hint: "管理内容脚本与插件默认打开方式。",
    icon: <SettingOutlined />,
    component: SettingPage,
  },
];

/**
 * Popup 应用主组件
 */
const App: React.FC = () => {
  const { isDomainDisabled, checkDomainStatus } = useDomainState();
  const { loadPopupTheme } = usePopupTheme();
  const { loadPopupMouseTrail } = usePopupMouseTrail();

  const [activeTab, setActiveTab] = useState<string>(TABS[0].key);

  /** 获取当前活动 Tab 配置 */
  const currentTab = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];
  const CurrentComponent = currentTab.component;

  /** 页面标题 */
  const popupTitle = chrome.i18n?.getMessage("popupTitle") ?? "POPUP测试页";

  /** 初始化加载 */
  useEffect(() => {
    const init = async () => {
      await loadPopupTheme();
      await loadPopupMouseTrail();
      checkDomainStatus();
    };
    init();
  }, [loadPopupTheme, loadPopupMouseTrail, checkDomainStatus]);

  return (
    <div className="popup-shell">
      <div className="popup-orb popup-orb--left"></div>
      <div className="popup-orb popup-orb--right"></div>

      <div className="popup-container">
        {/* 头部 */}
        <header className="popup-header">
          <div className="header-main">
            <div className="header-brand">
              <h1 className="logo">{popupTitle}</h1>
            </div>

            <div className="header-meta">
              <div
                className={`status-chip ${
                  isDomainDisabled ? "status-chip--off" : "status-chip--on"
                }`}
              >
                <span className="status-dot"></span>
                <span>{isDomainDisabled ? "停用" : "可用"}</span>
              </div>
              <span className="header-version">v1.0.0</span>
            </div>
          </div>
        </header>

        {/* Tab 导航 */}
        <nav
          className="tab-navigation"
          aria-label="Popup navigation"
          role="tablist"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.key}
              title={tab.label}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* 内容区 */}
        <main className="popup-content">
          <div key={activeTab} className="tab-content-enter">
            <CurrentComponent />
          </div>
        </main>

        {/* 底部 */}
        <footer className="popup-footer">
          <span className="footer-signal"></span>
          <span>{currentTab.hint}</span>
        </footer>
      </div>
    </div>
  );
};

export default App;
