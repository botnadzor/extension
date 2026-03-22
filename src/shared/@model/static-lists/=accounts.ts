import { z } from "zod/mini";

import { itemCountSchema, tagIdSchema } from "../../@primitives/misc";
import { vkIdSchema, vkNicknameSchema } from "../../@primitives/vk";
import { omitUndefined } from "../../omit-undefined";
import {
  defineStaticListDefinition,
  receivedTagIdSchema,
  type StaticListDefinition,
  stringifyReceivedTagId,
} from "../static-list-helpers";

const jsonlAccountListItemSchema = z.readonly(
  z.tuple([
    vkIdSchema,
    z // tagIds
      .union([
        z.readonly(z.array(receivedTagIdSchema).check(z.minLength(1))),
        receivedTagIdSchema,
      ]),
    z.exactOptional(vkNicknameSchema),
  ]),
);

const interpretedAccountListItemSchema = z.readonly(
  z.object({
    vkId: vkIdSchema,
    vkNickname: z.exactOptional(vkNicknameSchema),
    tagIds: z.readonly(z.array(tagIdSchema).check(z.minLength(1))),
  }),
);
/** @public */
export type AccountListItem = z.infer<typeof interpretedAccountListItemSchema>;

const accountListSummarySchema = z.readonly(
  z.object({
    itemCount: itemCountSchema,
    itemCountByTagId: z.readonly(z.record(tagIdSchema, itemCountSchema)),
  }),
);

export const accountListDefinition: StaticListDefinition<
  typeof jsonlAccountListItemSchema,
  typeof interpretedAccountListItemSchema,
  typeof accountListSummarySchema
> = defineStaticListDefinition({
  physicalStorageVersion: 1,
  derivedDataVersion: "20260321",
  jsonlItemSchema: jsonlAccountListItemSchema,
  interpretedItemSchema: interpretedAccountListItemSchema,
  logicalPrimaryKey: {
    name: "vkId",
    extractFromJsonlItem: ([vkId]) => vkId,
  },
  secondaryIndexes: [
    {
      name: "vkNickname",
      extractFromJsonlItem: (jsonlItem) => jsonlItem[2],
    },
  ],
  interpretJsonlItem: ([vkId, rawTagIds, vkNickname]) =>
    omitUndefined({
      vkId,
      vkNickname,
      tagIds:
        typeof rawTagIds === "string" || typeof rawTagIds === "number"
          ? [stringifyReceivedTagId(rawTagIds)]
          : rawTagIds.map((rawTagId) => stringifyReceivedTagId(rawTagId)),
    }),

  serializeInterpretedItemAsJsonl: ({ vkId, tagIds, vkNickname }) =>
    vkNickname ? [vkId, tagIds, vkNickname] : [vkId, tagIds],

  summarySchema: accountListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
    itemCountByTagId: {},
  }),
  adjustSummary: (mutableSummary, item, delta) => {
    mutableSummary.itemCount += delta;
    for (const tagId of item.tagIds) {
      mutableSummary.itemCountByTagId[tagId] =
        (mutableSummary.itemCountByTagId[tagId] ?? 0) + delta;
    }
  },
});
