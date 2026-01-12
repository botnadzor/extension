import { z } from "zod/mini";

import { contentIdSchema, isoTimeSchema } from "@/lib/primitive-values";
import { defineStoreWithSchema } from "@/lib/store-with-schema";

const triggeredNotificationSchema = z.readonly(
  z.object({
    type: z.enum([
      "inspectorMissingPermission",
      "inspectorUnauthorized",
      "regDateAccountNotFound",
      "regDateMissingPermission",
      "regDateNoAliasToUse",
      "regDateNotYetKnown",
      "regDateTooManyRequests",
      "regDateUnauthorized",
      "regDateUnexpectedError",
      "test",
    ]),
    triggeredAt: isoTimeSchema,
  }),
);

export type TriggeredNotification = z.infer<typeof triggeredNotificationSchema>;

export type TriggeredNotificationPayload = Omit<
  TriggeredNotification,
  "triggeredAt"
>;

const triggeredNotificationsConfigSchema = z.readonly(
  z.object({
    notificationByContentId: z.readonly(
      z.record(contentIdSchema, triggeredNotificationSchema),
    ),
  }),
);
export type TriggeredNotificationsConfig = z.infer<
  typeof triggeredNotificationsConfigSchema
>;

export const triggeredNotificationsStore = defineStoreWithSchema(
  "session:triggered-notifications",
  triggeredNotificationsConfigSchema,
);
