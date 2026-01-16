import type { WritableDeep } from "type-fest";
import { z } from "zod/mini";

import { isoTimeSchema, itemCountSchema } from "./primitives";

export const receivedTagIdSchema = z.union([z.number(), z.string()]);

export const staticListUpstreamInfoSchema = z.readonly(
  z.object({
    generatedAt: isoTimeSchema,
    itemCount: itemCountSchema,
  }),
);
export type StaticListUpstreamInfo = z.infer<
  typeof staticListUpstreamInfoSchema
>;

export const staticListInstanceSchema = z.enum(["a", "b"]);
export type StaticListInstance = z.infer<typeof staticListInstanceSchema>;

export type StaticListDefinition<
  ReceivedItemSchema extends z.ZodMiniType = z.ZodMiniType,
  StoredItemSchema extends z.ZodMiniType = z.ZodMiniType,
  SummarySchema extends z.ZodMiniType<{ itemCount: number }> = z.ZodMiniType<{
    itemCount: number;
  }>,
> = {
  receivedItemSchema: ReceivedItemSchema;
  storedItemSchema: StoredItemSchema;
  mapReceivedToStored: (
    receivedItem: z.infer<ReceivedItemSchema>,
  ) => z.infer<StoredItemSchema>;

  indexes: [
    keyof z.infer<StoredItemSchema>,
    ...Array<keyof z.infer<StoredItemSchema>>,
  ];

  summarySchema: SummarySchema;
  createEmptySummary: () => z.infer<SummarySchema>;

  mutateSummary: (
    mutableSummary: WritableDeep<z.infer<SummarySchema>>,
    item: z.infer<StoredItemSchema>,
  ) => void;
};
