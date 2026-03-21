import { isJSONObject } from "es-toolkit";
import { z } from "zod/mini";

import { itemCountSchema } from "../@primitives/misc";
import { semverRangeSchema } from "../@primitives/semver";
import { isoDateTimeSchema } from "../@primitives/temporal";
import rootConfigSeedJson from "./root-config/seed.json";
import { staticListIds } from "./static-lists";

export const remoteSystemAliasLookupSchema = z.readonly(
  z.record(
    z.url(),
    z.readonly(z.object({ role: z.exactOptional(z.literal("primary")) })),
  ),
);

const staticListLookupSchema = z.pipe(
  // z.record(z.enum(), ...) or z.looseRecord(z.string(), ...) error on unknown list ids
  // because they are not in the enum. This may create forwards compatibility issues
  // (when we add a new list in the new version and try to read root config with old version).
  // Added z.transform ensures that unknown lists are removed from the lookup.
  // Related issue: https://github.com/colinhacks/zod/issues/5666
  z.transform((input) => {
    const result: Record<string, unknown> = {};
    if (!isJSONObject(input)) {
      return input;
    }
    for (const key of Object.keys(input)) {
      // @ts-expect-error -- expected check of arbitrary string belonging to staticListIds
      if (staticListIds.includes(key)) {
        result[key] = input[key];
      }
    }
    return result;
  }),
  z.readonly(
    z.record(
      z.enum(staticListIds),
      z.readonly(
        z.object({
          generatedAt: isoDateTimeSchema,
          itemCount: itemCountSchema,
        }),
      ),
    ),
  ),
);

export const rootConfigSchema = z.readonly(
  z.object({
    extensionVersionRange: semverRangeSchema,
    generatedAt: isoDateTimeSchema,
    remoteSystemLookup: z.readonly(
      z.object({
        dynamicApi: z.readonly(
          z.object({
            aliasLookup: remoteSystemAliasLookupSchema,
          }),
        ),

        frontend: z.readonly(
          z.object({
            aliasLookup: remoteSystemAliasLookupSchema,
          }),
        ),

        staticApi: z.readonly(
          z.object({
            aliasLookup: remoteSystemAliasLookupSchema,
            listLookup: staticListLookupSchema,
          }),
        ),
      }),
    ),
  }),
);
/** @public */
export type RootConfig = z.infer<typeof rootConfigSchema>;

export const rootConfigSeed = rootConfigSchema.parse(rootConfigSeedJson);

/**
 * Root config schema can evolve on the server and become incompatible with the local schema.
 * This simple schema is used to at least get extension version range from such root config.
 */
export const fallbackRootConfigSchema = z.readonly(
  z.object({
    extensionVersionRange: semverRangeSchema,
  }),
);
/** @public */
export type FallbackRootConfig = z.infer<typeof fallbackRootConfigSchema>;
