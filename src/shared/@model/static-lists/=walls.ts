import { z } from "zod/mini";

import { itemCountSchema } from "../../@primitives/misc";
import { vkIdSchema } from "../../@primitives/vk";
import type { StaticListDefinition } from "../static-list-helpers";

const receivedWallListItemSchema = z.union([
  z.readonly(z.tuple([vkIdSchema])),
  vkIdSchema,
]);

const storedWallListItemSchema = z.readonly(
  z.object({
    vkId: vkIdSchema,
    skip: z.boolean(), // true if the wall should be skipped when a user has opted in to collecting comments
  }),
);
/** @public */
export type WallListItem = z.infer<typeof storedWallListItemSchema>;

const wallListSummarySchema = z.readonly(
  z.object({
    itemCount: itemCountSchema,
  }),
);

export const wallListDefinition: StaticListDefinition<
  typeof receivedWallListItemSchema,
  typeof storedWallListItemSchema,
  typeof wallListSummarySchema
> = {
  dxSidepanelTab: { label: "Стены" },
  receivedItemSchema: receivedWallListItemSchema,
  storedItemSchema: storedWallListItemSchema,
  mapReceivedToStored: (receivedItem) => ({
    vkId: typeof receivedItem === "number" ? receivedItem : receivedItem[0],
    skip: true,
  }),

  mapStoredToReceived: ({ vkId }) => vkId,
  indexes: ["vkId"],

  summarySchema: wallListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
  }),
  mutateSummary: (mutableSummary) => {
    mutableSummary.itemCount += 1;
  },
  unmutateSummary: (mutableSummary) => {
    mutableSummary.itemCount -= 1;
  },
};
