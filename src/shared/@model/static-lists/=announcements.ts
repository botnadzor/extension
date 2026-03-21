import { z } from "zod/mini";

import { itemCountSchema } from "../../@primitives/misc";
import { semverRangeSchema } from "../../@primitives/semver";
import { isoDateTimeSchema } from "../../@primitives/temporal";
import type { StaticListDefinition } from "../static-list-helpers";

const announcementListItemSchema = z.readonly(
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
export type AnnouncementListItem = z.infer<typeof announcementListItemSchema>;

export const storedAnnouncementListItemSchema = z.readonly(
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
  typeof announcementListItemSchema,
  typeof storedAnnouncementListItemSchema,
  typeof announcementListSummarySchema
> = {
  dxSidepanelTab: { label: "Объявления" },
  receivedItemSchema: announcementListItemSchema,
  storedItemSchema: storedAnnouncementListItemSchema,
  mapReceivedToStored: ([
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

  mapStoredToReceived: ({
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

  jsonlRowSortingBy: ["createdAt"],

  indexes: ["createdAt"],

  summarySchema: announcementListSummarySchema,
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
