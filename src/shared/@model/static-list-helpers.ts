import type { WritableDeep } from "type-fest";
import { z } from "zod/mini";

import { itemCountSchema, tagIdSchema } from "../@primitives/misc";
import { isoDateTimeSchema } from "../@primitives/temporal";

export const receivedTagIdSchema = z.union([
  z.number().check(z.int(), z.nonnegative()),
  tagIdSchema,
]);
export type ReceivedTagId = z.infer<typeof receivedTagIdSchema>;

export function stringifyReceivedTagId(
  receivedTagId: ReceivedTagId,
): z.infer<typeof tagIdSchema> {
  // The schema already guarantees the JSONL-form value normalizes to a valid
  // tag ID string, so interpretation can remap without new validation.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- schema guarantees the normalized string satisfies tagIdSchema
  return String(receivedTagId) as z.infer<typeof tagIdSchema>;
}

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

/**
 * Interpretation failures stop at the raw JSONL boundary on purpose.
 *
 * Remote rows are persisted even when they are malformed, so reads need to tell
 * the difference between "the source was not JSON at all" and "it was JSON but
 * no longer matches the list's JSONL contract". Anything beyond that belongs in
 * `interpretJsonlItem`, which is expected to stay total once schema validation
 * has passed.
 */
export type StaticListEntryInterpretation =
  | { success: true; item: unknown }
  | { success: false; kind: "jsonParse" | "jsonlSchema"; error: string };

/**
 * This is intentionally a lossless UI/debug view of stored rows rather than a
 * business-domain API.
 *
 * It keeps enough source and merge information to inspect malformed rows,
 * shadowing, and duplicate logical keys without forcing the sidepanel to infer
 * storage behavior from typed business reads.
 */
export type StaticListPageEntry = {
  rowKey: string | number;
  origin: StaticListItemOrigin;
  logicalPrimaryKey: IDBValidKey | undefined;
  indexValues: Partial<Record<"p" | `s${number}`, IDBValidKey | undefined>>;
  sourceText: string;
  sourceItem: unknown;
  interpretation: StaticListEntryInterpretation;
  shadowedRemoteRowKeys: IDBValidKey[];
};

export type StaticListPutLocalItemsResult =
  | { success: true }
  | {
      success: false;
      error: string;
      details?: unknown;
      limit?: number;
      attempting?: number;
    };

/**
 * `rowKey` is the exact-edit escape hatch for local rows.
 *
 * Normal writes are logical-key upserts because that is the cheapest way to
 * express overrides. Once a user opens a concrete local row, though, edits must
 * be able to target that physical row even if it was malformed or if its
 * logical key changes during editing.
 */
export type StaticListPutLocalItemsOptions = {
  validate?: boolean;
  rowKey?: string;
};

export type StaticListRemoveLocalItemTarget =
  | { logicalPrimaryKey: IDBValidKey; rowKey?: never }
  | { rowKey: string; logicalPrimaryKey?: never };

export type StaticListIndexDefinition<
  JsonlItem,
  InterpretedKeyName extends string = string,
> = {
  name: InterpretedKeyName;
  extractFromJsonlItem: {
    bivarianceHack(jsonlItem: JsonlItem): IDBValidKey | undefined;
  }["bivarianceHack"];
};

type StaticListMapper<Input, Output> = {
  bivarianceHack(input: Input): Output;
}["bivarianceHack"];

type StaticListAdjustSummary<Summary, Item> = {
  bivarianceHack(
    mutableSummary: WritableDeep<Summary>,
    item: Item,
    delta: 1 | -1,
  ): void;
}["bivarianceHack"];

/**
 * Static list definitions describe three separate contracts:
 *
 * 1. the upstream JSONL shape we preserve in storage
 * 2. the interpreted runtime shape the app consumes
 * 3. the persisted version boundaries that decide whether we can keep local
 *    data, remote data, or neither
 *
 * That separation is what lets us re-interpret old remote rows after an app
 * upgrade without making storage depend on whichever extension version first
 * downloaded them.
 */
export type StaticListDefinition<
  JsonlItemSchema extends z.ZodMiniType = z.ZodMiniType,
  InterpretedItemSchema extends z.ZodMiniType = z.ZodMiniType,
  SummarySchema extends z.ZodMiniType<{ itemCount: number }> = z.ZodMiniType<{
    itemCount: number;
  }>,
  InterpretedKeyName extends string = string,
> = {
  dxSidepanelTab?: { label: string };
  /** Bump only when the IndexedDB layout itself becomes incompatible. */
  physicalStorageVersion: number;
  /** Bump when persisted remote-derived data semantics change and a redownload is cheaper than rebuilding. */
  derivedDataVersion: string;
  jsonlItemSchema: JsonlItemSchema;
  interpretedItemSchema: InterpretedItemSchema;
  /** Merging and shadowing are defined only by this key, never by secondary indexes. */
  logicalPrimaryKey: StaticListIndexDefinition<
    z.infer<JsonlItemSchema>,
    InterpretedKeyName
  >;
  /** Secondary indexes exist for lookups only; they must not affect merge precedence. */
  secondaryIndexes?: Array<
    StaticListIndexDefinition<z.infer<JsonlItemSchema>, InterpretedKeyName>
  >;
  interpretJsonlItem: StaticListMapper<
    z.infer<JsonlItemSchema>,
    z.infer<InterpretedItemSchema>
  >;
  serializeInterpretedItemAsJsonl: StaticListMapper<
    z.infer<InterpretedItemSchema>,
    z.infer<JsonlItemSchema>
  >;
  jsonlExportSortingBy?: InterpretedKeyName[];
  jsonlStringifyRow?: StaticListMapper<z.infer<JsonlItemSchema>, string>;

  summarySchema: SummarySchema;
  createEmptySummary: () => z.infer<SummarySchema>;
  adjustSummary: StaticListAdjustSummary<
    z.infer<SummarySchema>,
    z.infer<InterpretedItemSchema>
  >;
  localRowLimit?: number;
};

export function defineStaticListDefinition<
  JsonlItemSchema extends z.ZodMiniType,
  InterpretedItemSchema extends z.ZodMiniType,
  SummarySchema extends z.ZodMiniType<{ itemCount: number }>,
  InterpretedKeyName extends Extract<
    keyof z.infer<InterpretedItemSchema>,
    string
  >,
>(
  definition: StaticListDefinition<
    JsonlItemSchema,
    InterpretedItemSchema,
    SummarySchema,
    InterpretedKeyName
  >,
): StaticListDefinition<
  JsonlItemSchema,
  InterpretedItemSchema,
  SummarySchema,
  InterpretedKeyName
> {
  return definition;
}
