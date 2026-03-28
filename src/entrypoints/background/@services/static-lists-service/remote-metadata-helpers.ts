import type { StaticListMetadata } from "@/shared/@model/static-list-metadata";
import type { StaticListId } from "@/shared/@model/static-lists";

export function omitRemoteStaging<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
): StaticListMetadata<ListId> {
  const { remoteStaging: remoteStagingOmitted, ...metadataWithoutRemote } =
    metadata;
  void remoteStagingOmitted;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- removing an exact-optional property via rest is correct at runtime but TS loses that shape
  return metadataWithoutRemote as StaticListMetadata<ListId>;
}

export type StaticListRemoteRowsState = "missing" | "empty" | "present";

export function reconcileRemoteStagingMetadataWithRowsState<
  ListId extends StaticListId,
>(
  metadata: StaticListMetadata<ListId>,
  remoteRowsState: StaticListRemoteRowsState,
): {
  metadata: StaticListMetadata<ListId>;
  recovery?: StaticListRemoteRowsState | "orphaned";
} {
  if (metadata.remoteStaging) {
    if (remoteRowsState === "present") {
      return { metadata };
    }

    return {
      metadata: omitRemoteStaging(metadata),
      recovery: remoteRowsState,
    };
  }

  if (remoteRowsState === "missing") {
    return { metadata };
  }

  return { metadata, recovery: "orphaned" };
}

export function shouldVerifyResumedLine({
  durableLineNumber,
  lineNumber,
  stride,
}: {
  durableLineNumber: number;
  lineNumber: number;
  stride: number;
}): boolean {
  if (
    durableLineNumber <= 0 ||
    lineNumber <= 0 ||
    lineNumber > durableLineNumber
  ) {
    return false;
  }

  return (
    lineNumber === 1 ||
    lineNumber === durableLineNumber ||
    lineNumber % stride === 0
  );
}

export function analyzeRemoteStagingTailRows({
  durableLineNumber,
  headLineNumber,
  tailLineNumbers,
}: {
  durableLineNumber: number;
  headLineNumber: number;
  tailLineNumbers: number[];
}):
  | {
      success: true;
      repairedLineCount: number;
    }
  | {
      success: false;
      reason: "durableAheadOfRows" | "nonContiguousTail";
    } {
  if (durableLineNumber > headLineNumber) {
    return { success: false, reason: "durableAheadOfRows" };
  }

  let expectedLineNumber = durableLineNumber + 1;

  for (const lineNumber of tailLineNumbers) {
    if (lineNumber !== expectedLineNumber) {
      return { success: false, reason: "nonContiguousTail" };
    }

    expectedLineNumber += 1;
  }

  if (expectedLineNumber - 1 !== headLineNumber) {
    return { success: false, reason: "nonContiguousTail" };
  }

  return {
    success: true,
    repairedLineCount: headLineNumber - durableLineNumber,
  };
}
