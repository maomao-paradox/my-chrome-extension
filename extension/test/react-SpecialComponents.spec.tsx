import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnimatedSearch from "../src/components/special/AnimatedSearch";
import AnimatedSearchOptimized from "../src/components/special/AnimatedSearchOptimized";
import CarouselScene from "../src/components/special/CarouselScene";

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

describe("AnimatedSearch", () => {
  it("keeps independent expansion state for multiple instances", () => {
    act(() => {
      root.render(
        createElement(
          Fragment,
          null,
          createElement(AnimatedSearch, { label: "first" }),
          createElement(AnimatedSearch, { label: "second" }),
        ),
      );
    });

    const searches = container.querySelectorAll<HTMLElement>(".special-search");
    const toggles = container.querySelectorAll<HTMLButtonElement>(".special-search__toggle");

    act(() => toggles[0].dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(searches[0].classList.contains("is-expanded")).toBe(true);
    expect(searches[1].classList.contains("is-expanded")).toBe(false);
  });

  it("submits the current value with Enter", () => {
    const onSubmitQuestion = vi.fn();
    act(() => root.render(createElement(AnimatedSearch, { onSubmitQuestion })));
    const toggle = container.querySelector<HTMLButtonElement>(".special-search__toggle");
    act(() => toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const input = container.querySelector<HTMLInputElement>(".special-search__input")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setValue?.call(input, "  hello world  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onSubmitQuestion).toHaveBeenCalledWith("hello world");
  });
});

describe("AnimatedSearchOptimized", () => {
  it("expands on focus and submits with Ctrl+Enter", () => {
    const onSubmitQuestion = vi.fn();
    act(() => root.render(createElement(AnimatedSearchOptimized, { onSubmitQuestion })));

    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    act(() => textarea.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector(".special-search")?.classList.contains("is-active")).toBe(true);

    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setValue?.call(textarea, "hello from optimized search");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    });

    expect(onSubmitQuestion).toHaveBeenCalledWith("hello from optimized search");
  });
});

describe("CarouselScene", () => {
  it("changes active cells with controls and wheel gestures", () => {
    act(() => root.render(createElement(CarouselScene, { cells: 5 })));
    const position = container.querySelector(".special-carousel-scene__position");
    const stage = container.querySelector<HTMLElement>(".special-carousel-scene__stage");
    const nextButton = container.querySelector<HTMLButtonElement>(
      '.special-carousel-scene__control[aria-label="下一项"]',
    );
    const initialTransform = stage?.style.transform;

    act(() => nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(position?.textContent).toBe("2 / 5");
    expect(stage?.style.transform).not.toBe(initialTransform);

    act(() => {
      container.querySelector(".special-carousel-scene")?.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 1, bubbles: true, cancelable: true }),
      );
    });
    expect(position?.textContent).toBe("3 / 5");
  });
});