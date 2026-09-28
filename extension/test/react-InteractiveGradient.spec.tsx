import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InteractiveGradient from "../src/components/InteractiveGradient";

let container: HTMLDivElement;
let root: Root;
let frameCallbacks: FrameRequestCallback[];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  frameCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("InteractiveGradient", () => {
  it("keeps filter ids unique and renders title and content props", () => {
    act(() => {
      root.render(
        createElement(
          Fragment,
          null,
          createElement(InteractiveGradient, {
            title: "FIRST FIELD",
            children: createElement("p", null, "First content"),
          }),
          createElement(InteractiveGradient, {
            title: "SECOND FIELD",
            children: createElement("p", null, "Second content"),
          }),
        ),
      );
    });

    const filterIds = [...container.querySelectorAll("filter")].map((filter) => filter.id);
    expect(filterIds).toHaveLength(6);
    expect(new Set(filterIds).size).toBe(filterIds.length);
    expect(container.textContent).toContain("FIRST FIELD");
    expect(container.textContent).toContain("Second content");
  });

  it("smoothly follows the pointer inside its own bounds", () => {
    act(() => root.render(createElement(InteractiveGradient)));
    const scene = container.querySelector<HTMLElement>(".interactive-gradient")!;
    vi.spyOn(scene, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });

    const pointerMove = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 150,
      clientY: 40,
    });
    act(() => scene.dispatchEvent(pointerMove));
    act(() => frameCallbacks.shift()?.(0));

    expect(
      container.querySelector<HTMLElement>(".interactive-gradient__blob--interactive")?.style.transform,
    ).toBe(
      "translate(-50%, -50%) translate3d(2.50px, -0.50px, 0)",
    );
  });
});