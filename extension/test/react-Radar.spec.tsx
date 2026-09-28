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

describe("Radar component wall preview", () => {
  it("renders the scoped radar and allows switching its display mode", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="radar"]',
    );
    const radar = tile?.querySelector(".radar-component__radar");
    const toggle = tile?.querySelector<HTMLInputElement>(
      ".radar-component__selector",
    );

    expect(radar).not.toBeNull();
    expect(toggle?.getAttribute("aria-label")).toBe("切换雷达模式");
    expect(tile?.querySelector("#radar")).toBeNull();

    act(() => toggle?.click());
    expect(toggle?.checked).toBe(true);
  });
});