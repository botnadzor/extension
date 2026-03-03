import { z } from "zod/mini";

import { itemCountSchema, tagIdSchema } from "../../@primitives/misc";
import { vkIdSchema, vkNicknameSchema } from "../../@primitives/vk";
import { omitUndefined } from "../../omit-undefined";
import {
  receivedTagIdSchema,
  type StaticListDefinition,
} from "../static-list-helpers";

const receivedAccountListItemSchema = z.readonly(
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

const storedAccountListItemSchema = z.readonly(
  z.object({
    vkId: vkIdSchema,
    vkNickname: z.exactOptional(vkNicknameSchema),
    tagIds: z.readonly(z.array(tagIdSchema).check(z.minLength(1))),
  }),
);
/** @public */
export type AccountListItem = z.infer<typeof storedAccountListItemSchema>;

const accountListSummarySchema = z.readonly(
  z.object({
    itemCount: itemCountSchema,
    itemCountByTagId: z.readonly(z.record(tagIdSchema, itemCountSchema)),
  }),
);

export const accountListDefinition: StaticListDefinition<
  typeof receivedAccountListItemSchema,
  typeof storedAccountListItemSchema,
  typeof accountListSummarySchema
> = {
  receivedItemSchema: receivedAccountListItemSchema,
  storedItemSchema: storedAccountListItemSchema,
  mapReceivedToStored: ([vkId, rawTagIds, vkNickname]) =>
    omitUndefined({
      vkId,
      vkNickname,
      tagIds:
        typeof rawTagIds === "string" || typeof rawTagIds === "number"
          ? [tagIdSchema.parse(String(rawTagIds))]
          : rawTagIds.map((rawTagId) => tagIdSchema.parse(String(rawTagId))),
    }),

  mapStoredToReceived: ({ vkId, tagIds, vkNickname }) =>
    vkNickname ? [vkId, tagIds, vkNickname] : [vkId, tagIds],

  indexes: ["vkId", "vkNickname"],

  summarySchema: accountListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
    itemCountByTagId: {},
  }),
  mutateSummary: (mutableSummary, item) => {
    mutableSummary.itemCount += 1;
    for (const tagId of item.tagIds) {
      mutableSummary.itemCountByTagId[tagId] =
        (mutableSummary.itemCountByTagId[tagId] ?? 0) + 1;
    }
  },
  unmutateSummary: (mutableSummary, item) => {
    mutableSummary.itemCount -= 1;
    for (const tagId of item.tagIds) {
      mutableSummary.itemCountByTagId[tagId] =
        (mutableSummary.itemCountByTagId[tagId] ?? 1) - 1;
    }
  },
};
