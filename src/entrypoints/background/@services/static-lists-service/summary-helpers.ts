import type { WritableDeep } from "type-fest";

import type { StaticListMetadata } from "@/shared/@model/static-list-metadata";
import type {
  StaticListId,
  StaticListSummary,
} from "@/shared/@model/static-lists";

import { getStaticListDefinitionInfo } from "./definition-helpers";
import { interpretStoredRow } from "./interpretation";
import type { StoredLocalRow, StoredRemoteRow } from "./types";

export function createEmptySummary<ListId extends StaticListId>(
  listId: ListId,
): StaticListSummary<ListId> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the definition lookup is keyed by the same list id used to select the summary type
  return getStaticListDefinitionInfo(
    listId,
  ).definition.createEmptySummary() as StaticListSummary<ListId>;
}

export function cloneEmptySummary<ListId extends StaticListId>(
  listId: ListId,
): WritableDeep<StaticListSummary<ListId>> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structuredClone preserves the validated summary shape while WritableDeep models in-place adjustments
  return structuredClone(createEmptySummary(listId)) as WritableDeep<
    StaticListSummary<ListId>
  >;
}

export function tryInterpretSummaryItemDelta<ListId extends StaticListId>(
  listId: ListId,
  mutableSummary: WritableDeep<StaticListSummary<ListId>>,
  storedRow: StoredLocalRow | StoredRemoteRow,
  origin: "remote" | "local" | "localOverride",
  delta: 1 | -1,
): void {
  const interpretedRow = interpretStoredRow(listId, storedRow, origin);
  if (!interpretedRow.interpretation.success) {
    return;
  }

  getStaticListDefinitionInfo(listId).definition.adjustSummary(
    mutableSummary,
    interpretedRow.interpretation.item,
    delta,
  );
}

export function withUpdatedDerivedDataVersion<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
): StaticListMetadata<ListId> {
  const definition = getStaticListDefinitionInfo(metadata.listId).definition;

  return {
    ...metadata,
    physicalStorageVersion: definition.physicalStorageVersion,
    derivedDataVersion: definition.derivedDataVersion,
  };
}
