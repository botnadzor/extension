/**
 * Generates an OpenAPI specification from the oRPC contract definitions.
 *
 * Usage: npx tsx scripts/generate-openapi-spec.script.ts
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { stringify as stringifyYaml } from "yaml";

import { inspectorTriggerSchema } from "@/shared/@model/inspector";
import {
  accessCodeSchema,
  isoDateSchema,
  isoDateTimeSchema,
  positiveVkIdSchema,
  vkDomainSchema,
  vkIdSchema,
} from "@/shared/@model/primitives";

import {
  orpcContractLookup,
  problemLookup,
} from "../src/entrypoints/background/@service-helpers/dynamic-api-endpoints";

const logger = console;

const repoDirPath = path.resolve(import.meta.dirname, "..");

async function main() {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const spec = await generator.generate(orpcContractLookup, {
    info: {
      title: "Botnadzor Dynamic API",
      version: "0.0.0",
      description: "API used in the Botnadzor browser extension",
      contact: { url: "https://botnadzor.org/contact" },
    },
    servers: [{ url: "https://extension.botnadzor.org/dynamic" }],
    commonSchemas: {
      AccessCode: { schema: accessCodeSchema },
      InspectorTrigger: { schema: inspectorTriggerSchema },
      IsoDate: { schema: isoDateSchema },
      IsoDateTime: { schema: isoDateTimeSchema },
      PositiveVkId: { schema: positiveVkIdSchema },
      VkDomain: { schema: vkDomainSchema },
      VkId: { schema: vkIdSchema },

      ...Object.fromEntries(
        Object.entries(problemLookup).map(([key, value]) => [
          key.replace("problemSchemaFor", "Problem:"),
          { schema: value },
        ]),
      ),
    },
  });

  const outputPath = path.join(
    repoDirPath,
    "dist/dynamic-api-openapi-spec.yaml",
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, stringifyYaml(spec));

  logger.log(`OpenAPI spec generated at: ${outputPath}`);
}

main().catch((error: unknown) => {
  logger.error("Failed to generate OpenAPI spec:", error);
  process.exitCode = 1;
});
