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
  document.body.style.overflow = "";
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("Component wall", () => {
  it("shows component tiles without adding a page header", () => {
    act(() => root.render(createElement(App)));

    expect(container.querySelectorAll(".component-tile")).toHaveLength(24);
    expect(
      container.querySelector(
        '[data-component-id="interactive-gradient"] .interactive-gradient',
      ),
    ).not.toBeNull();
    expect(container.querySelector('[data-component-id="rolling-text"]')).not.toBeNull();
    expect(container.querySelector('[data-component-id="animated-text-fill"]')).not.toBeNull();
    expect(container.querySelector('[data-component-id="ma-markdown"]')).not.toBeNull();
    expect(container.querySelector('[data-component-id="animate-403"] .animate-403')).not.toBeNull();
    expect(container.querySelector(".component-wall-page > header")).toBeNull();
    expect(container.querySelector(".dialog-backdrop")).toBeNull();
  });

  it("opens component details and closes the dialog", () => {
    act(() => root.render(createElement(App)));
    const pointerTitle = container.querySelector<HTMLButtonElement>(
      '[data-component-id="magnetic-pointer"] .component-tile__name',
    );

    act(() => pointerTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector("#component-dialog-title")?.textContent).toBe(
      "Magnetic Pointer",
    );
    expect(container.querySelectorAll(".property-row")).toHaveLength(5);
    const firstPropertyRow = container.querySelector(".property-row");
    expect(firstPropertyRow?.children).toHaveLength(3);
    expect(firstPropertyRow?.children[0].querySelector("dt")?.textContent).toBe(
      "color",
    );
    expect(
      firstPropertyRow?.children[0].querySelector(".property-description"),
    ).not.toBeNull();
    expect(firstPropertyRow?.children[1].classList.contains("property-editor")).toBe(
      true,
    );
    expect(firstPropertyRow?.children[2].classList.contains("property-type")).toBe(
      true,
    );

    const closeButton = container.querySelector<HTMLButtonElement>(".dialog-close");
    act(() => closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens the timeline details in a wide preview layout", () => {
    act(() => root.render(createElement(App)));
    const timelineTitle = container.querySelector<HTMLButtonElement>(
      '[data-component-id="scrolling-timeline"] .component-tile__name',
    );

    act(() => timelineTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.querySelector(".component-dialog--wide")).not.toBeNull();
    expect(container.querySelector(".dialog-preview--wide .scrolling-timeline")).not.toBeNull();
  });

  it("renders the key gallery component families", () => {
    act(() => root.render(createElement(App)));

    expect(container.querySelector('[data-component-id="jungle-knot-button"]')).not.toBeNull();
    expect(container.querySelector('[data-component-id="flower-loading"]')).not.toBeNull();
    expect(container.querySelector('[data-component-id="chromatic-text"]')).not.toBeNull();
    expect(container.querySelector('[data-component-id="arknights-button"]')).not.toBeNull();
    expect(container.querySelector('[data-component-id="arknights-card"]')).not.toBeNull();
    expect(container.querySelector(".operation-button")).not.toBeNull();
    expect(container.querySelectorAll(".flower-loading-preview .common")).toHaveLength(8);
    expect(container.querySelector(".chromatic-text-preview .chromatic")).not.toBeNull();
    expect(container.querySelector(".ark-card-demo")).not.toBeNull();
  });

  it("shows the redesigned 404 panel and keeps its return action", () => {
    act(() => root.render(createElement(App)));

    const panel = container.querySelector<HTMLElement>(
      '[data-component-id="static-404"] .static-404',
    );
    expect(panel?.querySelector(".static-404__code")?.textContent).toBe("404");
    expect(panel?.querySelector(".static-404__copy h1")?.textContent).toContain(
      "这条路径",
    );

    const returnButton = panel?.querySelector<HTMLButtonElement>(
      ".static-404__button",
    );
    act(() => returnButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector(".art--error-returned")?.textContent).toBe(
      "DEMO HOME",
    );
  });

  it("opens Arknights Tag details with a valid editable type", () => {
    act(() => root.render(createElement(App)));
    const tagTitle = container.querySelector<HTMLButtonElement>(
      '[data-component-id="arknights-tag"] .component-tile__name',
    );

    act(() => tagTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector(".art--arknights-tag button")?.textContent).toBe(
      "INFO / CLICK",
    );
    expect(container.querySelector<HTMLSelectElement>(".property-editor select")?.value).toBe("info");
    expect(container.querySelector(".dialog-usage-box code")?.textContent).toBe(
      '<ArknightsTag type="info" />',
    );
  });

  it("includes event handlers as empty attributes without making them editable", () => {
    act(() => root.render(createElement(App)));
    const errorTitle = container.querySelector<HTMLButtonElement>(
      '[data-component-id="static-404"] .component-tile__name',
    );

    act(() => errorTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.querySelector(".dialog-usage-box code")?.textContent).toBe(
      '<Static404 onGoBack="" />',
    );
    expect(
      container.querySelector(".property-editor input, .property-editor select"),
    ).toBeNull();
  });

  it("includes each handler from grouped callback properties", () => {
    act(() => root.render(createElement(App)));
    const draggableTitle = container.querySelector<HTMLButtonElement>(
      '[data-component-id="draggable"] .component-tile__name',
    );

    act(() => draggableTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const usage = container.querySelector(".dialog-usage-box code")?.textContent;
    expect(usage).toContain('onDragStart=""');
    expect(usage).toContain('onDragging=""');
    expect(usage).toContain('onDragEnd=""');
    expect(usage).toContain('onAdsorbed=""');
    expect(usage).toContain('onMove=""');
    expect(usage).toContain('onClick=""');

    const callbackRow = [...container.querySelectorAll(".property-row")].find(
      (row) => row.querySelector("dt")?.textContent?.includes("onDragStart"),
    );
    expect(
      callbackRow?.querySelector(".property-editor input, .property-editor select"),
    ).toBeNull();
  });

  it("renders the special and richtext previews in the gallery", () => {
    act(() => root.render(createElement(App)));

    expect(container.querySelector("[data-component-id='special-animated-search'] .special-search--classic")).not.toBeNull();
    expect(container.querySelector("[data-component-id='special-carousel-scene'] .special-carousel-scene")).not.toBeNull();
    expect(container.querySelector("[data-component-id='rolling-text'] .rolling-text")).not.toBeNull();
    expect(container.querySelector("[data-component-id='animated-text-fill'] .animated-text-fill")).not.toBeNull();
    expect(container.querySelector("[data-component-id='ma-markdown'] .markdown-editor")).not.toBeNull();

    const carouselTitle = container.querySelector<HTMLButtonElement>(
      "[data-component-id='special-carousel-scene'] .component-tile__name",
    );
    act(() => carouselTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector(".component-dialog--wide .special-carousel-scene")).not.toBeNull();
    const cellsRow = [...container.querySelectorAll<HTMLElement>(".property-row")]
      .find((row) => row.querySelector("dt")?.textContent === "cells");
    expect(cellsRow?.querySelector<HTMLInputElement>(".property-editor input")?.value).toBe("7");
    expect(container.querySelector(".dialog-usage-box code")?.textContent).toContain("cells={7}");
  });

  it("renders an interactive and a disabled MASwitch preview", () => {
    act(() => root.render(createElement(App)));
    const switchCard = container.querySelector('[data-component-id="ma-switch"]');
    const switches = switchCard?.querySelectorAll<HTMLElement>('[role="switch"]');

    expect(switches).toHaveLength(2);
    expect(switches?.[0].getAttribute("aria-checked")).toBe("false");
    act(() => switches?.[0].dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(switches?.[0].getAttribute("aria-checked")).toBe("true");
    expect(switches?.[1].getAttribute("aria-disabled")).toBe("true");
  });

  it("includes boolean and grouped string defaults in the usage template", () => {
    act(() => root.render(createElement(App)));
    const switchTitle = container.querySelector<HTMLButtonElement>(
      '[data-component-id="ma-switch"] .component-tile__name',
    );

    act(() => switchTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const checkedRow = [...container.querySelectorAll<HTMLElement>(".property-row")]
      .find((row) => row.querySelector("dt")?.textContent === "checked");
    expect(checkedRow?.querySelector<HTMLInputElement>("input[type=checkbox]")?.checked).toBe(false);
    expect(container.querySelector(".dialog-usage-box code")?.textContent).toContain(
      'checked={false}',
    );
    expect(container.querySelector(".dialog-usage-box code")?.textContent).toContain(
      'label="NETWORK UPLINK"',
    );
    expect(container.querySelector(".dialog-usage-box code")?.textContent).toContain(
      'openText="ON"',
    );
  });

  it("keeps the poster text fill separate from its chromatic outline layers", () => {
    act(() => root.render(createElement(App)));

    const chromaticText = container.querySelector<HTMLElement>(
      '[data-component-id="chromatic-text"] .chromatic',
    );

    expect(chromaticText?.getAttribute("data-text")).toBe("SIGNAL");
    expect(chromaticText?.querySelector(".chromatic__base")?.textContent).toBe("SIGNAL");
  });

  it("preserves component defaults when opening details", () => {
    act(() => root.render(createElement(App)));
    const textTitle = container.querySelector<HTMLButtonElement>(
      '[data-component-id="chromatic-text"] .component-tile__name',
    );

    act(() => textTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(
      container.querySelector(".dialog-preview .chromatic")?.getAttribute("data-text"),
    ).toBe("SIGNAL");
    const contentRow = [...container.querySelectorAll<HTMLElement>(".property-row")]
      .find((row) => row.querySelector("dt")?.textContent === "content");
    expect(
      contentRow?.querySelector<HTMLInputElement>(".property-editor input")?.value,
    ).toBe("SIGNAL");
    expect(container.querySelector(".dialog-usage-box code")?.textContent).toBe(
      '<ChromaticPosterText content="SIGNAL" />',
    );
  });

  it("keeps the timeline interactive and renders the animated Waves track", () => {
    act(() => root.render(createElement(App)));

    const timelineCount = container.querySelector(".timeline-count");
    expect(timelineCount?.textContent).toContain("1 / 4");

    const nextButton = container.querySelector<HTMLButtonElement>(".timeline-nav--next");
    act(() => nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(timelineCount?.textContent).toContain("2 / 4");

    const waveTrack = container.querySelector<HTMLElement>(".bg-content-box");
    expect(waveTrack).not.toBeNull();
    expect(waveTrack?.querySelectorAll("img.bg")).toHaveLength(2);
  });

  it("keeps the magnetic pointer aligned to viewport mouse coordinates", () => {
    act(() => root.render(createElement(App)));
    const pointer = document.body.querySelector<HTMLElement>(".magnetic-pointer");
    const target = container.querySelector<HTMLElement>("[data-gallery-target]");

    expect(pointer?.parentElement).toBe(document.body);
    expect(pointer?.style.visibility).toBe("hidden");

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 240, clientY: 120 }));
    });

    expect(pointer?.style.getPropertyValue("--x")).toBe("240px");
    expect(pointer?.style.getPropertyValue("--y")).toBe("120px");

    act(() => target?.dispatchEvent(new MouseEvent("mouseenter")));
    expect(pointer?.style.visibility).toBe("");
  });
});