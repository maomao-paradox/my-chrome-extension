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

describe("CSS Doodle Particles component wall preview", () => {
  it("renders the local CSS Doodle element with the original rule", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="css-doodle-particles"]',
    );
    const preview = tile?.querySelector<HTMLElement>(
      '[role="img"][aria-label="彩色爱心与光点向外飞散的粒子动画"]',
    );
    const doodle = preview?.querySelector("css-doodle");
    const rules = preview?.querySelector("style")?.textContent ?? "";

    expect(preview).not.toBeNull();
    expect(customElements.get("css-doodle")).toBeDefined();
    expect(doodle?.getAttribute("use")).toBe("var(--rule)");
    expect(rules).toContain("@grid: 30x1 / 18vmin");
    expect(rules).toContain("@shape: heart");
    expect(rules).toContain("@m100(radial-gradient");
  });
});