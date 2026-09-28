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

describe("MagneticButton component wall preview", () => {
  it("renders three accessible icons and applies pointer attraction", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="magnetic-buttons"]',
    );
    const buttons = tile?.querySelectorAll<HTMLButtonElement>(".gravityButton > button");
    const wrapper = tile?.querySelector<HTMLElement>(".gravityButton");
    expect(buttons).toHaveLength(3);
    expect([...buttons ?? []].map((button) => button.getAttribute("aria-label"))).toEqual([
      "Bath",
      "Poo",
      "Golf Ball",
    ]);

    vi.spyOn(wrapper!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });
    act(() =>
      wrapper?.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: 75,
          clientY: 50,
        }),
      ),
    );

    expect(wrapper?.style.getPropertyValue("--tx")).toBe("12.5px");
    expect(wrapper?.style.getPropertyValue("--ty")).toBe("0px");
    expect(wrapper?.style.getPropertyValue("--opacity")).toBe("0.625");
  });
});