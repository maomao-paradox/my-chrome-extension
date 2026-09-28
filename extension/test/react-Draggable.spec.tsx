import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Draggable, { type DraggableHandle } from "../src/components/Draggable";

let container: HTMLDivElement;
let root: Root;

const setRect = (element: Element, left: number, top: number) => {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: left,
    y: top,
    left,
    top,
    right: left + 45,
    bottom: top + 45,
    width: 45,
    height: 45,
    toJSON: () => ({}),
  });
};

const createTouchEvent = (
  type: string,
  touches: Array<{ clientX: number; clientY: number; target: EventTarget }>,
  changedTouches = touches,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: touches },
    changedTouches: { value: changedTouches },
  });
  return event;
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Draggable", () => {
  it("preserves the imperative position API", () => {
    const draggableRef = createRef<DraggableHandle>();
    act(() => root.render(createElement(Draggable, { ref: draggableRef })));

    act(() => draggableRef.current?.setPositionImmediate(24, 38));

    expect(draggableRef.current?.getCurrentPosition()).toEqual({ x: 24, y: 38 });
    const draggable = container.firstElementChild as HTMLElement;
    expect(draggable.style.getPropertyValue("--translate-x")).toBe("24px");
    expect(draggable.style.getPropertyValue("--translate-y")).toBe("38px");
  });

  it("tracks mouse movement and ends the drag", () => {
    const onDragEnd = vi.fn();
    act(() => root.render(createElement(Draggable, { onDragEnd })));
    const draggable = container.querySelector<HTMLElement>(".draggable-container")!;
    setRect(draggable, 20, 30);

    act(() =>
      draggable.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          clientX: 30,
          clientY: 40,
        }),
      ),
    );
    act(() =>
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: 80,
          clientY: 100,
        }),
      ),
    );

    expect(draggable.style.getPropertyValue("--translate-x")).toBe("70px");
    expect(draggable.style.getPropertyValue("--translate-y")).toBe("90px");

    act(() => window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true })));
    expect(onDragEnd).toHaveBeenCalledOnce();
  });

  it("tracks touch movement and ends the drag", () => {
    const onDragEnd = vi.fn();
    act(() => root.render(createElement(Draggable, { onDragEnd })));
    const draggable = container.querySelector<HTMLElement>(".draggable-container")!;
    setRect(draggable, 20, 30);
    const touch = (clientX: number, clientY: number) => ({
      clientX,
      clientY,
      target: draggable,
    });

    act(() =>
      draggable.dispatchEvent(createTouchEvent("touchstart", [touch(30, 40)])),
    );
    act(() =>
      window.dispatchEvent(createTouchEvent("touchmove", [touch(80, 100)])),
    );

    expect(draggable.style.getPropertyValue("--translate-x")).toBe("70px");
    expect(draggable.style.getPropertyValue("--translate-y")).toBe("90px");

    act(() => window.dispatchEvent(createTouchEvent("touchend", [], [touch(80, 100)])));
    expect(onDragEnd).toHaveBeenCalledOnce();
  });
});