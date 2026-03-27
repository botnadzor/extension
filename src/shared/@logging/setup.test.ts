import { describe, expect, it, vi } from "vitest";

import { getConsoleSnapshot } from "./setup";

vi.mock("../@model/extension-version", () => ({
  baseExtensionVersionInfo: {
    buildInfo: {
      browser: "firefox",
      mode: "production",
      target: "firefox-mv3",
    },
    lifecycle: "release",
    version: "0.0.0",
    versionName: "0.0.0",
  },
}));

describe("getConsoleSnapshot", () => {
  it("returns own bound methods on a plain console-like object", () => {
    const snapshot = getConsoleSnapshot();

    // This locks in the plain-object shape that Firefox accepts when LogTape
    // reads methods like `warn` from the console sink.
    expect(snapshot).not.toBe(globalThis.console);
    expect(Object.getPrototypeOf(snapshot)).toBe(globalThis.console);

    for (const method of ["debug", "error", "info", "log", "warn"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(snapshot, method);

      expect(descriptor?.value).toBe(snapshot[method]);
      expect(snapshot[method]).not.toBe(globalThis.console[method]);
    }
  });
});
