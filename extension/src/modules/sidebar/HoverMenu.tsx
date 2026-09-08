/**
 * HoverMenu - 侧边悬浮菜单（React 版）
 *
 * 从 HoverMenu.vue 迁移而来。
 *
 * 关键变更：
 * - defineProps → React FC props
 * - ref → useRef
 * - emit('click') → props.onClick
 * - eventManager.useBus({ show, hide }) → bus.on('show'/'hide')
 *   注：原 Vue 代码传对象非 Map，实际未注册成功，React 版修正为正确注册
 * - eventManager.useListener('keydown', handler) → window.addEventListener('keydown')
 *   注：原 Vue 代码 target 传错（'keydown' 字符串），React 版修正为 window
 * - onMounted/onUnmounted → useEffect
 * - IconCommunity (?component) → Ant Design 图标（TeamOutlined）
 *
 * 保留的特性：
 * - dock 的 hover/active 状态切换动画
 * - miku-trigger 滑出动画
 * - 点击 trigger 切换 MikuChatWindow 显示
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { TeamOutlined } from "@ant-design/icons";
import type { Tool } from "@/types";
import { bus } from "@/event/bus";
import MikuChatWindow from "./MikuChatWindow";
import "./styles/hover-menu.scss";

/** HoverMenu Props */
export interface HoverMenuProps {
  /** 菜单项列表 */
  items: Tool[];
  /** 布局方向（保留接口，当前未使用） */
  layout?: "vertical" | "horizontal" | "fold";
  /** 是否可见 */
  visible?: boolean;
  /** 点击菜单项回调 */
  onClick?: (item: Tool) => void;
}

/** 彩虹色数组（与原 Vue 版保持一致） */
const RAINBOW_COLORS = [
  "#FF0000",
  "#FF7F00",
  "#FFFF00",
  "#00FF00",
  "#0000FF",
  "#4B0082",
  "#9400D3",
];

/** 根据索引获取彩虹色 */
const getRainbowColor = (index: number): string =>
  RAINBOW_COLORS[index % RAINBOW_COLORS.length];

/**
 * 侧边悬浮菜单组件
 * - 包含 Miku trigger 图片和 dock 菜单容器
 * - 点击 trigger 切换 MikuChatWindow 显示
 * - 监听 bus 的 show/hide 事件控制 dock 的 active 状态
 * - 监听 Ctrl+Q 快捷键切换 dock 的 hover 状态
 */
const HoverMenu: React.FC<HoverMenuProps> = ({
  items,
  visible: initialVisible = true,
  onClick,
}) => {
  // 控制 dock 的 active 状态（用于触发 dock-cell 滑出动画）
  const [isActive, setIsActive] = useState(false);
  // Miku trigger 是否可见
  const [mikuTriggerVisible, setMikuTriggerVisible] = useState(false);
  // Miku 对话窗口是否可见
  const [mikuChatVisible, setMikuChatVisible] = useState(false);
  // 当前 hover 的菜单项索引（保留状态，用于未来扩展）
  const [hoverIdx, setHoverIdx] = useState(-1);

  const dockRef = useRef<HTMLDivElement>(null);

  // Miku 图片资源
  const mikuSrc = chrome.runtime.getURL("static/imgs/miku.png");

  // 显示整个菜单
  const show = useCallback(() => {
    dockRef.current?.classList.add("active");
    setIsActive(true);
  }, []);

  // 隐藏整个菜单
  const hide = useCallback(() => {
    dockRef.current?.classList.remove("active");
    setIsActive(false);
  }, []);

  // 切换 Miku 对话窗口
  const toggleMikuChat = useCallback(() => {
    setMikuTriggerVisible((prev) => !prev);
    setMikuChatVisible((prev) => !prev);
  }, []);

  // 鼠标进入菜单项
  const onMouseEnter = useCallback((index: number) => {
    setHoverIdx(index);
  }, []);

  // 鼠标离开菜单项
  const onMouseLeave = useCallback(() => {
    setHoverIdx(-1);
  }, []);

  // 点击菜单项
  const onClickItem = useCallback(
    (index: number) => {
      const item = items[index];
      onClick?.(item);
    },
    [items, onClick],
  );

  // 注册 bus 事件 + keydown 监听
  useEffect(() => {
    bus.on("show", show);
    bus.on("hide", hide);

    // 处理 Ctrl+Q 快捷键：切换 dock 的 hover 状态
    const handleKeyDown = (event: KeyboardEvent) => {
      maLogger.log("Key pressed:", event.key, "ctrlKey:", event.ctrlKey);
      if (event.ctrlKey && event.key.toLowerCase() === "q") {
        event.preventDefault();
        dockRef.current?.classList.toggle("hover");
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      bus.off("show", show);
      bus.off("hide", hide);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [show, hide]);

  // 模拟 Vue onMounted：先显示 trigger，100ms 后 show，500ms 后 hide
  useEffect(() => {
    setMikuTriggerVisible(true);

    const showTimer = window.setTimeout(() => {
      show();
    }, 100);

    const hideTimer = window.setTimeout(() => {
      hide();
    }, 500);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [show, hide]);

  return (
    <>
      <div
        ref={dockRef}
        className={`dock ${isActive ? "active" : ""}`}
        style={{ position: "fixed", right: 0, top: "50%" }}
      >
        {mikuTriggerVisible && (
          <div
            className="miku-trigger"
            aria-label="打开 Miku 对话"
            style={{
              position: "absolute",
              right: "-84px",
              width: "126px",
              height: "auto",
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleMikuChat();
            }}
          >
            <img
              src={mikuSrc}
              alt="Miku trigger"
              aria-hidden="true"
              width="100%"
            />
          </div>
        )}

        {/* 菜单项列表（保留原 Vue 模板注释中的结构） */}
        {items.map((it, i) => (
          <li
            key={it.id}
            className="dock-cell"
            onMouseEnter={() => onMouseEnter(i)}
            onMouseLeave={onMouseLeave}
            onClick={() => onClickItem(i)}
            style={{ ["--delay" as string]: `${i * 0.12}s` }}
          >
            <div
              className={`dock-icon ${hoverIdx === i ? "hover" : ""}`}
              style={{ ["--c" as string]: it.color || getRainbowColor(i) }}
            >
              <TeamOutlined className="ic" />
            </div>
            {hoverIdx === i && it.label && (
              <div className="tip">{it.label}</div>
            )}
          </li>
        ))}
      </div>

      {mikuChatVisible && <MikuChatWindow onClose={toggleMikuChat} />}
    </>
  );
};

export default HoverMenu;
