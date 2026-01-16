import { z } from "zod/mini";

import {
  isoTimeSchema,
  itemCountSchema,
  semverRangeSchema,
} from "./primitives";
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
    generatedAt: isoTimeSchema,
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
                    generatedAt: isoTimeSchema,
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
