import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import DebugModeSetting from "../src/pages/popup/components/DebugModeSetting";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Popup debug mode setting", () => {
  it("loads the saved value and updates extensionSettings without dropping other settings", async () => {
    vi.spyOn(chrome.storage.local, "get").mockResolvedValue({
      extensionSettings: { debugMode: false, autoCheckUpdate: true },
    });
    const setSpy = vi
      .spyOn(chrome.storage.local, "set")
      .mockResolvedValue(undefined);

    render(<DebugModeSetting />);

    const debugModeSwitch = await screen.findByRole("switch", {
      name: "调试模式",
    });
    expect(debugModeSwitch.getAttribute("aria-checked")).toBe("false");
    expect(debugModeSwitch.getAttribute("aria-disabled")).toBe("false");

    fireEvent.click(debugModeSwitch);

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith({
        extensionSettings: { debugMode: true, autoCheckUpdate: true },
      });
    });
    await waitFor(() => {
      expect(debugModeSwitch.getAttribute("aria-checked")).toBe("true");
    });
  });

  it("shows a retry action if the saved setting cannot be read", async () => {
    vi.spyOn(chrome.storage.local, "get").mockRejectedValue(
      new Error("storage unavailable"),
    );

    render(<DebugModeSetting />);

    expect(await screen.findByRole("button", { name: "重新读取" })).toBeTruthy();
    expect(screen.getByText("读取失败，请重试")).toBeTruthy();
  });

  it("keeps the previous value and reports an error if saving fails", async () => {
    vi.spyOn(chrome.storage.local, "get").mockResolvedValue({
      extensionSettings: { debugMode: false },
    });
    vi.spyOn(chrome.storage.local, "set").mockRejectedValue(
      new Error("storage unavailable"),
    );

    render(<DebugModeSetting />);

    const debugModeSwitch = await screen.findByRole("switch", {
      name: "调试模式",
    });
    fireEvent.click(debugModeSwitch);

    expect(await screen.findByText("保存失败，请重试")).toBeTruthy();
    expect(debugModeSwitch.getAttribute("aria-checked")).toBe("false");
  });
});
