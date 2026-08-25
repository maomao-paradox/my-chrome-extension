import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import ScrollingTimeline, { type ScrollingTimelineItem } from "@/assets/components/ScrollingTimeline";

const items: ScrollingTimelineItem[] = [
  { id: "one", date: "01.01", title: "第一阶段", description: "需求确认" },
  { id: "two", date: "01.15", title: "第二阶段", description: "开始开发" },
  { id: "three", date: "02.01", title: "第三阶段", description: "完成发布" },
];

afterEach(cleanup);

describe("ScrollingTimeline", () => {
  it("renders all items and selects the first item by default", () => {
    const { container, getByText } = render(React.createElement(ScrollingTimeline, { items }));

    expect(container.querySelectorAll(".timeline-item")).toHaveLength(3);
    expect(getByText("第一阶段").closest(".timeline-item")).toHaveClass("timeline-item--active");
    expect(container.querySelector(".timeline-count")?.textContent).toBe("1 / 3");
  });

  it("selects an item and emits the item id", () => {
    const onActiveIdChange = vi.fn();
    const onSelect = vi.fn();
    const { getByText } = render(
      React.createElement(ScrollingTimeline, { items, onActiveIdChange, onSelect }),
    );

    fireEvent.click(getByText("第二阶段"));

    expect(onActiveIdChange).toHaveBeenCalledWith("two");
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    expect(getByText("第二阶段").closest(".timeline-item")).toHaveClass("timeline-item--active");
  });

  it("supports keyboard navigation and disables edge controls", () => {
    const onActiveIdChange = vi.fn();
    const { container } = render(
      React.createElement(ScrollingTimeline, { items, activeId: "two", onActiveIdChange }),
    );
    const track = container.querySelector(".timeline-track")!;

    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(onActiveIdChange).toHaveBeenCalledWith("three");
    expect((container.querySelector(".timeline-nav--next") as HTMLButtonElement).disabled).toBe(true);
  });
});
