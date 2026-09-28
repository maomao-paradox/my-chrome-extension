import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TextScramble, { DEFAULT_TEXT_SCRAMBLE_PHRASES } from "../src/components/TextScramble";
import App from "../src/pages/component-wall/App";

let container: HTMLDivElement;
let root: Root;
let frameCallbacks: FrameRequestCallback[];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  frameCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("TextScramble", () => {
  it("cycles through phrases using its configurable delay", () => {
    act(() => root.render(createElement(TextScramble, { phrases: ["First", "Second"], speed: 250 })));
    expect(container.querySelector(".text-scramble__text")?.textContent).toBe("First");

    act(() => vi.advanceTimersByTime(250));
    expect(container.querySelector(".text-scramble__text")?.textContent).toBe("Second");
  });

  it("is available in the component wall", () => {
    act(() => root.render(createElement(App)));
    expect(container.querySelector('[data-component-id="text-scramble"] .text-scramble')).not.toBeNull();
  });

  it("edits phrases as lines and updates the preview and JSX array", () => {
    act(() => root.render(createElement(App)));
    const title = container.querySelector<HTMLButtonElement>(
      '[data-component-id="text-scramble"] .component-tile__name',
    );
    act(() => title?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const phrasesRow = [...container.querySelectorAll<HTMLElement>(".property-row")]
      .find((row) => row.querySelector("dt")?.textContent === "phrases");
    const editor = phrasesRow?.querySelector<HTMLTextAreaElement>("textarea");
    expect(editor?.value).toBe(DEFAULT_TEXT_SCRAMBLE_PHRASES.join("\n"));

    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setValue?.call(editor, "Alpha\nBeta");
      editor?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector(".dialog-usage-box code")?.textContent).toContain(
      'phrases={["Alpha","Beta"]}',
    );
    expect(container.querySelector(".dialog-preview .text-scramble__text")?.textContent).toBe("Alpha");
  });
});