import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import PageInfo from "./views/PageInfo";
// import CoreFeatures from './views/CoreFeatures';
// import TextOperations from './views/TextOperations';
// import DeveloperTools from './views/DeveloperTools';
// import About from './views/About';
// import HiddenPathScanner from './views/HiddenPathScanner';
// import AutomationPanel from './views/AutomationPanel';
import "./styles/app.scss";
import AutomationPanel from "./views/AutomationPanel";

// 导航选项卡定义
interface Tab {
  id: string;
  name: string;
}

// Toast类型定义
type ToastType = "success" | "error" | "info";

const App: React.FC = () => {
  // 导航选项卡列表
  const tabs: Tab[] = useMemo(
    () => [
      { id: "automation", name: "网页自动化" },
      { id: "other-features", name: "功能面板" },
      { id: "path-scanner", name: "路径扫描" },
    ],
    [],
  );

  // 当前选中的选项卡
  const [currentTab, setCurrentTab] = useState<string>("automation");

  // 格式化时间
  const [currentTime, setCurrentTime] = useState<string>(
    new Date().toLocaleTimeString(),
  );

  // 引用DOM元素
  const statusBarRef = useRef<HTMLDivElement | null>(null);
  const navTabsScrollRef = useRef<HTMLDivElement | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const scrollAnimationIdRef = useRef<number | null>(null);
  const targetScrollPosRef = useRef<number>(0);

  // 获取标签页图标
  const getTabIcon = useCallback((tabId: string): string => {
    const icons: Record<string, string> = {
      automation: "🤖",
      "other-features": "⚙️",
      "path-scanner": "🔐",
      "xhr-patch": "🔧",
    };
    return icons[tabId] || "📄";
  }, []);

  /**
   * 处理选项卡点击
   */
  const handleTabClick = useCallback(
    (tabId: string): void => {
      setCurrentTab(tabId);
      const tabName = tabs.find((tab) => tab.id === tabId)?.name || "";
      //   showToast(`已切换到 ${tabName}`, "success");
    },
    [tabs],
  );

  /**
   * 平滑滚动动画函数
   */
  const smoothScroll = useCallback(() => {
    if (!navTabsScrollRef.current) return;

    const diff =
      targetScrollPosRef.current - navTabsScrollRef.current.scrollLeft;

    // 如果差值很小，直接设置目标位置并停止动画
    if (Math.abs(diff) < 1) {
      navTabsScrollRef.current.scrollLeft = targetScrollPosRef.current;
      if (scrollAnimationIdRef.current) {
        cancelAnimationFrame(scrollAnimationIdRef.current);
        scrollAnimationIdRef.current = null;
      }
      return;
    }

    // 应用缓动算法
    const easeFactor = 0.3;
    navTabsScrollRef.current.scrollLeft += diff * easeFactor;

    // 继续下一帧动画
    scrollAnimationIdRef.current = requestAnimationFrame(smoothScroll);
  }, []);

  /**
   * 处理鼠标滚轮事件
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!navTabsScrollRef.current) return;

      // 只有当按下Shift键或者没有垂直滚动条时才进行横向滚动
      if (
        event.shiftKey ||
        navTabsScrollRef.current.scrollHeight <=
          navTabsScrollRef.current.clientHeight
      ) {
        event.preventDefault();

        // 计算新的目标位置
        targetScrollPosRef.current =
          navTabsScrollRef.current.scrollLeft + event.deltaY * 0.4;

        // 确保目标位置在有效范围内
        targetScrollPosRef.current = Math.max(
          0,
          Math.min(
            targetScrollPosRef.current,
            navTabsScrollRef.current.scrollWidth -
              navTabsScrollRef.current.clientWidth,
          ),
        );

        // 如果没有正在运行的动画，启动一个
        if (!scrollAnimationIdRef.current) {
          smoothScroll();
        }
      }
    },
    [smoothScroll],
  );

  // 组件挂载时的初始化
  useEffect(() => {
    // 更新时间显示
    timeUpdateIntervalRef.current = window.setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    // 监听来自 Chrome 扩展的消息
    const handleMessage = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void,
    ): boolean | null => {
      if (message.action === "UPDATE_STATUS" && statusBarRef.current) {
        const statusCenter = statusBarRef.current.querySelector(
          ".status-center span",
        );
        if (statusCenter) {
          statusCenter.textContent = message.text;
        }
        sendResponse({ success: true });
      } else if (message.action === "SHOW_TOAST") {
        sendResponse({ success: true });
      }
      return true; // 保持消息通道开放以便异步响应
    };

    chrome?.runtime?.onMessage.addListener(handleMessage);

    // 添加鼠标滚轮横向滚动支持
    if (navTabsScrollRef.current) {
      navTabsScrollRef.current.addEventListener("wheel", handleWheel, {
        passive: false,
      });
    }

    // 清理函数
    return () => {
      // 清除定时器
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }

      // 清除滚动动画
      if (scrollAnimationIdRef.current) {
        cancelAnimationFrame(scrollAnimationIdRef.current);
      }

      // 移除事件监听器
      if (navTabsScrollRef.current) {
        navTabsScrollRef.current.removeEventListener("wheel", handleWheel);
      }

      // 移除消息监听器
      chrome?.runtime?.onMessage.removeListener(handleMessage);
    };
  }, [handleWheel]);

  // 渲染当前面板内容
  const renderPanel = useCallback(() => {
    switch (currentTab) {
      case "automation":
        return (
          <div className="automation-container fade-in">
            <AutomationPanel />
          </div>
        );
      case "other-features":
        return (
          <div className="features-container">
            <div className="feature-cards fade-in">
              <div className="feature-card">
                <PageInfo />
              </div>
              <div className="feature-card">{/* <CoreFeatures /> */}</div>
              <div className="feature-card">{/* <TextOperations /> */}</div>
              <div className="feature-card">{/* <DeveloperTools /> */}</div>
              <div className="feature-card">{/* <About /> */}</div>
            </div>
          </div>
        );
      case "path-scanner":
        return (
          <div className="path-scanner-container fade-in">
            {/* <HiddenPathScanner /> */}
          </div>
        );
      default:
        return (
          <div className="automation-container fade-in">
            {/* <AutomationPanel /> */}
          </div>
        );
    }
  }, [currentTab]);

  return (
    <div className="app-container">
      {/* 顶部导航栏 */}
      <nav className="navigation">
        <div ref={navTabsScrollRef} className="nav-tabs-scroll">
          <div className="nav-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${currentTab === tab.id ? "active" : ""}`}
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.id === "automation" ? (
                  <span
                    className="tab-icon automation-tab-icon"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="tab-icon">{getTabIcon(tab.id)}</span>
                )}
                <span className="tab-label">{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <main className="main-content">{renderPanel()}</main>

      {/* 状态栏 */}
      <div ref={statusBarRef} className="status-bar">
        <div className="status-left">
          <span>MRIA Extension v1.0.0</span>
        </div>
        <div className="status-center">
          <div className="status-dot"></div>
          <span>系统状态正常</span>
        </div>
        <div className="status-right">
          <span>{currentTime}</span>
        </div>
      </div>
    </div>
  );
};

export default App;
