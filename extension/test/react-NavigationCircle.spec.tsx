import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NavigationCircle from "../src/components/NavigationCircle";

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

describe("NavigationCircle", () => {
  it("renders seven navigation points", () => {
    act(() => root.render(createElement(NavigationCircle)));

    expect(container.querySelectorAll(".navigation-circle-list-item")).toHaveLength(7);
  });

  it("previews the arc on hover and toggles selection on click", () => {
    act(() => root.render(createElement(NavigationCircle)));
    const secondPoint = container.querySelectorAll<HTMLButtonElement>(
      ".navigation-circle-list-item__point",
    )[1];
    const maskCircle = container.querySelector(
      ".navigation-circle-svg--mask circle",
    );

    act(() => {
      secondPoint.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }),
      );
    });
    expect(maskCircle?.getAttribute("stroke-dashoffset")).not.toBe("0px");

    act(() => {
      secondPoint.dispatchEvent(
        new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }),
      );
    });
    expect(maskCircle?.getAttribute("stroke-dashoffset")).toBe("0px");

    act(() => secondPoint.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(secondPoint.getAttribute("aria-pressed")).toBe("true");
    expect(secondPoint.closest(".navigation-circle-list-item")?.classList).toContain(
      "active",
    );

    act(() => secondPoint.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(secondPoint.getAttribute("aria-pressed")).toBe("false");
    expect(secondPoint.closest(".navigation-circle-list-item")?.classList).not.toContain(
      "active",
    );
  });
});