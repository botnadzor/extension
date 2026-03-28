import { describe, expect, it } from "vitest";

import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

import {
  analyzeRemoteStagingTailRows,
  reconcileRemoteStagingMetadataWithRowsState,
  shouldVerifyResumedLine,
} from "./remote-metadata-helpers";

function metadataWithRemoteStaging() {
  return {
    listId: "announcements" as const,
    physicalStorageVersion: 1,
    derivedDataVersion: "test",
    combiningMode: "remoteOnly" as const,
    remoteActiveInstance: "b" as const,
    remoteStaging: {
      durableLineNumber: 25,
      startedAt: isoDateTimeSchema.parse("2026-03-28T14:45:24.883Z"),
      summary: { itemCount: 25 },
      updatedAt: isoDateTimeSchema.parse("2026-03-28T14:45:25.883Z"),
      upstreamInfo: {
        generatedAt: isoDateTimeSchema.parse("2026-03-28T14:45:24.883Z"),
        itemCount: 100,
      },
    },
  };
}

describe("reconcileRemoteStagingMetadataWithRowsState", () => {
  it("preserves staging when metadata and rows are present", () => {
    const metadata = metadataWithRemoteStaging();

    const result = reconcileRemoteStagingMetadataWithRowsState(
      metadata,
      "present",
    );

    expect(result.recovery).toBeUndefined();
    expect(result.metadata).toEqual(metadata);
  });

  it("clears stale staging metadata when rows are missing", () => {
    const result = reconcileRemoteStagingMetadataWithRowsState(
      metadataWithRemoteStaging(),
      "missing",
    );

    expect(result.recovery).toBe("missing");
    expect(Object.hasOwn(result.metadata, "remoteStaging")).toBe(false);
  });

  it("clears stale staging metadata when rows are empty", () => {
    const result = reconcileRemoteStagingMetadataWithRowsState(
      metadataWithRemoteStaging(),
      "empty",
    );

    expect(result.recovery).toBe("empty");
    expect(Object.hasOwn(result.metadata, "remoteStaging")).toBe(false);
  });

  it("marks present rows without metadata as orphaned", () => {
    const result = reconcileRemoteStagingMetadataWithRowsState(
      {
        listId: "announcements" as const,
        physicalStorageVersion: 1,
        derivedDataVersion: "test",
        combiningMode: "remoteOnly" as const,
        remoteActiveInstance: "b" as const,
      },
      "present",
    );

    expect(result.recovery).toBe("orphaned");
  });
});

describe("analyzeRemoteStagingTailRows", () => {
  it("accepts a fully synced durable cursor", () => {
    expect(
      analyzeRemoteStagingTailRows({
        durableLineNumber: 100,
        headLineNumber: 100,
        tailLineNumbers: [],
      }),
    ).toEqual({ success: true, repairedLineCount: 0 });
  });

  it("accepts a small contiguous tail ahead of metadata", () => {
    expect(
      analyzeRemoteStagingTailRows({
        durableLineNumber: 100,
        headLineNumber: 103,
        tailLineNumbers: [101, 102, 103],
      }),
    ).toEqual({ success: true, repairedLineCount: 3 });
  });

  it("rejects durable metadata ahead of rows", () => {
    expect(
      analyzeRemoteStagingTailRows({
        durableLineNumber: 101,
        headLineNumber: 100,
        tailLineNumbers: [],
      }),
    ).toEqual({ success: false, reason: "durableAheadOfRows" });
  });

  it("rejects non-contiguous repair tails", () => {
    expect(
      analyzeRemoteStagingTailRows({
        durableLineNumber: 100,
        headLineNumber: 103,
        tailLineNumbers: [101, 103],
      }),
    ).toEqual({ success: false, reason: "nonContiguousTail" });
  });
});

describe("shouldVerifyResumedLine", () => {
  const durableLineNumber = 2500;
  const stride = 1000;

  it("always verifies the first line", () => {
    expect(
      shouldVerifyResumedLine({ durableLineNumber, lineNumber: 1, stride }),
    ).toBe(true);
  });

  it("verifies configured stride checkpoints", () => {
    expect(
      shouldVerifyResumedLine({ durableLineNumber, lineNumber: 1000, stride }),
    ).toBe(true);
  });

  it("always verifies the durable boundary line", () => {
    expect(
      shouldVerifyResumedLine({
        durableLineNumber,
        lineNumber: durableLineNumber,
        stride,
      }),
    ).toBe(true);
  });

  it("skips unsampled interior lines", () => {
    expect(
      shouldVerifyResumedLine({ durableLineNumber, lineNumber: 999, stride }),
    ).toBe(false);
  });

  it("ignores lines beyond the resumed prefix", () => {
    expect(
      shouldVerifyResumedLine({
        durableLineNumber,
        lineNumber: durableLineNumber + 1,
        stride,
      }),
    ).toBe(false);
  });
});
