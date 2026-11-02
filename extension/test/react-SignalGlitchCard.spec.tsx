import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignalGlitchCard from "../src/components/SignalGlitchCard";

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

describe("SignalGlitchCard", () => {
  it("renders the default glitch text", () => {
    act(() => root.render(createElement(SignalGlitchCard)));

    const text = container.querySelector<HTMLElement>(".text");
    expect(text?.textContent).toBe("TEXT GLITCH");
    expect(text?.getAttribute("data-text")).toBe("TEXT GLITCH");
  });

  it("renders the text passed in", () => {
    act(() => root.render(createElement(SignalGlitchCard, { text: "SIGNAL" })));

    const text = container.querySelector<HTMLElement>(".text");
    expect(text?.textContent).toBe("SIGNAL");
    expect(text?.getAttribute("data-text")).toBe("SIGNAL");
  });
});
