import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/utils/logger";

describe("createLogger", () => {
  it("logs warnings and errors while debug mode is disabled", () => {
    const consoleMock = {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    } as unknown as Console;
    const logger = createLogger({ console: consoleMock, enabled: false });

    logger.error("error");
    logger.warn("warn");
    logger.log("log");

    expect(consoleMock.error).toHaveBeenCalledOnce();
    expect(consoleMock.warn).toHaveBeenCalledOnce();
    expect(consoleMock.log).not.toHaveBeenCalled();
  });

  it("continues to gate other methods on debug mode", () => {
    const consoleMock = {
      debug: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
      trace: vi.fn(),
    } as unknown as Console;
    const logger = createLogger({ console: consoleMock, enabled: false });

    logger.debug("debug");
    logger.info("info");
    logger.log("log");
    logger.trace("trace");

    expect(consoleMock.debug).not.toHaveBeenCalled();
    expect(consoleMock.info).not.toHaveBeenCalled();
    expect(consoleMock.log).not.toHaveBeenCalled();
    expect(consoleMock.trace).not.toHaveBeenCalled();
  });
});
