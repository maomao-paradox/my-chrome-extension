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

describe("Animated Weather Icons component wall preview", () => {
  it("renders all six labelled weather animations", () => {
    act(() => root.render(createElement(App)));

    const tile = container.querySelector<HTMLElement>(
      '[data-component-id="weather-icons"]',
    );
    const icons = tile?.querySelectorAll<HTMLElement>(".weather-icon");

    expect(tile).not.toBeNull();
    expect(icons).toHaveLength(6);
    expect([...icons ?? []].map((icon) => icon.getAttribute("aria-label"))).toEqual([
      "Sun shower",
      "Thunderstorm",
      "Cloudy",
      "Flurries",
      "Sunny",
      "Rainy",
    ]);
    expect(tile?.querySelectorAll(".weather-icon__sun")).toHaveLength(2);
    expect(tile?.querySelectorAll(".weather-icon__bolt")).toHaveLength(2);
  });
});