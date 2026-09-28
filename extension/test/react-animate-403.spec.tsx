import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Animate403 from "../src/components/response-code/Animate403";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
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

describe("Animate403", () => {
  it("types the terminal message while keeping links valid", () => {
    act(() => root.render(createElement(Animate403)));

    expect(container.querySelector(".animate-403__cursor")).not.toBeNull();
    act(() => vi.runAllTimers());

    expect(container.querySelector(".animate-403__cursor")).toBeNull();
    expect(container.textContent).toContain("HTTP 403 Forbidden");
    expect(container.textContent).toContain("HAVE A NICE DAY SIR AXLEROD");
    expect(container.querySelectorAll(".animate-403__content a")).toHaveLength(4);
  });

  it("clears the typing timers when unmounted", () => {
    act(() => root.render(createElement(Animate403)));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => root.unmount());

    expect(vi.getTimerCount()).toBe(0);
  });
});