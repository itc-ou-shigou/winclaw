import process from "node:process";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { installUnhandledRejectionHandler } from "./unhandled-rejections.js";

describe("installUnhandledRejectionHandler - fatal detection", () => {
  let exitCalls: Array<string | number | null> = [];
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let originalExit: typeof process.exit;

  beforeAll(() => {
    originalExit = process.exit.bind(process);
    installUnhandledRejectionHandler();
  });

  beforeEach(() => {
    exitCalls = [];

    vi.spyOn(process, "exit").mockImplementation((code?: string | number | null): never => {
      if (code !== undefined && code !== null) {
        exitCalls.push(code);
      }
      return undefined as never;
    });

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  afterAll(() => {
    process.exit = originalExit;
  });

  function emitUnhandled(reason: unknown): void {
    process.emit("unhandledRejection", reason, Promise.resolve());
  }

  function expectExitCodeFromUnhandled(reason: unknown, expected: number[]): void {
    exitCalls = [];
    emitUnhandled(reason);
    expect(exitCalls).toEqual(expected);
  }

  describe("fatal errors", () => {
    it("exits on fatal runtime codes", () => {
      const fatalCases = [
        { code: "ERR_OUT_OF_MEMORY", message: "Out of memory" },
        { code: "ERR_SCRIPT_EXECUTION_TIMEOUT", message: "Script execution timeout" },
        { code: "ERR_WORKER_OUT_OF_MEMORY", message: "Worker out of memory" },
      ] as const;

      for (const { code, message } of fatalCases) {
        expectExitCodeFromUnhandled(Object.assign(new Error(message), { code }), [1]);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[winclaw] FATAL unhandled rejection:",
        expect.stringContaining("Out of memory"),
      );
    });
  });

  describe("configuration errors", () => {
    it("exits on configuration error codes", () => {
      const configurationCases = [
        { code: "INVALID_CONFIG", message: "Invalid config" },
        { code: "MISSING_API_KEY", message: "Missing API key" },
      ] as const;

      for (const { code, message } of configurationCases) {
        expectExitCodeFromUnhandled(Object.assign(new Error(message), { code }), [1]);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[winclaw] CONFIGURATION ERROR - requires fix:",
        expect.stringContaining("Invalid config"),
      );
    });
  });

  describe("non-fatal errors", () => {
    it("does not exit on known transient network errors", () => {
      const transientCases = [
        Object.assign(new TypeError("fetch failed"), {
          cause: { code: "UND_ERR_CONNECT_TIMEOUT", syscall: "connect" },
        }),
        Object.assign(new Error("DNS resolve failed"), { code: "UND_ERR_DNS_RESOLVE_FAILED" }),
        Object.assign(new Error("Connection reset"), { code: "ECONNRESET" }),
        Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" }),
        Object.assign(new Error("A request error occurred: getaddrinfo EAI_AGAIN slack.com"), {
          code: "slack_webapi_request_error",
          original: { code: "EAI_AGAIN", syscall: "getaddrinfo", hostname: "slack.com" },
        }),
      ];

      for (const transientErr of transientCases) {
        expectExitCodeFromUnhandled(transientErr, []);
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[winclaw] Non-fatal unhandled rejection (continuing):",
        expect.stringContaining("fetch failed"),
      );
    });

    it("exits on generic errors without code", () => {
      const genericErr = new Error("Something went wrong");

      expectExitCodeFromUnhandled(genericErr, [1]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[winclaw] Unhandled promise rejection:",
        expect.stringContaining("Something went wrong"),
      );
    });

    it("does not exit on AbortError and logs suppression warning", () => {
      const abortErr = new Error("This operation was aborted");
      abortErr.name = "AbortError";

      expectExitCodeFromUnhandled(abortErr, []);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[winclaw] Suppressed AbortError:",
        expect.stringContaining("This operation was aborted"),
      );
    });
  });

  describe("Playwright internal errors", () => {
    it("does NOT exit on Playwright FrameManager assertion error", () => {
      const assertionErr = new Error("Assertion error");
      assertionErr.stack = [
        "Error: Assertion error",
        "    at assert (playwright-core/lib/utils/isomorphic/assert.js:26:11)",
        "    at FrameManager.frameAttached (playwright-core/lib/server/frames.js:114:31)",
        "    at FrameSession._onFrameAttached (playwright-core/lib/server/chromium/crPage.js:503:29)",
      ].join("\n");

      process.emit("unhandledRejection", assertionErr, Promise.resolve());

      expect(exitCalls).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[winclaw] Suppressed Playwright internal error (continuing):",
        expect.stringContaining("Assertion error"),
      );
    });

    it("does NOT exit on Playwright 'Frame was detached' error", () => {
      const frameErr = new Error("Frame was detached");
      frameErr.stack = [
        "Error: Frame was detached",
        "    at Frame.click (playwright-core/lib/server/frames.js:200:10)",
      ].join("\n");

      process.emit("unhandledRejection", frameErr, Promise.resolve());

      expect(exitCalls).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[winclaw] Suppressed Playwright internal error (continuing):",
        expect.stringContaining("Frame was detached"),
      );
    });

    it("does NOT exit on Playwright 'Target closed' error", () => {
      const targetErr = new Error("Target closed");
      targetErr.stack = [
        "Error: Target closed",
        "    at CDPSession.send (playwright-core/lib/server/chromium/crConnection.js:100:15)",
      ].join("\n");

      process.emit("unhandledRejection", targetErr, Promise.resolve());

      expect(exitCalls).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("still exits on non-Playwright assertion errors", () => {
      const genericAssertionErr = new Error("Assertion error");
      // No playwright in the stack
      genericAssertionErr.stack = [
        "Error: Assertion error",
        "    at myFunction (app/src/something.js:10:5)",
      ].join("\n");

      process.emit("unhandledRejection", genericAssertionErr, Promise.resolve());

      expect(exitCalls).toEqual([1]);
    });
  });
});
