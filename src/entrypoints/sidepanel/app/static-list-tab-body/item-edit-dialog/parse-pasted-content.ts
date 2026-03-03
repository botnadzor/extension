import { jsonrepair } from "jsonrepair";
import type { z } from "zod/mini";

import { extractCuratedListFromTs } from "@/shared/@model/static-list-extraction";
import type { StaticListDefinition } from "@/shared/@model/static-list-helpers";
import type {
  StaticListId,
  StaticListItem,
} from "@/shared/@model/static-lists";

export type ParseResult =
  | { success: true; storedItems: Array<StaticListItem<StaticListId>> }
  | { success: false; error: string };

export function parsePastedContent(
  text: string,
  definition: StaticListDefinition,
): ParseResult {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { success: false, error: "Вставьте JSON или JSONL" };
  }

  // Attempt TypeScript array extraction first (handles full .ts file paste)
  const extractedItems = extractCuratedListFromTs(trimmed);

  // Try as single JSON (array of stored items, same as "Copy as JSON")
  let parsed: unknown = extractedItems;
  if (!parsed) {
    try {
      const repaired = jsonrepair(trimmed);
      parsed = JSON.parse(repaired);
    } catch {
      // Not valid single JSON — treat as JSONL
    }
  }

  if (parsed) {
    const storedItems: Array<StaticListItem<StaticListId>> = [];
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    for (const [i, item] of parsedItems.entries()) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type-casting is needed because we deal with a generic list
      const result = definition.storedItemSchema.safeParse(
        item,
      ) as z.util.SafeParseResult<StaticListItem<StaticListId>>;

      if (!result.success) {
        const messages = result.error.issues
          .map(
            (issue) => `${issue.path.map(String).join(".")}: ${issue.message}`,
          )
          .join("; ");
        return {
          success: false,
          error: `Элемент ${i + 1}: ${messages}`,
        };
      }
      storedItems.push(result.data);
    }
    if (storedItems.length > 0) {
      return { success: true, storedItems };
    }
  }

  // JSONL: one JSON value per line (received format), empty lines ignored
  const lines = trimmed.split("\n");
  const storedItems: Array<StaticListItem<StaticListId>> = [];
  for (const [i, line] of lines.entries()) {
    if (line.trim() === "") {
      continue;
    }
    let lineParsed: unknown;
    try {
      const repairedLine = jsonrepair(line);
      lineParsed = JSON.parse(repairedLine);
    } catch {
      return {
        success: false,
        error: `Строка ${i + 1}: невалидный JSON`,
      };
    }
    const receivedResult = definition.receivedItemSchema.safeParse(lineParsed);
    if (!receivedResult.success) {
      const messages = receivedResult.error.issues
        .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
        .join("; ");
      return {
        success: false,
        error: `Строка ${i + 1}: ${messages}`,
      };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type-casting is needed because we deal with a generic list
      const stored = definition.mapReceivedToStored(
        receivedResult.data,
      ) as StaticListItem<StaticListId>;

      storedItems.push(stored);
    } catch (mapError) {
      const message =
        mapError instanceof Error ? mapError.message : String(mapError);
      return {
        success: false,
        error: `Строка ${i + 1}: ${message}`,
      };
    }
  }

  return { success: true, storedItems };
}
