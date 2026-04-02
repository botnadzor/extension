import { describe, expect, it, vi } from "vitest";

import {
  createLoggingServiceSink,
  shouldAttachDisposeSymbolToFunctionSink,
} from "./logging-service-sink";

describe("shouldAttachDisposeSymbolToFunctionSink", () => {
  it("allows Symbol.dispose when runtime symbols are distinct", () => {
    expect(
      shouldAttachDisposeSymbolToFunctionSink({
        asyncDispose: Symbol("asyncDispose"),
        dispose: Symbol("dispose"),
      }),
    ).toBe(true);
  });

  it("disables Symbol.dispose when runtime aliases it with Symbol.asyncDispose", () => {
    const sharedSymbol = Symbol("sharedDispose");

    expect(
      shouldAttachDisposeSymbolToFunctionSink({
        asyncDispose: sharedSymbol,
        dispose: sharedSymbol,
      }),
    ).toBe(false);
  });
});

describe("createLoggingServiceSink", () => {
  it("attaches sync disposal in runtimes with distinct disposal symbols", () => {
    const sink = createLoggingServiceSink({
      registerRecords: vi.fn(),
    });

    expect(Object.getOwnPropertyDescriptor(sink, Symbol.dispose)).toBeDefined();
  });
});
