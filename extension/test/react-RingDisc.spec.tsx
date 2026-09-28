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
});

describe("RingDisc component wall preview", () => {
  it("renders three rings, three discs, and an accessible loading status", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="ring-disc-loading"]',
    );

    expect(tile?.querySelectorAll(".ring-disc-loader__ring")).toHaveLength(3);
    expect(tile?.querySelectorAll(".ring-disc-loader__disc")).toHaveLength(3);
    expect(tile?.querySelector('[role="status"]')?.textContent).toBe(
      "LOADING...",
    );
    expect(
      tile?.querySelector(".ring-disc-loader__rings")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});