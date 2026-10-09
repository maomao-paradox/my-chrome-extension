import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  onChange: null as ((url: string, previousUrl: string) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock("@/document-api/route-watcher", () => ({
  useRouteWatcher: (callback: (url: string, previousUrl: string) => void) => {
    routeMocks.onChange = callback;
    return routeMocks.unsubscribe;
  },
}));

vi.mock("@/components/content-feature-panel/main", () => ({
  createContentFeaturePanel: vi.fn(),
}));

vi.mock("@/message", () => ({
  default: { ext: { listen: vi.fn() } },
}));

import { createContentFeatureRegistry } from "@/content/runtime/content-feature-manager";
import { CONTENT_FEATURE_CONFIG_PREFIX } from "@/content/runtime/content-feature-manager";

describe("content feature route restart", () => {
  beforeEach(() => {
    localStorage.clear();
    routeMocks.onChange = null;
    routeMocks.unsubscribe.mockClear();
  });

  it("restarts opted-in features after cleaning them up", async () => {
    const scriptId = "route-restart-test";
    localStorage.setItem(
      `${CONTENT_FEATURE_CONFIG_PREFIX}${scriptId}`,
      JSON.stringify({ routeFeature: true, stableFeature: true }),
    );

    const routeCleanup = vi.fn();
    const routeSetup = vi.fn(() => routeCleanup);
    const stableSetup = vi.fn();
    const registry = createContentFeatureRegistry({
      scriptId,
      scriptName: "Route restart test",
    });

    registry.register("routeFeature", "路由功能", routeSetup, {
      restartOnRouteChange: true,
    });
    registry.register("stableFeature", "常驻功能", stableSetup);
    await registry.initialize();

    expect(routeSetup).toHaveBeenCalledTimes(1);
    expect(stableSetup).toHaveBeenCalledTimes(1);

    routeMocks.onChange?.("http://localhost/next", "http://localhost/");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(routeCleanup).toHaveBeenCalledTimes(1);
    expect(routeSetup).toHaveBeenCalledTimes(2);
    expect(stableSetup).toHaveBeenCalledTimes(1);
  });
});