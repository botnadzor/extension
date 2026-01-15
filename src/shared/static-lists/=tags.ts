import { z } from "zod/mini";

import {
  hexColorSchema,
  itemCountSchema,
  optionalTrueSchema,
  tagIdSchema,
  tagTypeSchema,
} from "../primitive-values";
import {
  receivedTagIdSchema,
  type StaticListDefinition,
} from "../static-list-helpers";

const receivedTagListItemSchema = z.readonly(
  z.tuple([
    z.exactOptional(hexColorSchema),
    tagTypeSchema,
    receivedTagIdSchema,
    z.string(), // name
    z.exactOptional(z.number().check(z.int(), z.nonnegative())), // flagBitmask
    z.exactOptional(z.string()), // customPathname
  ]),
);

const storedTagListItemSchema = z.readonly(
  z.object({
    color: z.exactOptional(hexColorSchema),
    type: tagTypeSchema,
    id: tagIdSchema,
    name: z.string(),

    botnadzorPage: optionalTrueSchema, // flagBitmask & 1
    botnadzorCard: optionalTrueSchema, // flagBitmask & 2
    visibilityLock: optionalTrueSchema, // flagBitmask & 4

    customPathname: z.exactOptional(z.string()),
  }),
);
export type TagListItem = z.infer<typeof storedTagListItemSchema>;

const tagListSummarySchema = z.readonly(
  z.object({
    itemCount: itemCountSchema,
  }),
);

function expandFlagBitmask(flagBitmask: number): Partial<TagListItem> {
  return {
    ...(flagBitmask & 1 ? { botnadzorPage: true as const } : {}),
    ...(flagBitmask & 2 ? { botnadzorCard: true as const } : {}),
    ...(flagBitmask & 4 ? { visibilityLock: true as const } : {}),
  };
}

export const tagListDefinition: StaticListDefinition<
  typeof receivedTagListItemSchema,
  typeof storedTagListItemSchema,
  typeof tagListSummarySchema
> = {
  receivedItemSchema: receivedTagListItemSchema,
  storedItemSchema: storedTagListItemSchema,
  mapReceivedToStored: ([
    color,
    type,
    rawId,
    name,
    flagBitmask,
    customPathname,
  ]) => ({
    ...(color ? { color } : {}),
    type,
    id: tagIdSchema.parse(String(rawId)),
    name,
    ...expandFlagBitmask(flagBitmask ?? 0),
    ...(customPathname ? { customPathname } : {}),
  }),

  indexes: ["id"],

  summarySchema: tagListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
  }),
  mutateSummary: (mutableSummary) => {
    mutableSummary.itemCount += 1;
  },
};
