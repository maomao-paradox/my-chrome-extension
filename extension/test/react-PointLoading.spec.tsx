import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/pages/component-wall/App";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("PointLoading component wall preview", () => {
  it("renders the point animation with an interactive color toggle", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="point-loading"]',
    );
    const toggle = tile?.querySelector<HTMLInputElement>(
      ".point-loading-preview__input",
    );

    expect(tile?.querySelectorAll(".point-loading-preview__dots")).toHaveLength(12);
    expect(toggle?.getAttribute("aria-label")).toBe("切换点阵动画配色");
    act(() => toggle?.click());
    expect(toggle?.checked).toBe(true);
  });
});