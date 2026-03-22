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
  defineStaticListDefinition,
  receivedTagIdSchema,
  type StaticListDefinition,
  stringifyReceivedTagId,
} from "../static-list-helpers";

const jsonlTagListItemSchema = z.readonly(
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
type JsonlTagListItem = z.infer<typeof jsonlTagListItemSchema>;

const interpretedTagListItemSchema = z.readonly(
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
export type TagListItem = z.infer<typeof interpretedTagListItemSchema>;

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
  typeof jsonlTagListItemSchema,
  typeof interpretedTagListItemSchema,
  typeof tagListSummarySchema
> = defineStaticListDefinition({
  dxSidepanelTab: { label: "Теги" },
  physicalStorageVersion: 1,
  derivedDataVersion: "20260321",
  jsonlItemSchema: jsonlTagListItemSchema,
  interpretedItemSchema: interpretedTagListItemSchema,
  logicalPrimaryKey: {
    name: "id",
    extractFromJsonlItem: (jsonlItem) => stringifyReceivedTagId(jsonlItem[2]),
  },
  interpretJsonlItem: ([
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
      id: stringifyReceivedTagId(rawId),
      name,
      ...expandFlagBitmask(flagBitmask ?? 0),
      customPathname,
    }),

  serializeInterpretedItemAsJsonl: (storedItem): JsonlTagListItem => {
    const flagBitmask =
      (storedItem.botnadzorPage ? 1 : 0) |
      (storedItem.botnadzorCard ? 2 : 0) |
      (storedItem.visibilityLock ? 4 : 0);
    const color: JsonlTagListItem[0] =
      storedItem.color && storedItem.colorForHighlight
        ? [storedItem.color, storedItem.colorForHighlight]
        : // eslint-disable-next-line unicorn/no-null -- need to map to JSON
          (storedItem.color ?? null);

    if (storedItem.customPathname) {
      return [
        color,
        storedItem.type,
        storedItem.id,
        storedItem.name,
        flagBitmask,
        storedItem.customPathname,
      ];
    }

    if (flagBitmask) {
      return [
        color,
        storedItem.type,
        storedItem.id,
        storedItem.name,
        flagBitmask,
      ];
    }

    return [color, storedItem.type, storedItem.id, storedItem.name];
  },

  summarySchema: tagListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
  }),
  adjustSummary: (mutableSummary, item, delta) => {
    mutableSummary.itemCount += delta;
  },
});
