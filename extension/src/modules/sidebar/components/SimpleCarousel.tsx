/**
 * SimpleCarousel - 简化版轮播组件（React 版）
 *
 * 从 MACarousel.vue 迁移而来，替代 Element Plus 的 el-carousel type="card"。
 * 使用原生 React 实现，避免引入 Element Plus 依赖。
 *
 * 关键设计：
 * - 当前 index 居中并放大，相邻 item 缩小半透明
 * - 左右箭头切换 + 鼠标滚轮切换
 * - 点击 item 触发 onClickTool 回调
 * - 遮罩层点击关闭
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { Tool } from "@/types";
import "../styles/carousel.scss";

/** SimpleCarousel Props */
export interface SimpleCarouselProps {
  /** 是否可见 */
  visible: boolean;
  /** 工具列表 */
  tools: Tool[];
  /** 可见性变化回调（用于 v-model:visible 等效） */
  onVisibleChange?: (visible: boolean) => void;
  /** 点击工具项回调 */
  onClickTool?: (tool: Tool) => void;
}

/** 轮播卡片背景色数组（与原 MACarousel 保持一致） */
const BG_COLORS = [
  "#3498db",
  "#e74c3c",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
];

/**
 * 简化版轮播组件
 * - visible=false 时返回 null
 * - 使用 activeIndex 控制当前激活项
 * - 支持滚轮、箭头、点击三种切换方式
 */
const SimpleCarousel: React.FC<SimpleCarouselProps> = ({
  visible,
  tools,
  onVisibleChange,
  onClickTool,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 工具列表变化时重置索引
  useEffect(() => {
    setActiveIndex(0);
  }, [tools]);

  // 切换到上一页
  const prev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + tools.length) % tools.length);
  }, [tools.length]);

  // 切换到下一页
  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % tools.length);
  }, [tools.length]);

  // 滚轮事件处理：向下滚动下一页，向上滚动上一页
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      // 阻止默认滚动行为
      event.preventDefault();
      if (event.deltaY > 0) {
        next();
      } else {
        prev();
      }
    },
    [next, prev],
  );

  // 遮罩层点击：关闭对话框
  const handleMaskClick = useCallback(() => {
    onVisibleChange?.(false);
  }, [onVisibleChange]);

  // 点击工具项：调用 onClick 回调或触发 onClickTool 事件，然后关闭
  const handleClickTool = useCallback(
    (tool: Tool) => {
      if (typeof tool.onClick === "function") {
        tool.onClick();
      } else {
        onClickTool?.(tool);
      }
      onVisibleChange?.(false);
    },
    [onClickTool, onVisibleChange],
  );

  // 点击具体 item：切换激活并触发回调
  const handleItemClick = useCallback(
    (index: number, tool: Tool) => {
      if (index === activeIndex) {
        handleClickTool(tool);
      } else {
        setActiveIndex(index);
      }
    },
    [activeIndex, handleClickTool],
  );

  // ESC 键关闭
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onVisibleChange?.(false);
      } else if (event.key === "ArrowLeft") {
        prev();
      } else if (event.key === "ArrowRight") {
        next();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, prev, next, onVisibleChange]);

  if (!visible) return null;

  return (
    <div className="ma-carousel-wrapper">
      {/* 遮罩层 */}
      <div className="ma-carousel-mask" onClick={handleMaskClick} />

      {/* 轮播容器 */}
      <div
        className="ma-carousel-container"
        ref={containerRef}
        onWheel={handleWheel}
      >
        {/* 左箭头 */}
        {tools.length > 1 && (
          <button
            type="button"
            className="ma-carousel-arrow prev"
            aria-label="上一项"
            onClick={prev}
          >
            <LeftOutlined />
          </button>
        )}

        {/* 轮播轨道 */}
        <div className="ma-carousel-track">
          {tools.map((tool, index) => {
            const isActive = index === activeIndex;
            const distance = Math.abs(index - activeIndex);
            // 仅渲染当前项和相邻 2 项，避免长列表性能问题
            if (distance > 2 && tools.length > 5) return null;

            return (
              <div
                key={tool.id}
                className={`ma-carousel-item ${isActive ? "is-active" : ""}`}
                style={{
                  backgroundColor: BG_COLORS[index % BG_COLORS.length],
                  backgroundImage: tool.image ? `url(${tool.image})` : undefined,
                }}
                onClick={() => handleItemClick(index, tool)}
              >
                {tool.id === "hello" ? (
                  <div className="ma-carousel-hello">
                    <span>这里有一个BUG，痛い！</span>
                  </div>
                ) : (
                  <div className="ma-carousel-content">
                    <h3 className="ma-carousel-title">{tool.label}</h3>
                    <p className="ma-carousel-details">{tool.details}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 右箭头 */}
        {tools.length > 1 && (
          <button
            type="button"
            className="ma-carousel-arrow next"
            aria-label="下一项"
            onClick={next}
          >
            <RightOutlined />
          </button>
        )}
      </div>
    </div>
  );
};

export default SimpleCarousel;
