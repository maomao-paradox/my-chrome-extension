import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./ScrollingTimeline.scss";

export interface ScrollingTimelineItem {
  id: string;
  date: string;
  title: string;
  description?: string;
  meta?: string;
}

export interface ScrollingTimelineProps {
  items?: ScrollingTimelineItem[];
  activeId?: string;
  onActiveIdChange?: (id: string) => void;
  onSelect?: (item: ScrollingTimelineItem) => void;
  eyebrow?: string;
  title?: string;
  previousLabel?: string;
  nextLabel?: string;
}

const DEFAULT_ITEMS: ScrollingTimelineItem[] = [
  { id: "launch", date: "01.12", title: "项目启动", description: "确认目标与交付边界", meta: "阶段 01" },
  { id: "prototype", date: "01.26", title: "原型评审", description: "完成核心交互验证", meta: "阶段 02" },
  { id: "build", date: "02.08", title: "功能开发", description: "进入组件与数据联调", meta: "阶段 03" },
  { id: "release", date: "02.23", title: "正式发布", description: "上线并观察使用反馈", meta: "阶段 04" },
];

export default function ScrollingTimeline({
  items = DEFAULT_ITEMS,
  activeId,
  onActiveIdChange,
  onSelect,
  eyebrow = "PROJECT LOG",
  title = "进度时间轴",
  previousLabel = "查看上一个时间点",
  nextLabel = "查看下一个时间点",
}: ScrollingTimelineProps) {
  const trackRef = useRef<HTMLOListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [uncontrolledActiveId, setUncontrolledActiveId] = useState(items[0]?.id ?? "");
  const isControlled = activeId !== undefined;
  const selectedId = isControlled ? activeId : uncontrolledActiveId;

  const activeIndex = useMemo(() => {
    const index = items.findIndex((item) => item.id === selectedId);
    return index >= 0 ? index : 0;
  }, [items, selectedId]);

  const activeItem = items[activeIndex];
  const progress = items.length < 2 ? 100 : (activeIndex / (items.length - 1)) * 100;

  useEffect(() => {
    if (items.length === 0) return;
    const selectedItem = items.find((item) => item.id === selectedId);
    if (!selectedItem) {
      setUncontrolledActiveId(items[0].id);
      onActiveIdChange?.(items[0].id);
    }
  }, [items, onActiveIdChange, selectedId]);

  const scrollItemIntoView = useCallback((index: number) => {
    const element = itemRefs.current[index];
    if (typeof element?.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, []);

  const selectItem = useCallback(
    (item: ScrollingTimelineItem, index: number) => {
      if (!isControlled) setUncontrolledActiveId(item.id);
      onActiveIdChange?.(item.id);
      onSelect?.(item);
      scrollItemIntoView(index);
    },
    [isControlled, onActiveIdChange, onSelect, scrollItemIntoView],
  );

  const moveTo = useCallback(
    (index: number) => {
      if (items.length === 0) return;
      const targetIndex = Math.max(0, Math.min(index, items.length - 1));
      selectItem(items[targetIndex], targetIndex);
    },
    [items, selectItem],
  );

  const handleTrackKeyDown = (event: React.KeyboardEvent<HTMLOListElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTo(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTo(activeIndex + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveTo(items.length - 1);
    }
  };

  return (
    <section className="scrolling-timeline" aria-label={title}>
      <header className="timeline-header">
        <div>
          <p className="timeline-kicker">{eyebrow}</p>
          <h2 className="timeline-title">{title}</h2>
        </div>
        <p className="timeline-count" aria-live="polite">
          {items.length === 0 ? 0 : activeIndex + 1} / {items.length}
        </p>
      </header>

      <div className="timeline-window">
        <button
          className="timeline-nav timeline-nav--previous"
          type="button"
          disabled={activeIndex === 0 || items.length === 0}
          aria-label={previousLabel}
          title={previousLabel}
          onClick={() => moveTo(activeIndex - 1)}
        >
          <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>

        <ol
          ref={trackRef}
          className="timeline-track"
          tabIndex={0}
          aria-label={`${title}项目`}
          onKeyDown={handleTrackKeyDown}
        >
          {items.map((item, index) => {
            const isActive = item.id === activeItem?.id;
            return (
              <li
                key={item.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                className={`timeline-item${isActive ? " timeline-item--active" : ""}`}
              >
                <button
                  className="timeline-node"
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`${item.date}：${item.title}`}
                  onClick={() => selectItem(item, index)}
                >
                  <span aria-hidden="true" className="timeline-node-dot" />
                  <span aria-hidden="true" className="timeline-node-line" />
                </button>

                <button
                  className="timeline-card"
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => selectItem(item, index)}
                >
                  <span className="timeline-date">{item.date}</span>
                  <span className="timeline-card-title">{item.title}</span>
                  {item.description && <span className="timeline-description">{item.description}</span>}
                  {item.meta && <span className="timeline-meta">{item.meta}</span>}
                </button>
              </li>
            );
          })}
        </ol>

        <button
          className="timeline-nav timeline-nav--next"
          type="button"
          disabled={activeIndex === items.length - 1 || items.length === 0}
          aria-label={nextLabel}
          title={nextLabel}
          onClick={() => moveTo(activeIndex + 1)}
        >
          <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="timeline-progress" aria-hidden="true">
        <span className="timeline-progress-value" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
