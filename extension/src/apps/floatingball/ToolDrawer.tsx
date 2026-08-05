/**
 * ToolDrawer.tsx - React 版工具抽屉 + 消息通知中心
 * 从 Vue 版 ToolDrawer.vue 迁移而来
 *
 * 功能：
 * 1. 右侧工具抽屉（antd Drawer）：根据 activeTool 渲染对应工具组件
 * 2. 右上角消息通知中心：Bell 按钮 + 未读数 Badge + 通知列表面板
 *
 * 关键技术点：
 * - antd Drawer 默认 portal 到 document.body，在 shadow DOM 内会样式失效
 *   → 通过 getContainer prop 挂载到 shadow root 内的容器
 * - Vue 的 v-model 双向绑定 → React 中通过 visible + onClose 回调控制
 * - Vue 的 <transition> → CSS animation（notification-pop keyframes）
 * - @click.outside 指令 → useEffect + document click 监听
 * - toolComponent 动态加载：通过 toolMap 查找，找不到则显示 Static404
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
import { Drawer, Button, Badge } from "antd";
import {
  BellOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import toolMap from "./views";
import { Static404 } from "@/assets/components/react-index";
import type { Tool } from "@/types/index.js";
import "./styles/tool-drawer.scss";

/** 通知消息类型 */
type NotificationType = "success" | "info" | "warning" | "error";

/** 通知消息结构 */
interface Notification {
  id?: number;
  title: string;
  message?: string;
  type: NotificationType;
  read: boolean;
  timestamp: Date;
}

/** 抽屉方向（Element Plus direction → antd placement 映射）*/
type DrawerDirection = "rtl" | "ltr" | "ttb" | "btt";

/** antd Drawer placement */
type DrawerPlacement = "right" | "left" | "top" | "bottom";

/** direction → placement 映射表 */
const DIRECTION_TO_PLACEMENT: Record<DrawerDirection, DrawerPlacement> = {
  rtl: "right",
  ltr: "left",
  ttb: "top",
  btt: "bottom",
};

interface ToolDrawerProps {
  /** 是否可见 */
  visible?: boolean;
  /** 抽屉标题（无 activeTool 时使用）*/
  title?: string;
  /** 抽屉方向 */
  direction?: DrawerDirection;
  /** 是否可调整大小（antd 不支持，保留字段）*/
  resizable?: boolean;
  /** 是否显示遮罩 */
  modal?: boolean;
  /** 点击遮罩是否关闭 */
  closeOnClickModal?: boolean;
  /** 自定义 class */
  customClass?: string;
  /** 遮罩层 class */
  overlayClass?: string;
  /** 是否使用遮罩（保留字段，与 modal 互补）*/
  useMask?: boolean;
  /** 当前激活的工具 */
  activeTool?: Tool | null;
  /** Drawer 挂载容器（用于 shadow DOM 内挂载）*/
  getContainer?: () => HTMLElement;
  /** 关闭抽屉回调 */
  onClose?: () => void;
}

/**
 * ToolDrawer - 工具抽屉 + 消息通知中心
 */
