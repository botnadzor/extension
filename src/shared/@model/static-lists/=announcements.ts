import { z } from "zod/mini";

import {
  isoTimeSchema,
  itemCountSchema,
  semverRangeSchema,
} from "../primitives";
import type { StaticListDefinition } from "../static-list-helpers";

const announcementListItemSchema = z.readonly(
  z.tuple([
    isoTimeSchema, // createdAt
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

const storedAnnouncementListItemSchema = z.readonly(
  z.object({
    createdAt: isoTimeSchema,
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

  indexes: ["createdAt"],

  summarySchema: announcementListSummarySchema,
  createEmptySummary: () => ({
    itemCount: 0,
  }),
  mutateSummary: (mutableSummary) => {
    mutableSummary.itemCount += 1;
  },
};
