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
            listLookup: z.readonly(
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
