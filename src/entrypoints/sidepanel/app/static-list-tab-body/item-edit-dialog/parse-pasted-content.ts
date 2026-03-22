import { jsonrepair } from "jsonrepair";
import type { z } from "zod/mini";

import { extractCuratedListFromTs } from "@/shared/@model/static-list-extraction";
import type { StaticListDefinition } from "@/shared/@model/static-list-helpers";
import type { StaticListItem } from "@/shared/@model/static-lists";

export type ParseResult =
  | { success: true; interpretedItems: StaticListItem[] }
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

  // Try as single JSON (array of interpreted items, same as "Copy as JSON")
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
    const interpretedItems: StaticListItem[] = [];
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    for (const [i, item] of parsedItems.entries()) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type-casting is needed because we deal with a generic list
      const result = definition.interpretedItemSchema.safeParse(
        item,
      ) as z.util.SafeParseResult<StaticListItem>;

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
      interpretedItems.push(result.data);
    }
    if (interpretedItems.length > 0) {
      return { success: true, interpretedItems };
    }
  }

  // JSONL: one JSON value per line (JSONL format), empty lines ignored
  const lines = trimmed.split("\n");
  const interpretedItems: StaticListItem[] = [];
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
    const jsonlItemResult = definition.jsonlItemSchema.safeParse(lineParsed);
    if (!jsonlItemResult.success) {
      const messages = jsonlItemResult.error.issues
        .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
        .join("; ");
      return {
        success: false,
        error: `Строка ${i + 1}: ${messages}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type-casting is needed because we deal with a generic list
    const interpretedItem = definition.interpretJsonlItem(
      jsonlItemResult.data,
    ) as StaticListItem;

    interpretedItems.push(interpretedItem);
  }

  return { success: true, interpretedItems };
}
