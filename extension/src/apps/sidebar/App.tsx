/**
 * Sidebar 应用主组件（React 版）
 *
 * 从 App.vue 迁移而来。
 *
 * 关键变更：
 * - defineProps → React FC props
 * - ref → useState
 * - watch(props.tools) → useEffect 依赖 [props.tools]
 * - eventManager.useBus('update:sidebar:tools', cb) → bus.on('update:sidebar:tools', cb)
 * - MACarousel (Vue + Element Plus) → SimpleCarousel (原生 React 实现)
 * - IconCommunity (Vue ?component) → 字符串标识 'team'（由 HoverMenu 内部映射 Ant Design 图标）
 * - emit('click') → props.onClick
 * - handleContextMenuClick 调 chrome.runtime.sendMessage 保持不变
 *
 * 保留的特性：
 * - 通过事件总线更新 tools
 * - 优先调用 tool.onClick，否则展开 carousel 显示 children
 * - 上下文菜单点击发送消息到 background 并关闭
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { Tool } from "@/types";
import { bus } from "@/event/bus";
import HoverMenu from "./HoverMenu";
import SimpleCarousel from "./components/SimpleCarousel";

/** SidebarApp Props */
export interface SidebarAppProps {
  /** 工具列表 */
  tools?: Tool[];
  /** 布局方向（保留接口） */
  layout?: "vertical" | "horizontal" | "fold";
  /** 抽屉方向（保留接口） */
  drawerDirection?: "rtl" | "ltr" | "ttb" | "btt";
  /** 是否可见 */
  visible?: boolean;
}

/** 默认工具配置（与原 Vue 版结构等价，icon 用字符串标识） */
const DEFAULT_TOOLS: Tool[] = [
  {
    id: "zero",
    label: "关于",
    icon: "team",
    color: "#0ee732ff",
    children: [
      {
        id: "hello",
        label: "你好~",
        icon: "team",
        color: "#0ee732ff",
      },
    ],
  },
];

/**
 * Sidebar 主组件
 * - 渲染 HoverMenu 和 SimpleCarousel
 * - 监听事件总线更新 tools
 * - 处理菜单项点击：优先 onClick，否则展开 carousel
 */
const SidebarApp: React.FC<SidebarAppProps> = ({
  tools,
  layout,
  drawerDirection,
  visible = true,
}) => {
  // 上下文菜单（carousel）是否可见
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  // 当前选中的工具
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  // carousel 轮播项
  const [carouselItems, setCarouselItems] = useState<Tool[]>([]);

  // 本地 tools 副本（可通过事件总线更新）
  const [localTools, setLocalTools] = useState<Tool[]>(() => [
    ...(tools && tools.length > 0 ? tools : DEFAULT_TOOLS),
  ]);

  // 监听 props.tools 变化，同步到 localTools
  useEffect(() => {
    if (tools && tools.length > 0) {
      setLocalTools([...tools]);
    }
  }, [tools]);

  // 监听事件总线上的 tools 更新事件
  useEffect(() => {
    const handleToolsUpdate = (newTools: Tool[]) => {
      maLogger.log("接收到事件总线更新tools:", newTools);
      setLocalTools([...newTools]);
    };
    bus.on("update:sidebar:tools", handleToolsUpdate);
    return () => {
      bus.off("update:sidebar:tools", handleToolsUpdate);
    };
  }, []);

  // 上下文菜单项点击处理：发送消息到 background 并关闭菜单
  const handleContextMenuClick = useCallback((item: Tool) => {
    chrome.runtime.sendMessage({
      type: "CONTEXT_MENU_CLICK",
      payload: {
        itemId: item.id,
        itemLabel: item.label,
      },
      target: "background",
    });
    setContextMenuVisible(false);
  }, []);

  // 一级菜单点击处理：优先调用 onClick，否则展开 carousel
  const handleClick = useCallback((it: Tool) => {
    maLogger.log("点击工具项:", it);
    if (it.onClick && typeof it.onClick === "function") {
      it.onClick();
    } else {
      setCurrentTool(it);
      setCarouselItems(it.children || []);
      setContextMenuVisible(true);
    }
  }, []);

  // 渲染参数（layout / drawerDirection 当前未实际使用，保留接口）
  void layout;
  void drawerDirection;

  return (
    <>
      <HoverMenu
        items={localTools}
        visible={visible}
        onClick={handleClick}
      />
      <SimpleCarousel
        visible={contextMenuVisible}
        tools={carouselItems}
        onVisibleChange={setContextMenuVisible}
        onClickTool={handleContextMenuClick}
      />
    </>
  );
};

export default SidebarApp;
