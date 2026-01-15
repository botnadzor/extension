import { z } from "zod/mini";

import { isoTimeSchema, vkDomainSchema, vkIdSchema } from "../primitive-values";

export const inspectorInstancePayloadSchema = z.object({
  wallVkId: vkIdSchema,
  postVkId: vkIdSchema,
  commentVkId: vkIdSchema,
  commenterVkDomain: vkDomainSchema,
  commenterName: z.string(),
  commenterAvatarUrl: z.url(),
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
