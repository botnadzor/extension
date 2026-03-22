import { z } from "zod/mini";

import { itemCountSchema } from "../../@primitives/misc";
import { vkIdSchema } from "../../@primitives/vk";
import {
  defineStaticListDefinition,
  type StaticListDefinition,
} from "../static-list-helpers";

const jsonlWallListItemSchema = z.readonly(z.tuple([vkIdSchema]));

const interpretedWallListItemSchema = z.readonly(
  z.object({
    vkId: vkIdSchema,
    skip: z.boolean(), // true if the wall should be skipped when a user has opted in to collecting comments
  }),
);
/** @public */
export type WallListItem = z.infer<typeof interpretedWallListItemSchema>;

const wallListSummarySchema = z.readonly(
  z.object({
    itemCount: itemCountSchema,
  }),
);

export const wallListDefinition: StaticListDefinition<
  typeof jsonlWallListItemSchema,
  typeof interpretedWallListItemSchema,
  typeof wallListSummarySchema
> = defineStaticListDefinition({
  dxSidepanelTab: { label: "Стены" },
  physicalStorageVersion: 1,
  derivedDataVersion: "20260321",
  jsonlItemSchema: jsonlWallListItemSchema,
  interpretedItemSchema: interpretedWallListItemSchema,
  logicalPrimaryKey: {
    name: "vkId",
    extractFromJsonlItem: ([vkId]) => vkId,
  },
  interpretJsonlItem: ([vkId]) => ({
    vkId,
    skip: true,
  }),

  serializeInterpretedItemAsJsonl: ({ vkId }) => [vkId],

  summarySchema: wallListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
  }),
  adjustSummary: (mutableSummary, item, delta) => {
    mutableSummary.itemCount += delta;
  },
});
