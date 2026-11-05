import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import ImageDownload from "./views/ImageDownload";
import WebMcpPanel from "./views/WebMcpPanel";
import PageInfo from "./views/PageInfo";
// import CoreFeatures from './views/CoreFeatures';
// import TextOperations from './views/TextOperations';
// import DeveloperTools from './views/DeveloperTools';
// import About from './views/About';
// import HiddenPathScanner from './views/HiddenPathScanner';
import "./styles/app.scss";
import AutomationPanel from "./views/AutomationPanel";
import TableContainer from "../popup/layout/TableContainer";
import "../popup/layout/style.scss"; // 导入 TableContainer 的样式
import AIConversation, {
  type AIRole,
} from "@/modules/sidebar/components/AIConversation";
// 引入 AIConversation 真实对话组件的样式
import "@/modules/sidebar/styles/miku-chat-window.scss";

/** 侧边栏打开时暂存目标 tab 的 storage key */
const SIDEPANEL_TAB_STORAGE_KEY = "__sidepanel_target_tab__";
/** 默认 tab id */
const DEFAULT_TAB_ID = "automation";

/** Miku 角色系统提示词（与原 MikuChatWindow 保持一致） */
const MIKU_SYSTEM_PROMPT = [
  "你正在进行角色扮演：你是初音未来风格的虚拟歌姬 Miku，在一个安静、温暖的酒馆式对话窗口里和用户聊天。",
  "用中文为主回应，语气轻快、亲切、有一点舞台感，但不要过度卖萌，不要刷屏。",
  "你可以谈音乐、创作、日常陪伴、学习和编程想法；当用户需要严肃帮助时，保持清晰、实用、可靠。",
  "不要声称自己是真实人物或真人偶像；你是一个由 AI 模拟的角色。",
  "回答尽量自然，短句优先。需要步骤时用简洁列表。",
].join("\n");

/** Miku 角色选项 —— 默认使用主人实际使用的记忆命名空间 */
const MIKU_ROLES: AIRole[] = [
  {
    value: "vivy_catgirl",
    label: "Hatsune Miku",
    avatar: "MK",
    systemPrompt: MIKU_SYSTEM_PROMPT,
  },
];

// 导航选项卡定义
interface Tab {
  id: string;
  name: string;
  description: string;
}

// Toast类型定义
type ToastType = "success" | "error" | "info";

const App: React.FC = () => {
  // 导航选项卡列表
  const tabs: Tab[] = useMemo(
    () => [
      { id: "chat", name: "对话", description: "与 Miku 对话" },
      { id: "automation", name: "网页自动化", description: "自动化网页操作" },
      { id: "image-download", name: "图片下载", description: "下载网页图片" },
      { id: "web-mcp", name: "网页工具", description: "发现并执行页面工具" },
      { id: "other-features", name: "功能面板", description: "各种实用功能" },
      { id: "path-scanner", name: "路径扫描", description: "扫描网页路径" },
    ],
    [],
  );

  // 当前选中的选项卡（初始值稍后从 storage 读取覆盖）
  const [currentTab, setCurrentTab] = useState<string>(DEFAULT_TAB_ID);

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
      chat: "💬",
      automation: "🤖",
      "image-download": "🖼️",
      "web-mcp": "🔌",
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
    // 1. 从 storage 读取侧边栏打开时指定的目标 tab
    chrome.storage.local
      .get([SIDEPANEL_TAB_STORAGE_KEY])
      .then((result) => {
        const targetTabId = result[SIDEPANEL_TAB_STORAGE_KEY] as
          | string
          | undefined;
        // 校验目标 tab 是否在 tabs 列表中存在，否则使用默认值
        const isValidTab =
          typeof targetTabId === "string" &&
          tabs.some((tab) => tab.id === targetTabId);
        if (isValidTab) {
          setCurrentTab(targetTabId as string);
          maLogger.log("侧边栏启动，切换到目标 tab:", targetTabId);
        }
        // 读完即清，避免下次打开时残留
        chrome.storage.local.remove(SIDEPANEL_TAB_STORAGE_KEY);
      })
      .catch((err) => {
        maLogger.warn("读取侧边栏目标 tab 失败:", err);
      });

    // 2. 更新时间显示
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

  const activeTab =
    tabs.find((tab) => tab.id === currentTab) ||
    ({ id: "", name: "", description: "" } as Tab);

  // 渲染当前面板内容
  const renderPanel = useCallback(() => {
    switch (currentTab) {
      case "chat":
        return (
          <div className="chat-panel-container">
            <AIConversation
              className="miku-conversation"
              title="Miku"
              welcomeTitle="今晚想聊点什么？"
              welcomeMessage="这里是 Miku 的小酒馆席位。告诉她你的想法、歌词灵感、代码烦恼或日常碎碎念。"
              userIcon="YOU"
              aiIcon="MK"
              typingMessage="Miku 正在组织语言..."
              inputPlaceholder="和 Miku 说点什么..."
              sendButtonText="发送"
              inputHint="Enter 发送，Shift + Enter 换行。"
              defaultRole="vivy_catgirl"
              roleOptions={MIKU_ROLES}
            />
          </div>
        );
      case "automation":
        return <AutomationPanel />;
      case "image-download":
        return <ImageDownload />;
      case "web-mcp":
        return <WebMcpPanel />;
      case "other-features":
        return (
          <div className="features-container">
            <div className="feature-cards ">
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
          <div className="path-scanner-container ">
            {/* <HiddenPathScanner /> */}
          </div>
        );
      default:
        return (
          <div className="automation-container ">
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
      <main
        className={`main-content ${currentTab === "chat" ? "is-chat-mode" : ""}`}
      >
        <TableContainer
          density="compact"
          sectionGap="8px"
          contentGap="8px"
          heroGap="8px"
          rightMaxWidth="88px"
          headLeft={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                justifyContent: "center",
              }}
            >
              <p className="section-kicker">{currentTab}</p>
              <span className="section-divider">|</span>
              <h2 className="section-title">{activeTab.name}</h2>
              {/* <p className="section-subtitle">{activeTab.description}</p> */}
            </div>
          }
        >
          <div className="fade-in">{renderPanel()}</div>
        </TableContainer>
      </main>

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
