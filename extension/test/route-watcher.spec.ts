import { afterEach, describe, expect, it, vi } from "vitest";
import { routeWatcher } from "@/document-api/route-watcher";

describe("routeWatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects History API navigation that bypasses the instance wrapper", async () => {
    vi.useFakeTimers();
    const watcher = routeWatcher!;
    const onRouteChange = vi.fn();
    const previousUrl = window.location.href;
    const nextUrl = new URL("/route-watcher-test", previousUrl);
    const unsubscribe = watcher.subscribe(onRouteChange);

    History.prototype.pushState.call(window.history, {}, "", nextUrl.href);
    await vi.advanceTimersByTimeAsync(100);

    expect(onRouteChange).toHaveBeenCalledWith(nextUrl.href, previousUrl);

    unsubscribe();
    window.history.replaceState({}, "", previousUrl);
  });
});