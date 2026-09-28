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

describe("Aladdin component wall preview", () => {
  it("renders the split phrase and moves slow and fast lines with the pointer", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="aladdin"]',
    );
    const preview = tile?.querySelector<HTMLElement>(".aladdin");

    expect(tile).not.toBeNull();
    expect(preview?.getAttribute("aria-label")).toBe("Aladdin: What do you want?");
    expect(preview?.querySelectorAll(".aladdin__line")).toHaveLength(4);
    expect(preview?.querySelectorAll(".aladdin__side")).toHaveLength(8);

    vi.spyOn(preview!, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 460,
      bottom: 280,
      width: 360,
      height: 280,
      toJSON: () => ({}),
    });
    act(() =>
      preview?.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: 460,
        }),
      ),
    );

    expect(preview?.style.getPropertyValue("--aladdin-slow-shift")).toBe("30px");
    expect(preview?.style.getPropertyValue("--aladdin-fast-shift")).toBe("60px");

    act(() =>
      preview?.dispatchEvent(new MouseEvent("pointerout", { bubbles: true })),
    );
    expect(preview?.style.getPropertyValue("--aladdin-slow-shift")).toBe("0px");
    expect(preview?.style.getPropertyValue("--aladdin-fast-shift")).toBe("0px");
  });
});