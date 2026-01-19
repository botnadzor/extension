import { z } from "zod/mini";

import { isoTimeSchema } from "./primitives";

export const triggeredNotificationSchema = z.readonly(
  z.object({
    message: z.exactOptional(z.string()),
    type: z.enum([
      "dataWarmupComplete",
      "inspectorMissingPermission",
      "inspectorUnauthorized",
      "regDateMissingPermission",
      "regDateUnauthorized",
      "regDateUnavailable",
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
