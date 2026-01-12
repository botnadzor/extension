import { z } from "zod/mini";

import { isoTimeSchema } from "@/lib/primitive-values";
import { defineStoreWithSchema } from "@/lib/store-with-schema";

const globalNotificationsStateSchema = z.readonly(
  z.object({
    welcomeMessageShownAt: z.exactOptional(isoTimeSchema),
    welcomeMessageReadAt: z.exactOptional(isoTimeSchema),
    announcementReadAtByCreatedAt: z.readonly(
      z._default(z.record(z.string(), isoTimeSchema), {}),
    ),
  }),
);

export type GlobalNotificationsState = z.infer<
  typeof globalNotificationsStateSchema
>;

export const globalNotificationsStore = defineStoreWithSchema(
  "sync:global-notifications",
  globalNotificationsStateSchema,
);

export const defaultGlobalNotificationsState: GlobalNotificationsState = {
  announcementReadAtByCreatedAt: {},
};
