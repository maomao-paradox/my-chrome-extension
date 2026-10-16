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

describe("SignalGlitchCard component wall preview", () => {
  it("renders a stable signal card with an animated jagged waveform", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="signal-glitch-card"]',
    );
    const card = tile?.querySelector<HTMLElement>(".signal-glitch-card");
    const waveform = card?.querySelector<SVGPathElement>(
      ".signal-glitch-card__wave--main",
    );

    expect(card?.getAttribute("aria-label")).toContain("信号稳定");
    expect(waveform?.getAttribute("d")).toContain("L266 32 L272 61");
    expect(card?.querySelectorAll(".signal-glitch-card__tear")).toHaveLength(2);
    expect(card?.querySelectorAll(".signal-glitch-card__meter i")).toHaveLength(12);
  });
});