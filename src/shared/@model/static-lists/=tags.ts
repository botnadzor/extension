import { z } from "zod/mini";

import {
  hexColorSchema,
  itemCountSchema,
  optionalTrueSchema,
  tagIdSchema,
  tagTypeSchema,
} from "../../@primitives/misc";
import { omitUndefined } from "../../omit-undefined";
import {
  receivedTagIdSchema,
  type StaticListDefinition,
} from "../static-list-helpers";

const receivedTagListItemSchema = z.readonly(
  z.tuple([
    z.union([
      hexColorSchema,
      z.null(),
      z.tuple([hexColorSchema]),
      z.tuple([hexColorSchema, hexColorSchema]),
    ]),
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
    colorForHighlight: z.exactOptional(hexColorSchema),
    type: tagTypeSchema,
    id: tagIdSchema,
    name: z.string(),

    botnadzorPage: optionalTrueSchema, // flagBitmask & 1
    botnadzorCard: optionalTrueSchema, // flagBitmask & 2
    visibilityLock: optionalTrueSchema, // flagBitmask & 4

    customPathname: z.exactOptional(z.string()),
  }),
);
/** @public */
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
  dxSidepanelTab: { label: "Теги" },
  receivedItemSchema: receivedTagListItemSchema,
  storedItemSchema: storedTagListItemSchema,
  mapReceivedToStored: ([
    color,
    type,
    rawId,
    name,
    flagBitmask,
    customPathname,
  ]) =>
    omitUndefined({
      color: Array.isArray(color) ? color[0] : (color ?? undefined),
      colorForHighlight: Array.isArray(color) ? color[1] : undefined,
      type,
      id: tagIdSchema.parse(String(rawId)),
      name,
      ...expandFlagBitmask(flagBitmask ?? 0),
      customPathname,
    }),

  mapStoredToReceived: (storedItem) => {
    const flagBitmask =
      (storedItem.botnadzorPage ? 1 : 0) |
      (storedItem.botnadzorCard ? 2 : 0) |
      (storedItem.visibilityLock ? 4 : 0);

    const baseResult = [
      // eslint-disable-next-line unicorn/no-null -- need to map to JSON
      storedItem.color ?? null,
      storedItem.type,
      storedItem.id,
      storedItem.name,
    ] as const;

    if (storedItem.customPathname) {
      return [...baseResult, flagBitmask, storedItem.customPathname];
    }

    if (flagBitmask) {
      return [...baseResult, flagBitmask];
    }

    return baseResult;
  },

  indexes: ["id"],

  summarySchema: tagListSummarySchema,
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