const ToolDrawer: React.FC<ToolDrawerProps> = ({
  visible = false,
  title = "",
  direction = "rtl",
  modal = true,
  closeOnClickModal = true,
  customClass = "",
  overlayClass = "",
  activeTool = null,
  getContainer,
  onClose,
}) => {
  // 消息通知状态
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationCenterRef = useRef<HTMLDivElement>(null);

  /** 未读消息数 */
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  /** 抽屉标题 */
  const drawerTitle = useMemo(
    () => (activeTool ? activeTool.label : title || "未命名的工具"),
    [activeTool, title]
  );

  /** 抽屉 class（合并 mria-tool-drawer 和自定义 class）*/
  const drawerClass = useMemo(
    () => ["mria-tool-drawer", customClass].filter(Boolean).join(" "),
    [customClass]
  );

  /** 遮罩 class */
  const overlayClassStr = useMemo(
    () => ["mria-tool-drawer-overlay", overlayClass].filter(Boolean).join(" "),
    [overlayClass]
  );

  /** 添加通知消息（作为工具组件的 onAddMessage 回调）*/
  const addNotification = useCallback(
    (opts: Partial<Notification> & { message: string; type?: NotificationType }) => {
      setNotifications((prev) => [
        {
          title: opts.title || opts.message || "通知",
          message: opts.message,
          type: opts.type || "info",
          read: false,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    },
    []
  );

  /** 标记单条已读 */
  const markAsRead = useCallback((idx: number) => {
    setNotifications((prev) =>
      prev.map((n, i) => (i === idx ? { ...n, read: true } : n))
    );
  }, []);

  /** 全部标记已读 */
  const clearAllNotifications = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  /** 格式化时间显示 */
  const formatTime = useCallback((date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleDateString();
  }, []);

  /** 根据类型渲染通知卡片图标 */
  const renderNotificationIcon = useCallback(
    (type: NotificationType) => {
      switch (type) {
        case "success":
          return <CheckCircleOutlined />;
        case "warning":
          return <WarningOutlined />;
        case "error":
          return <CloseCircleOutlined />;
        default:
          return <InfoCircleOutlined />;
      }
    },
    []
  );

  /** 工具点击处理（阻止冒泡，避免触发通知面板关闭）*/
  const handleBellClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowNotifications((prev) => !prev);
    },
    []
  );

  /** 点击外部关闭通知面板（对应 Vue 的 @click.outside）*/
  useEffect(() => {
    if (!showNotifications) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        notificationCenterRef.current &&
        !notificationCenterRef.current.contains(target)
      ) {
        setShowNotifications(false);
      }
    };

    // 延迟绑定，避免触发本次点击事件
    const timer = window.setTimeout(() => {
      document.addEventListener("click", handleDocumentClick, true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [showNotifications]);

  /** 渲染当前工具组件 */
  const renderToolComponent = useCallback(() => {
    if (!activeTool) {
      return <Static404 />;
    }
    const ToolComponent = toolMap[activeTool.id];
    if (!ToolComponent) {
      return <Static404 />;
    }
    return <ToolComponent onAddMessage={addNotification} />;
  }, [activeTool, addNotification]);

  /** antd Drawer placement */
  const placement = DIRECTION_TO_PLACEMENT[direction];

  return (
    <>
      {/* 右上角消息通知中心（仅抽屉可见时显示）*/}
      {visible && (
        <div ref={notificationCenterRef} className="notification-center">
          <Badge
            count={unreadCount}
            offset={[-2, 2]}
            color="#ef4444"
          >
            <Button
              shape="circle"
              size="large"
              className="notification-btn"
              icon={<BellOutlined />}
              onClick={handleBellClick}
            />
          </Badge>

          {showNotifications && (
            <div className="notification-panel is-open">
              <div className="notification-header">
                <span className="notification-title">消息中心</span>
                <Button
                  type="link"
                  size="small"
                  onClick={clearAllNotifications}
                >
                  全部已读
                </Button>
              </div>
              <div
                className={`notification-list${
                  notifications.length === 0 ? " notification-empty" : ""
                }`}
              >
                {notifications.length === 0 ? (
                  <div className="empty-state">
                    <CheckCircleOutlined />
                    <span>暂无新消息</span>
                  </div>
                ) : (
                  notifications.map((item, idx) => (
                    <div
                      key={idx}
                      className={`notification-card ${item.type}${
                        !item.read ? " is-unread" : ""
                      }`}
                      onClick={() => markAsRead(idx)}
                    >
                      <div className="card-icon">
                        {renderNotificationIcon(item.type)}
                      </div>
                      <div className="card-content">
                        <div className="card-title">{item.title}</div>
                        {item.message && (
                          <div className="card-desc">{item.message}</div>
                        )}
                        <div className="card-time">
                          {formatTime(item.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 工具抽屉 */}
      <Drawer
        open={visible}
        placement={placement}
        title={drawerTitle}
        mask={modal}
        closable
        keyboard
        getContainer={getContainer}
        className={drawerClass}
        rootClassName={overlayClassStr}
        maskClosable={closeOnClickModal}
        onClose={onClose}
      >
        <div className="drawer-content-wrapper">{renderToolComponent()}</div>
      </Drawer>
    </>
  );
};

ToolDrawer.displayName = "ToolDrawer";

export default ToolDrawer;
