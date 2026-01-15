import { z } from "zod/mini";

import { isoTimeSchema } from "../primitive-values";

export const triggeredNotificationSchema = z.readonly(
  z.object({
    type: z.enum([
      "dataWarmupComplete",
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
