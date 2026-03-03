import { z } from "zod/mini";

import { isoDateTimeSchema } from "../@primitives/temporal";

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
    ]),
    triggeredAt: isoDateTimeSchema,
  }),
);

export type TriggeredNotification = z.infer<typeof triggeredNotificationSchema>;

export type TriggeredNotificationPayload = Omit<
  TriggeredNotification,
  "triggeredAt"
>;
