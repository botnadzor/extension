/**
 * Syncs the root config seed file with data from the production API.
 *
 * Usage: npx tsx scripts/sync-root-config-seed.script.ts
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import * as prettier from "prettier";

import {
  isoDateTimeSchema,
  semverRangeSchema,
} from "@/shared/@model/primitives";
import { type RootConfig, rootConfigSchema } from "@/shared/@model/root-config";

const logger = console;

const repoDirPath = path.resolve(import.meta.dirname, "..");

// Using GitHub URL to bypass Cloudflare 403
const sourceUrl =
  "https://raw.githubusercontent.com/botnadzor/extension-data/main/root-config.json";

const epochDateTime = isoDateTimeSchema.parse("1970-01-01T00:00:00Z");

async function main() {
  logger.log(`Fetching root config from ${sourceUrl}...`);
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch: ${response.status} ${response.statusText}`,
    );
  }

  const json: unknown = await response.json();
  const config = rootConfigSchema.parse(json);

  logger.log("Transforming config...");
  const seedConfig: RootConfig = {
    ...config,
    extensionVersionRange: semverRangeSchema.parse("*"),
    generatedAt: epochDateTime,
    remoteSystemLookup: {
      ...config.remoteSystemLookup,
      staticApi: {
        ...config.remoteSystemLookup.staticApi,
        // @ts-expect-error -- fromEntries returns a string in tuple key (limitation of TS)
        listLookup: Object.fromEntries(
          Object.entries(config.remoteSystemLookup.staticApi.listLookup).map(
            ([key, value]) => [
              key,
              { ...value, generatedAt: epochDateTime, itemCount: 0 },
            ],
          ),
        ),
      },
    },
  };

  const outputPath = path.join(
    repoDirPath,
    "src/shared/@model/root-config/seed.json",
  );

  logger.log(`Formatting and writing to ${outputPath}...`);
  const prettierConfig = await prettier.resolveConfig(outputPath);
  const formatted = await prettier.format(JSON.stringify(seedConfig), {
    ...prettierConfig,
    filepath: outputPath,
  });

  await fs.writeFile(outputPath, formatted);
  logger.log("Done.");
}

main().catch((error: unknown) => {
  logger.error("Failed to update root config seed:", error);
  process.exitCode = 1;
});
