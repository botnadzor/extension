import { describe, expect, it } from "vitest";

import type { StaticListMetadata } from "@/shared/@model/static-list-metadata";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

import { deriveStaticListsDataIssueState } from "./data-issue-state";

function createMetadata({
  hasRemoteActive = false,
  hasRemoteUpdateIssue = false,
}: {
  hasRemoteActive?: boolean;
  hasRemoteUpdateIssue?: boolean;
} = {}): StaticListMetadata<"announcements"> {
  return {
    listId: "announcements",
    physicalStorageVersion: 1,
    derivedDataVersion: "test",
    combiningMode: "remoteOnly",
    remoteActiveInstance: "b",
    ...(hasRemoteActive
      ? {
          remoteActive: {
            startedAt: isoDateTimeSchema.parse("2026-03-29T10:00:00.000Z"),
            summary: { itemCount: 10 },
            updatedAt: isoDateTimeSchema.parse("2026-03-29T10:00:01.000Z"),
            upstreamInfo: {
              generatedAt: isoDateTimeSchema.parse("2026-03-29T10:00:00.000Z"),
              itemCount: 10,
            },
          },
        }
      : {}),
    ...(hasRemoteUpdateIssue
      ? {
          remoteUpdateIssue: {
            failedAt: isoDateTimeSchema.parse("2026-03-29T10:05:00.000Z"),
            kind: "quotaExceeded",
            stage: "writeRows",
            upstreamInfo: {
              generatedAt: isoDateTimeSchema.parse("2026-03-29T10:04:00.000Z"),
              itemCount: 12,
            },
          },
        }
      : {}),
  };
}

describe("deriveStaticListsDataIssueState", () => {
  it("returns none when no lists are quota-blocked", () => {
    expect(
      deriveStaticListsDataIssueState([
        createMetadata({ hasRemoteActive: true }),
        createMetadata(),
      ]),
    ).toEqual({ kind: "none" });
  });

  it("treats blocked lists without active data as unavailable", () => {
    expect(
      deriveStaticListsDataIssueState([
        createMetadata({ hasRemoteUpdateIssue: true }),
      ]),
    ).toEqual({ kind: "initialDataUnavailable" });
  });

  it("treats blocked lists with active data as stale-but-usable", () => {
    expect(
      deriveStaticListsDataIssueState([
        createMetadata({
          hasRemoteActive: true,
          hasRemoteUpdateIssue: true,
        }),
      ]),
    ).toEqual({ kind: "updatesBlockedButExistingDataUsable" });
  });

  it("prioritizes unavailable data when blocked states are mixed", () => {
    expect(
      deriveStaticListsDataIssueState([
        createMetadata({
          hasRemoteActive: true,
          hasRemoteUpdateIssue: true,
        }),
        createMetadata({ hasRemoteUpdateIssue: true }),
      ]),
    ).toEqual({ kind: "initialDataUnavailable" });
  });
});
