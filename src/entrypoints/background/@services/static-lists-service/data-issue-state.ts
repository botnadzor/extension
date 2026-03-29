import type { StaticListMetadata } from "@/shared/@model/static-list-metadata";
import type { StaticListsDataIssueState } from "@/shared/@model/static-lists";

export function deriveStaticListsDataIssueState(
  metadataList: readonly StaticListMetadata[],
): StaticListsDataIssueState {
  const blockedMetadataList = metadataList.filter(
    (metadata) => metadata.remoteUpdateIssue?.kind === "quotaExceeded",
  );

  if (blockedMetadataList.length === 0) {
    return { kind: "none" };
  }

  if (blockedMetadataList.some((metadata) => !metadata.remoteActive)) {
    return { kind: "initialDataUnavailable" };
  }

  return { kind: "updatesBlockedButExistingDataUsable" };
}
