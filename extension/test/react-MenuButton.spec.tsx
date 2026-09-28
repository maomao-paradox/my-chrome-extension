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

describe("MenuButton component wall preview", () => {
  it("opens the action menu, supports keyboard navigation, and closes on Escape", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="menu-button"]',
    );
    const trigger = tile?.querySelector<HTMLButtonElement>(
      ".menu-button__trigger",
    );

    expect(tile).not.toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    act(() =>
      trigger?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );

    const items = tile?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    expect(items).toHaveLength(4);
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(items?.[0]);

    act(() =>
      items?.[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});