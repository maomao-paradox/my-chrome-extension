import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AnimatedTextFill from "../src/components/richtext/AnimatedTextFill";
import MaMarkdown from "../src/components/richtext/MaMarkdown";
import RollingText from "../src/components/richtext/RollingText";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("richtext React components", () => {
  it("renders a rolling text animation", () => {
    act(() => {
      root.render(createElement(RollingText, { text: "HELLO" }));
    });

    expect(container.querySelector(".rolling-text")?.textContent).toContain("HELLO");
    expect(container.querySelectorAll(".rolling-text .block .letter").length).toBe(5);
  });

  it("renders animated text fill content", () => {
    act(() => {
      root.render(createElement(AnimatedTextFill, { children: "HELLO WORLD" }));
    });

    expect(container.textContent).toContain("HELLO WORLD");
    expect(container.querySelector(".animated-text-fill span")?.textContent).toContain("HELLO WORLD");
  });

  it("render markdown preview from value", () => {
    act(() => {
      root.render(
        createElement(MaMarkdown, {
          value: "# Hello\n\n- one\n- two",
          mode: "preview",
        }),
      );
    });

    expect(container.querySelector(".markdown-editor")?.textContent).toContain("Hello");
    expect(container.querySelector(".markdown-editor__preview-content h1")?.textContent).toBe("Hello");
  });
});
