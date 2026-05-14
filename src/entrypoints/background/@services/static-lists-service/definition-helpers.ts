import type {
  StaticListDefinition,
  StaticListIndexDefinition,
} from "@/shared/@model/static-list-helpers";
import {
  staticListDefinitionLookup,
  type StaticListId,
  staticListIds,
} from "@/shared/@model/static-lists";

import type { StoredRowIndexSlotName } from "./types";

type StaticListIndexSlotDefinition = {
  slotName: StoredRowIndexSlotName;
  definition: StaticListIndexDefinition<unknown>;
};

export type StaticListDefinitionInfo = {
  listId: StaticListId;
  definition: StaticListDefinition;
  logicalPrimaryKeySlot: StaticListIndexSlotDefinition & { slotName: "p" };
  secondaryIndexSlots: StaticListIndexSlotDefinition[];
  allIndexSlots: StaticListIndexSlotDefinition[];
  publicIndexNames: string[];
  publicIndexNameToSlotName: Readonly<Record<string, StoredRowIndexSlotName>>;
};

const definitionInfoByListIdPartial: Partial<
  Record<StaticListId, StaticListDefinitionInfo>
> = {};

for (const listId of staticListIds) {
  const definition = staticListDefinitionLookup[listId];
  const logicalPrimaryKeySlot = {
    slotName: "p" as const,
    definition:
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- runtime definition registry intentionally erases per-list generics into shared slot metadata
      definition.logicalPrimaryKey as StaticListIndexDefinition<unknown>,
  };

  const secondaryIndexSlots = (
    definition.secondaryIndexes ?? []
  ).map<StaticListIndexSlotDefinition>((secondaryIndex, index) => ({
    slotName: `s${index + 1}`,
    definition: secondaryIndex,
  }));

  const allIndexSlots = [logicalPrimaryKeySlot, ...secondaryIndexSlots];
  const publicIndexNameToSlotNameEntries = allIndexSlots.map((indexSlot) => [
    indexSlot.definition.name,
    indexSlot.slotName,
  ]);

  definitionInfoByListIdPartial[listId] = {
    listId,
    definition,
    logicalPrimaryKeySlot,
    secondaryIndexSlots,
    allIndexSlots,
    publicIndexNames: allIndexSlots.map(
      (indexSlot) => indexSlot.definition.name,
    ),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.fromEntries cannot preserve the slot-name value type here
    publicIndexNameToSlotName: Object.fromEntries(
      publicIndexNameToSlotNameEntries,
    ) as Record<string, StoredRowIndexSlotName>,
  };
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the loop above populates every static list id before the readonly view is exposed
const definitionInfoByListId = definitionInfoByListIdPartial as Readonly<
  Record<StaticListId, StaticListDefinitionInfo>
>;

export function getStaticListDefinitionInfo(
  listId: StaticListId,
): StaticListDefinitionInfo {
  return definitionInfoByListId[listId];
}

export function buildRowStoreSchema({
  physicalKey,
  secondaryIndexCount,
}: {
  physicalKey: "r" | "i";
  secondaryIndexCount: number;
}): string {
  const secondarySlots = Array.from(
    { length: secondaryIndexCount },
    (_, index) => `s${index + 1}`,
  );

  return [physicalKey, "p", ...secondarySlots].join(", ");
}
