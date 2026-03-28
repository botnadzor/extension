import type { StaticListMetadata } from "@/shared/@model/static-list-metadata";
import type { StaticListId } from "@/shared/@model/static-lists";

export function omitLocalUpdatedAt<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
): StaticListMetadata<ListId> {
  const { localUpdatedAt: localUpdatedAtOmitted, ...metadataWithoutLocal } =
    metadata;
  void localUpdatedAtOmitted;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- removing an exact-optional property via rest is correct at runtime but TS loses that shape
  return metadataWithoutLocal as StaticListMetadata<ListId>;
}

export type StaticListLocalRowsState = "missing" | "empty" | "present";

export function reconcileLocalMetadataWithRowsState<
  ListId extends StaticListId,
>(
  metadata: StaticListMetadata<ListId>,
  localRowsState: StaticListLocalRowsState,
): {
  metadata: StaticListMetadata<ListId>;
  recovery?: Exclude<StaticListLocalRowsState, "present">;
} {
  if (!metadata.localUpdatedAt || localRowsState === "present") {
    return { metadata };
  }

  return {
    metadata: omitLocalUpdatedAt(metadata),
    recovery: localRowsState,
  };
}
