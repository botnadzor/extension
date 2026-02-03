import { z } from "zod/mini";

import {
  isoTimeSchema,
  positiveVkIdSchema,
  vkDomainSchema,
  vkIdSchema,
} from "./primitives";

export const inspectorAccountInfoSchema = z.readonly(
  z.object({
    vkDomain: vkDomainSchema,
    name: z.string(),
    avatarUrl: z.url(),
  }),
);
export type InspectorAccountInfo = z.infer<typeof inspectorAccountInfoSchema>;

export const inspectorTriggerSchema = z.discriminatedUnion("type", [
  z.readonly(
    z.object({
      type: z.literal("comment"),
      postType: z.enum(["photo", "video", "wall"]),
      wallVkId: vkIdSchema,
      postVkId: vkIdSchema,
      commentVkId: vkIdSchema,
    }),
  ),
  z.readonly(
    z.object({
      type: z.literal("review"),
      wallVkId: vkIdSchema,
      reviewVkId: positiveVkIdSchema,
    }),
  ),
]);

export type InspectorTrigger = z.infer<typeof inspectorTriggerSchema>;

export const inspectorInstancePayloadSchema = z.object({
  accountInfo: inspectorAccountInfoSchema,
  trigger: inspectorTriggerSchema,
});

export type InspectorInstancePayload = z.infer<
  typeof inspectorInstancePayloadSchema
>;

export const inspectorTabSchema = z.enum(["activity", "report"]);
export type InspectorTab = z.infer<typeof inspectorTabSchema>;

export const inspectorInstanceConfigSchema = z.readonly(
  z.extend(inspectorInstancePayloadSchema, {
    tab: inspectorTabSchema,
    triggeredAt: isoTimeSchema,
  }),
);
export type InspectorInstanceConfig = z.infer<
  typeof inspectorInstanceConfigSchema
>;

export const reportTextMinLength = 10;
export const reportTextMaxLength = 200;
