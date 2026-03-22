import type { JsonValue } from "type-fest";

import type { StaticListItemOrigin } from "@/shared/@model/static-list-helpers";
import type { StaticListId } from "@/shared/@model/static-lists";

import { getStaticListDefinitionInfo } from "./definition-helpers";
import type {
  InterpretedStoredRowResult,
  StoredRow,
  StoredRowCachedIndexValues,
} from "./types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isSecondaryIndexSlotName(key: string): key is `s${number}` {
  return /^s\d+$/.test(key);
}

export function extractCachedIndexValues(
  storedRow: StoredRow,
): StoredRowCachedIndexValues {
  const indexValues: StoredRowCachedIndexValues = {};

  if (storedRow.p !== undefined) {
    indexValues.p = storedRow.p;
  }

  for (const [key, value] of Object.entries(storedRow)) {
    if (isSecondaryIndexSlotName(key) && value !== undefined) {
      indexValues[key] = value;
    }
  }

  return indexValues;
}

export function getStoredRowKey(storedRow: StoredRow): string | number {
  return "r" in storedRow ? storedRow.r : storedRow.i;
}

/**
 * This is the single seam that turns source-preserving storage back into typed
 * runtime data.
 *
 * Keeping every read path on top of the same helper is what lets remote rows be
 * stored raw, local malformed rows remain inspectable, and sidepanel/business
 * reads agree on where parse failures begin.
 */
export function interpretStoredRow(
  listId: StaticListId,
  storedRow: StoredRow,
  origin: StaticListItemOrigin,
): InterpretedStoredRowResult {
  const definitionInfo = getStaticListDefinitionInfo(listId);

  let parsedJson: JsonValue | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse output is validated by jsonlItemSchema before interpretation and returned as raw sourceItem otherwise
    parsedJson = JSON.parse(storedRow.t);
  } catch (error) {
    return {
      rowKey: getStoredRowKey(storedRow),
      origin,
      sourceText: storedRow.t,
      sourceItem: undefined,
      logicalPrimaryKey: storedRow.p,
      cachedIndexValues: extractCachedIndexValues(storedRow),
      interpretation: {
        success: false,
        kind: "jsonParse",
        error: getErrorMessage(error),
      },
    };
  }

  const jsonlItemResult =
    definitionInfo.definition.jsonlItemSchema.safeParse(parsedJson);

  if (!jsonlItemResult.success) {
    return {
      rowKey: getStoredRowKey(storedRow),
      origin,
      sourceText: storedRow.t,
      sourceItem: parsedJson,
      logicalPrimaryKey: storedRow.p,
      cachedIndexValues: extractCachedIndexValues(storedRow),
      interpretation: {
        success: false,
        kind: "jsonlSchema",
        error: jsonlItemResult.error.message,
      },
    };
  }

  return {
    rowKey: getStoredRowKey(storedRow),
    origin,
    sourceText: storedRow.t,
    sourceItem: parsedJson,
    logicalPrimaryKey: storedRow.p,
    cachedIndexValues: extractCachedIndexValues(storedRow),
    interpretation: {
      success: true,
      item: definitionInfo.definition.interpretJsonlItem(jsonlItemResult.data),
    },
  };
}
