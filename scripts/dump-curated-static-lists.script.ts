/**
 * Reads curated static list TypeScript files and dumps them as JSONL.
 *
 * For each .ts file in src/curated-static-lists/, the script:
 * 1. Extracts the default-exported array from the TypeScript source
 * 2. Validates each item against the list definition's interpretedItemSchema
 * 3. Converts data to JSONL format using serializeInterpretedItemAsJsonl()
 * 4. Writes JSONL output to dist/curated-static-lists/{listId}.jsonl
 *
 * Usage: npx tsx scripts/dump-curated-static-lists.script.ts
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import { staticListIdSchema } from "@/shared/@model/dx-config";
import { extractCuratedListFromTs } from "@/shared/@model/static-list-extraction";
import {
  staticListDefinitionLookup,
  staticListIds,
} from "@/shared/@model/static-lists";

const logger = console;

const repoDirPath = path.resolve(import.meta.dirname, "..");
const dataDirPath = path.join(repoDirPath, "src/curated-static-lists");
const outputDirPath = path.join(repoDirPath, "dist/curated-static-lists");

async function main() {
  const entries = await fs.readdir(dataDirPath);
  const tsFiles = entries.filter((entry) => entry.endsWith(".ts")).toSorted();

  if (tsFiles.length === 0) {
    logger.log("No .ts files found in src/curated-static-lists/");
    return;
  }

  await fs.mkdir(outputDirPath, { recursive: true });

  for (const tsFile of tsFiles) {
    const rawListId = tsFile.replace(/\.ts$/, "");
    const listIdResult = staticListIdSchema.safeParse(rawListId);

    if (!listIdResult.success) {
      throw new Error(
        `Unknown static list ID "${rawListId}" (from file ${tsFile}). Known IDs: ${staticListIds.map((id) => `"${id}"`).join(", ")}`,
      );
    }

    const listId = listIdResult.data;
    const definition = staticListDefinitionLookup[listId];

    logger.log(`Processing ${tsFile}...`);

    const filePath = path.join(dataDirPath, tsFile);
    const fileContent = await fs.readFile(filePath, "utf8");

    const rawItems = extractCuratedListFromTs(fileContent);
    if (!rawItems) {
      throw new Error(
        `Could not extract default array from ${tsFile}. Expected "export default [...] satisfies ..." pattern.`,
      );
    }

    const interpretedItems: Array<Record<string, unknown>> = [];
    for (const [index, rawItem] of rawItems.entries()) {
      const parseResult = definition.interpretedItemSchema.safeParse(rawItem);
      if (!parseResult.success) {
        const messages = parseResult.error.issues
          .map(
            (issue) => `${issue.path.map(String).join(".")}: ${issue.message}`,
          )
          .join("; ");
        throw new Error(
          `${tsFile} item ${index}: validation failed: ${messages}`,
        );
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safeParse result is a validated object
      interpretedItems.push(parseResult.data as Record<string, unknown>);
    }

    const jsonlLines: string[] = [];
    /* eslint-disable @typescript-eslint/consistent-type-assertions -- each item in interpretedItems was validated against this exact definition above */
    const serializeInterpretedItemAsJsonl =
      definition.serializeInterpretedItemAsJsonl as (item: unknown) => unknown;
    const jsonlStringifyRow = definition.jsonlStringifyRow as
      | ((item: unknown) => string)
      | undefined;
    /* eslint-enable @typescript-eslint/consistent-type-assertions -- re-enable after bridging the validated definition callbacks */
    for (const interpretedItem of interpretedItems) {
      const jsonlItem = serializeInterpretedItemAsJsonl(interpretedItem);
      const line = jsonlStringifyRow?.(jsonlItem) ?? JSON.stringify(jsonlItem);
      jsonlLines.push(line);
    }

    const outputPath = path.join(outputDirPath, `${listId}.jsonl`);
    const text = jsonlLines.join("\n") + (jsonlLines.length > 0 ? "\n" : "");
    await fs.writeFile(outputPath, text);

    logger.log(
      `  Wrote ${jsonlLines.length} items to ${path.relative(repoDirPath, outputPath)}`,
    );
  }

  logger.log("Done.");
}

main().catch((error: unknown) => {
  logger.error("Failed to dump curated static lists:", error);
  process.exitCode = 1;
});
