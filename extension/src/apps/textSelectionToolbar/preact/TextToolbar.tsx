/**
 * TextToolbar 组件 - Preact 版本
 * 提供文本选择工具栏的UI，支持多种工具操作
 */
import { h, type ComponentChild } from "preact";
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import type { TextTool } from "@/types";
import "./styles/text-toolbar.scss";

/**
 * TextToolbar 组件属性接口
 */
interface TextToolbarProps {
  /** 初始文本（选中文本） */
  initialText?: string;
  /** 当前选中文本 */
  selectedText?: string;
  /** 自定义工具列表 */
  customTools?: TextTool[];
  /** 是否显示关闭按钮 */
  showCloseBtn?: boolean;
  /** 关闭工具栏事件 */
  onClose?: () => void;
  /** 工具点击事件（在组件内部执行 handler 后触发） */
  onToolClick?: (tool: TextTool) => void;
}

/**
 * 图标映射类型
 */
type IconMap = Record<string, string>;

/**
 * 工具图标映射（使用 SVG 路径）
 */
const TOOL_ICONS: IconMap = {
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  comment: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  copy: "M20 9H8v11h12V9zM4 3v11h1V4h11V3H4z",
  replace:
    "M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z",
  search:
    "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  translate:
    "M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z",
};

/**
 * 默认 SVG 图标（用于未知工具）
 */
const DEFAULT_ICON =
  "M22.7 19.3l-6.3-6.3c-.8-.8-.8-2.1 0-2.8l6.3-6.3c.8-.8 2.1-.8 2.8 0l6.3 6.3c.8.8.8 2.1 0 2.8l-6.3 6.3c-.8.8-2.1.8-2.8 0zM20.5 10.5L14 4l-6.5 6.5 6.5 6.5 6.5-6.5z";

/**
 * TextToolbar 组件
 * 提供文本选择工具栏的UI，显示可用的工具按钮
 */
const TextToolbar = ({
  initialText = "",
  selectedText = "",
  customTools = [],
  showCloseBtn = false,
  onClose,
  onToolClick,
}: TextToolbarProps): ComponentChild => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [currentInitialText, setCurrentInitialText] =
    useState<string>(initialText);

  // 监听 initialText 变化
  useEffect(() => {
    setCurrentInitialText(initialText);
  }, [initialText]);

  /**
   * 关闭工具栏
   */
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /**
   * 处理工具点击 - 封装每个工具的点击逻辑
   * 优先执行 tool.handler，再回调 onToolClick 通知父组件
   */
  const handleToolClick = useCallback(
    (tool: TextTool) => {
      maLogger.log("工具点击:", tool.id, tool.label);
      // 执行工具自身的 handler 逻辑
      tool.handler?.(selectedText || currentInitialText);
      // 回调通知父组件
      onToolClick?.(tool);
    },
    [selectedText, currentInitialText, onToolClick],
  );

  /**
   * 获取工具图标
   */
  const getToolIcon = useCallback((tool: TextTool): string => {
    return TOOL_ICONS[tool.id] || DEFAULT_ICON;
  }, []);

  /**
   * 工具栏样式
   */
  const toolbarStyle = {
    left: "0px",
    top: "0px",
  };

  /**
   * 渲染关闭按钮
   */
  const renderCloseButton = (): ComponentChild => (
    <button
      className="close-btn"
      type="button"
      aria-label="收起文本选择工具栏"
      onClick={handleClose}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={DEFAULT_ICON} />
      </svg>
    </button>
  );

  /**
   * 渲染工具按钮列表
   */
  const renderTools = (): ComponentChild =>
    customTools.map((tool, index) => (
      <button
        key={`${tool.id}-${index}`}
        className="toolbar-btn"
        type="button"
        onClick={() => handleToolClick(tool)}
      >
        <span className="tool-icon" aria-hidden="true">
          {tool.icon ? (
            <span className="tool-custom-icon">{tool.icon}</span>
          ) : (
            <svg
              className="tool-svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d={getToolIcon(tool)} />
            </svg>
          )}
        </span>
        <span className="tool-label">{tool.label}</span>
      </button>
    ));

  return (
    <div
      ref={toolbarRef}
      className="text-selection-toolbar"
      style={toolbarStyle}
    >
      <div className="toolbar-content">
        {/* 不需要关闭按钮 */}
        {/* {showCloseBtn && renderCloseButton()}
        {showCloseBtn && customTools.length > 0 && <div className="toolbar-divider"></div>} */}
        {renderTools()}
      </div>
    </div>
  );
};

export default TextToolbar;
export { TextToolbar };
