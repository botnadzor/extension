import { z } from "zod/mini";

import { itemCountSchema } from "../../@primitives/misc";
import { insertionConfigSchema } from "../insertion-configs";
import {
  defineStaticListDefinition,
  type StaticListDefinition,
} from "../static-list-helpers";

const insertionListItemSchema = insertionConfigSchema;
/** @public */
export type InsertionListItem = z.infer<typeof insertionListItemSchema>;

const insertionListSummarySchema = z.readonly(
  z.object({
    itemCount: itemCountSchema,
  }),
);

const insertionVariantMaxLength = Math.max(
  ...insertionConfigSchema.def.options
    .flatMap((schema) => schema.def.innerType.shape.variant.def.values)
    .map((variant) => variant.length),
);

export const insertionListDefinition: StaticListDefinition<
  typeof insertionListItemSchema,
  typeof insertionListItemSchema,
  typeof insertionListSummarySchema
> = defineStaticListDefinition({
  dxSidepanelTab: { label: "Вставки" },
  physicalStorageVersion: 1,
  derivedDataVersion: "20260321",
  jsonlItemSchema: insertionListItemSchema,
  interpretedItemSchema: insertionListItemSchema,
  logicalPrimaryKey: {
    name: "id",
    extractFromJsonlItem: (jsonlItem) => jsonlItem.id,
  },
  interpretJsonlItem: (jsonlItem) => jsonlItem,
  serializeInterpretedItemAsJsonl: (storedItem) => {
    const {
      disabled,
      appliesTo,
      variant,
      id,
      appliesToArchivedSnapshotsOnly,
      selector,
      extensionVersionRange,
      ...rest
    } = storedItem;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ts gets confused about end type when using ...rest
    return {
      ...(disabled ? { disabled: true } : {}),
      appliesTo,
      variant,
      id,
      ...(extensionVersionRange ? { extensionVersionRange } : {}),
      ...(appliesToArchivedSnapshotsOnly
        ? { appliesToArchivedSnapshotsOnly }
        : {}),
      selector,
      ...rest,
    } as InsertionListItem;
  },
  jsonlStringifyRow: (item) =>
    // vertically align json string to make it easier to read
    JSON.stringify(item)
      .replace('mobileVkWebsite",', 'mobileVkWebsite", ')
      .replace(
        /variant":"(\w+)",/,
        (match, p1: string) =>
          `variant":"${p1}",${" ".repeat(insertionVariantMaxLength - p1.length)}`,
      ),
  jsonlExportSortingBy: ["variant", "disabled", "extensionVersionRange", "id"],

  summarySchema: insertionListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
  }),
  adjustSummary: (mutableSummary, item, delta) => {
    mutableSummary.itemCount += delta;
  },
});
