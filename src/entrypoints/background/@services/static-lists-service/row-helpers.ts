import { nanoid } from "nanoid";

import type { StaticListId } from "@/shared/@model/static-lists";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

import { getStaticListDefinitionInfo } from "./definition-helpers";
import type {
  StoredLocalRow,
  StoredRemoteRow,
  StoredRowCachedIndexValues,
} from "./types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringifyJsonlItem(listId: StaticListId, jsonlItem: unknown): string {
  const definition = getStaticListDefinitionInfo(listId).definition;
  return definition.jsonlStringifyRow?.(jsonlItem) ?? JSON.stringify(jsonlItem);
}

/**
 * Cached index values are extracted from the JSONL-form source, not from the
 * interpreted item.
 *
 * This keeps remote and local rows consistent with each other and avoids
 * letting interpretation changes silently rewrite the stored meaning of old
 * remote rows.
 */
export function extractCachedIndexValuesFromJsonlItem(
  listId: StaticListId,
  jsonlItem: unknown,
): StoredRowCachedIndexValues {
  const definitionInfo = getStaticListDefinitionInfo(listId);
  const cachedIndexValues: StoredRowCachedIndexValues = {};

  for (const indexSlot of definitionInfo.allIndexSlots) {
    const extractedValue = indexSlot.definition.extractFromJsonlItem(jsonlItem);
    if (extractedValue !== undefined) {
      cachedIndexValues[indexSlot.slotName] = extractedValue;
    }
  }

  return cachedIndexValues;
}

export function extractCachedIndexValuesFromSourceText(
  listId: StaticListId,
  sourceText: string,
): StoredRowCachedIndexValues {
  const definition = getStaticListDefinitionInfo(listId).definition;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(sourceText);
  } catch {
    return {};
  }

  const jsonlItemResult = definition.jsonlItemSchema.safeParse(parsedJson);
  if (!jsonlItemResult.success) {
    return {};
  }

  return extractCachedIndexValuesFromJsonlItem(listId, jsonlItemResult.data);
}

export function createStoredRemoteRow({
  listId,
  lineNumber,
  sourceText,
}: {
  listId: StaticListId;
  lineNumber: number;
  sourceText: string;
}): StoredRemoteRow {
  return {
    r: lineNumber,
    t: sourceText,
    ...extractCachedIndexValuesFromSourceText(listId, sourceText),
  };
}

function stringifyUnknownSource(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  const jsonString = JSON.stringify(value);
  return typeof jsonString === "string" ? jsonString : String(value);
}

/**
 * Validated local writes still round-trip through the JSONL serializer before
 * hitting storage.
 *
 * That extra step is deliberate: local rows should obey the same raw-storage
 * contract as remote rows so exports, key extraction, and future
 * re-interpretation all see a single source-preserving format.
 */
export function prepareValidatedLocalRow({
  listId,
  item,
  existingRowId,
  updatedAt,
}: {
  listId: StaticListId;
  item: unknown;
  existingRowId: string | undefined;
  updatedAt: number;
}):
  | { success: true; row: StoredLocalRow }
  | { success: false; error: string; details?: unknown } {
  const definition = getStaticListDefinitionInfo(listId).definition;
  const interpretedItemResult =
    definition.interpretedItemSchema.safeParse(item);

  if (!interpretedItemResult.success) {
    return {
      success: false,
      error: "interpretedItemSchema",
      details: interpretedItemResult.error.message,
    };
  }

  const jsonlItem = definition.serializeInterpretedItemAsJsonl(
    interpretedItemResult.data,
  );

  const jsonlItemResult = definition.jsonlItemSchema.safeParse(jsonlItem);
  if (!jsonlItemResult.success) {
    return {
      success: false,
      error: "serializeInterpretedItemAsJsonl",
      details: jsonlItemResult.error.message,
    };
  }

  return {
    success: true,
    row: {
      i: existingRowId ?? nanoid(),
      u: isoDateTimeSchema.parse(updatedAt),
      t: stringifyJsonlItem(listId, jsonlItemResult.data),
      ...extractCachedIndexValuesFromJsonlItem(listId, jsonlItemResult.data),
    },
  };
}

/**
 * Unvalidated local writes exist so the sidepanel can keep malformed rows
 * inspectable and editable instead of rejecting them at write time.
 *
 * We still opportunistically cache keys when the raw text parses, because the
 * ability to shadow or find rows by logical key is more valuable than insisting
 * that every local row be well-formed.
 */
export function prepareUnvalidatedLocalRow({
  listId,
  item,
  existingRowId,
  updatedAt,
}: {
  listId: StaticListId;
  item: unknown;
  existingRowId: string | undefined;
  updatedAt: number;
}): { success: true; row: StoredLocalRow } | { success: false; error: string } {
  try {
    const sourceText = stringifyUnknownSource(item);

    return {
      success: true,
      row: {
        i: existingRowId ?? nanoid(),
        u: isoDateTimeSchema.parse(updatedAt),
        t: sourceText,
        ...extractCachedIndexValuesFromSourceText(listId, sourceText),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
