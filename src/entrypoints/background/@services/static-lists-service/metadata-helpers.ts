import type {
  StaticListCombiningMode,
  StaticListRemoteInstance,
} from "@/shared/@model/static-list-helpers";
import {
  type StaticListMetadata,
  staticListMetadataSchema,
  type StoredStaticListMetadata,
} from "@/shared/@model/static-list-metadata";
import {
  staticListDefinitionLookup,
  type StaticListId,
  type StaticListSummary,
} from "@/shared/@model/static-lists";
import type { IsoDateTime } from "@/shared/@primitives/temporal";

import {
  defineStoreWithSchema,
  type StoreWithSchema,
} from "../../@service-helpers/store-with-schema";

const metadataStoreByListId: Partial<
  Record<StaticListId, StoreWithSchema<typeof staticListMetadataSchema>>
> = {};

/**
 * Metadata stays per-list and deliberately small.
 *
 * Local and combined summaries are cheap to recompute and are only useful in
 * dev-only combining modes, so persisting them would make production users pay
 * ongoing write/read complexity for state they never consume.
 */
export function getStaticListMetadataStore(
  listId: StaticListId,
): StoreWithSchema<typeof staticListMetadataSchema> {
  metadataStoreByListId[listId] ??= defineStoreWithSchema(
    `local:static-list-metadata:${listId}`,
    staticListMetadataSchema,
  );

  return metadataStoreByListId[listId];
}

/**
 * New lists start in `remoteOnly` so the production path has zero dependency on
 * local/combined features until a developer opts in.
 *
 * The active instance starts at `b` so the first real download stages into `a`
 * and uses the same promotion logic as every later refresh.
 */
export function createDefaultStaticListMetadata<ListId extends StaticListId>(
  listId: ListId,
): StaticListMetadata<ListId> {
  const definition = staticListDefinitionLookup[listId];

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the metadata envelope is keyed by the same list id passed into the helper
  return {
    listId,
    physicalStorageVersion: definition.physicalStorageVersion,
    derivedDataVersion: definition.derivedDataVersion,
    combiningMode: "remoteOnly",
    remoteActiveInstance: "b",
  } as StaticListMetadata<ListId>;
}

/**
 * Summary validation is part of metadata parsing rather than a second step.
 *
 * Once metadata leaves this helper, callers should be able to trust both the
 * envelope and the typed summary payloads. If persisted remote summaries are no
 * longer readable, the service falls back to remote-state recovery instead of
 * making every consumer re-parse `z.json()` payloads defensively.
 */
export function tryParseStaticListMetadata<ListId extends StaticListId>(
  listId: ListId,
  metadata: StoredStaticListMetadata,
): StaticListMetadata<ListId> | undefined {
  if (metadata.listId !== listId) {
    return undefined;
  }

  const definition = staticListDefinitionLookup[listId];

  const remoteActiveSummary = metadata.remoteActive
    ? definition.summarySchema.safeParse(metadata.remoteActive.summary)
    : undefined;
  if (remoteActiveSummary && !remoteActiveSummary.success) {
    return undefined;
  }

  const remoteStagingSummary = metadata.remoteStaging
    ? definition.summarySchema.safeParse(metadata.remoteStaging.summary)
    : undefined;
  if (remoteStagingSummary && !remoteStagingSummary.success) {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- summary schemas were validated above; we are re-attaching the list-specific parsed summary shape to the stored metadata envelope
  return {
    ...metadata,
    listId,
    ...(metadata.remoteActive
      ? {
          remoteActive: {
            ...metadata.remoteActive,
            summary:
              remoteActiveSummary?.data ??
              staticListDefinitionLookup[listId].createEmptySummary(),
          },
        }
      : {}),
    ...(metadata.remoteStaging
      ? {
          remoteStaging: {
            ...metadata.remoteStaging,
            summary:
              remoteStagingSummary?.data ??
              staticListDefinitionLookup[listId].createEmptySummary(),
          },
        }
      : {}),
  } as StaticListMetadata<ListId>;
}

export function extractSummaryFromMetadata<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
  source: "remoteActive" | "remoteStaging" = "remoteActive",
): StaticListSummary<ListId> {
  if (source === "remoteActive") {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- metadata.listId and the selected definition stay correlated through the generic helper boundary
    return (metadata.remoteActive?.summary ??
      staticListDefinitionLookup[
        metadata.listId
      ].createEmptySummary()) as StaticListSummary<ListId>;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- metadata.listId and the selected definition stay correlated through the generic helper boundary
  return (metadata.remoteStaging?.summary ??
    staticListDefinitionLookup[
      metadata.listId
    ].createEmptySummary()) as StaticListSummary<ListId>;
}

export function tryExtractSummaryFromMetadata<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
  source: "remoteActive" | "remoteStaging" = "remoteActive",
): StaticListSummary<ListId> | undefined {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- metadata.listId already determines the summary shape; this helper only selects the source
  return (
    source === "remoteActive"
      ? metadata.remoteActive?.summary
      : metadata.remoteStaging?.summary
  ) as StaticListSummary<ListId> | undefined;
}

export function extractUpdatedAtFromMetadata<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
): IsoDateTime | undefined {
  if (metadata.combiningMode === "remoteOnly") {
    return metadata.remoteActive?.updatedAt;
  }

  if (metadata.combiningMode === "localOnly") {
    return metadata.localUpdatedAt;
  }

  const remoteUpdatedAt = metadata.remoteActive?.updatedAt;
  const localUpdatedAt = metadata.localUpdatedAt;

  if (!remoteUpdatedAt) {
    return localUpdatedAt;
  }

  if (!localUpdatedAt) {
    return remoteUpdatedAt;
  }

  return [remoteUpdatedAt, localUpdatedAt].toSorted()[1];
}

export function pickAnotherRemoteInstance(
  instance: StaticListRemoteInstance,
): StaticListRemoteInstance {
  return instance === "a" ? "b" : "a";
}

export function shouldComputeDevSummaries(
  combiningMode: StaticListCombiningMode,
): boolean {
  return combiningMode !== "remoteOnly";
}
