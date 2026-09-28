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

describe("Accessible Select component wall preview", () => {
  it("registers the accessible selector and supports keyboard selection", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="accessible-select"]',
    );
    const trigger = tile?.querySelector<HTMLButtonElement>(
      ".accessible-select__trigger",
    );

    expect(tile).not.toBeNull();
    expect(trigger?.textContent).toBe("Components");
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");

    act(() => trigger?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
    })));

    const options = tile?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    expect(document.activeElement).toBe(options?.[0]);

    act(() => options?.[0]?.click());

    const updatedOptions = tile?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    expect(trigger?.textContent).toBe("Artboards");
    expect(updatedOptions?.[0]?.textContent).toBe("Components");
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    act(() =>
      trigger?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );
    act(() =>
      updatedOptions?.[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});