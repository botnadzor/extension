import type { WritableDeep } from "type-fest";
import { z } from "zod/mini";

import { itemCountSchema } from "../@primitives/misc";
import { isoDateTimeSchema } from "../@primitives/temporal";

export const receivedTagIdSchema = z.union([z.number(), z.string()]);

export const staticListUpstreamInfoSchema = z.readonly(
  z.object({
    generatedAt: isoDateTimeSchema,
    itemCount: itemCountSchema,
  }),
);
export type StaticListUpstreamInfo = z.infer<
  typeof staticListUpstreamInfoSchema
>;

export const staticListRemoteInstanceSchema = z.enum(["a", "b"]);
export type StaticListRemoteInstance = z.infer<
  typeof staticListRemoteInstanceSchema
>;

export const staticListCombiningModeSchema = z.enum([
  "remoteOnly",
  "remoteWithLocalOverrides",
  "localOnly",
]);
export type StaticListCombiningMode = z.infer<
  typeof staticListCombiningModeSchema
>;

export const staticListItemOriginSchema = z.enum([
  "remote",
  "localOverride",
  "local",
]);
export type StaticListItemOrigin = z.infer<typeof staticListItemOriginSchema>;

export type StaticListDefinition<
  ReceivedItemSchema extends z.ZodMiniType = z.ZodMiniType,
  StoredItemSchema extends z.ZodMiniType = z.ZodMiniType,
  SummarySchema extends z.ZodMiniType<{ itemCount: number }> = z.ZodMiniType<{
    itemCount: number;
  }>,
> = {
  dxSidepanelTab?: { label: string };
  receivedItemSchema: ReceivedItemSchema;
  storedItemSchema: StoredItemSchema;
  mapReceivedToStored: (
    receivedItem: z.infer<ReceivedItemSchema>,
  ) => z.infer<StoredItemSchema>;

  mapStoredToReceived: (
    storedItem: z.infer<StoredItemSchema>,
  ) => z.infer<ReceivedItemSchema>;

  jsonlRowSortingBy?: Array<keyof z.infer<StoredItemSchema>>;
  jsonlStringifyRow?: (item: z.infer<ReceivedItemSchema>) => string;

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

  unmutateSummary: (
    mutableSummary: WritableDeep<z.infer<SummarySchema>>,
    item: z.infer<StoredItemSchema>,
  ) => void;
};
