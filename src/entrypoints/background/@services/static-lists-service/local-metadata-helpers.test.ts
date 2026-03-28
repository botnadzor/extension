import { describe, expect, it } from "vitest";

import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

import {
  reconcileLocalMetadataWithRowsState,
  type StaticListLocalRowsState,
} from "./local-metadata-helpers";

function metadataWithLocalUpdatedAt() {
  return {
    listId: "announcements" as const,
    physicalStorageVersion: 1,
    derivedDataVersion: "test",
    combiningMode: "remoteOnly" as const,
    remoteActiveInstance: "b" as const,
    localUpdatedAt: isoDateTimeSchema.parse("2026-03-28T14:45:24.883Z"),
  };
}

function expectRecoveredState(localRowsState: StaticListLocalRowsState) {
  const result = reconcileLocalMetadataWithRowsState(
    metadataWithLocalUpdatedAt(),
    localRowsState,
  );

  expect(result.metadata).toEqual({
    listId: "announcements",
    physicalStorageVersion: 1,
    derivedDataVersion: "test",
    combiningMode: "remoteOnly",
    remoteActiveInstance: "b",
  });
  expect(Object.hasOwn(result.metadata, "localUpdatedAt")).toBe(false);

  return result;
}

describe("reconcileLocalMetadataWithRowsState", () => {
  it("clears stale local metadata when the local database is missing", () => {
    const result = expectRecoveredState("missing");
    expect(result.recovery).toBe("missing");
  });

  it("clears stale local metadata when the local database is empty", () => {
    const result = expectRecoveredState("empty");
    expect(result.recovery).toBe("empty");
  });

  it("preserves local metadata when local rows are present", () => {
    const metadata = metadataWithLocalUpdatedAt();

    const result = reconcileLocalMetadataWithRowsState(metadata, "present");

    expect(result.recovery).toBeUndefined();
    expect(result.metadata).toEqual(metadata);
  });

  it.each(["missing", "empty", "present"] as const)(
    "leaves metadata unchanged when there is no local timestamp to recover (%s)",
    (localRowsState) => {
      const metadata = {
        listId: "announcements" as const,
        physicalStorageVersion: 1,
        derivedDataVersion: "test",
        combiningMode: "remoteOnly" as const,
        remoteActiveInstance: "b" as const,
      };

      const result = reconcileLocalMetadataWithRowsState(
        metadata,
        localRowsState,
      );

      expect(result.recovery).toBeUndefined();
      expect(result.metadata).toEqual(metadata);
    },
  );
});
