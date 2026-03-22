import { z } from "zod/mini";

import { itemCountSchema } from "../../@primitives/misc";
import { semverRangeSchema } from "../../@primitives/semver";
import { isoDateTimeSchema } from "../../@primitives/temporal";
import {
  defineStaticListDefinition,
  type StaticListDefinition,
} from "../static-list-helpers";

const jsonlAnnouncementListItemSchema = z.readonly(
  z.tuple([
    isoDateTimeSchema, // createdAt
    z // extensionVersionRange or [extensionVersionRange, extensionVersionRangeForToast]
      .union([
        semverRangeSchema,
        z.tuple([semverRangeSchema, semverRangeSchema]),
      ]),
    z.string(), // header
    z.string(), // content
  ]),
);
/** @public */
export type AnnouncementListItem = z.infer<
  typeof interpretedAnnouncementListItemSchema
>;

export const interpretedAnnouncementListItemSchema = z.readonly(
  z.object({
    createdAt: isoDateTimeSchema,
    extensionVersionRange: semverRangeSchema,
    extensionVersionRangeForToast: z.exactOptional(semverRangeSchema),
    header: z.string(),
    content: z.string(),
  }),
);

const announcementListSummarySchema = z.readonly(
  z.object({
    itemCount: itemCountSchema,
  }),
);

export const announcementListDefinition: StaticListDefinition<
  typeof jsonlAnnouncementListItemSchema,
  typeof interpretedAnnouncementListItemSchema,
  typeof announcementListSummarySchema
> = defineStaticListDefinition({
  dxSidepanelTab: { label: "Объявления" },
  physicalStorageVersion: 1,
  derivedDataVersion: "20260321",
  jsonlItemSchema: jsonlAnnouncementListItemSchema,
  interpretedItemSchema: interpretedAnnouncementListItemSchema,
  logicalPrimaryKey: {
    name: "createdAt",
    extractFromJsonlItem: ([createdAt]) => createdAt,
  },
  interpretJsonlItem: ([
    createdAt,
    extensionVersionRange,
    header,
    content,
  ]) => ({
    createdAt,
    extensionVersionRange: Array.isArray(extensionVersionRange)
      ? extensionVersionRange[0]
      : extensionVersionRange,
    ...(Array.isArray(extensionVersionRange) &&
    extensionVersionRange[0] !== extensionVersionRange[1]
      ? { extensionVersionRangeForToast: extensionVersionRange[1] }
      : {}),
    header,
    content,
  }),

  serializeInterpretedItemAsJsonl: ({
    createdAt,
    extensionVersionRange,
    extensionVersionRangeForToast,
    header,
    content,
  }) => [
    createdAt,
    extensionVersionRangeForToast
      ? [extensionVersionRange, extensionVersionRangeForToast]
      : extensionVersionRange,
    header,
    content,
  ],

  jsonlExportSortingBy: ["createdAt"],

  summarySchema: announcementListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
  }),
  adjustSummary: (mutableSummary, item, delta) => {
    mutableSummary.itemCount += delta;
  },
});
