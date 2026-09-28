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

describe("SlicedText component wall preview", () => {
  it("renders the sliced text with one accessible heading", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="sliced-text"]',
    );
    const heading = tile?.querySelector(".sliced-text-demo__heading");
    const top = heading?.querySelector(".sliced-text-demo__top");
    const bottom = heading?.querySelector(".sliced-text-demo__bottom");

    expect(tile).not.toBeNull();
    expect(heading?.textContent).toBe("SlicedSliced");
    expect(top?.textContent).toBe("Sliced");
    expect(bottom?.getAttribute("aria-hidden")).toBe("true");
  });
});