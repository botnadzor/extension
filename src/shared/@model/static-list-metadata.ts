import { z } from "zod/mini";

import { isoDateTimeSchema } from "../@primitives/temporal";
import {
  staticListCombiningModeSchema,
  staticListRemoteInstanceSchema,
  staticListUpstreamInfoSchema,
} from "./static-list-helpers";
import { staticListIds } from "./static-lists";

export const staticListMetadataSchema = z.readonly(
  z.object({
    listId: z.enum(staticListIds),
    combiningMode: staticListCombiningModeSchema,
    combinedSummary: z.exactOptional(z.json()),
    remoteActiveInstance: staticListRemoteInstanceSchema,
    remoteActive: z.exactOptional(
      z.readonly(
        z.object({
          startedAt: isoDateTimeSchema,
          summary: z.json(),
          updatedAt: isoDateTimeSchema,
          upstreamInfo: staticListUpstreamInfoSchema,
        }),
      ),
    ),
    remoteNext: z.exactOptional(
      z.readonly(
        z.object({
          lockId: z.string(),
          startedAt: isoDateTimeSchema,
          summary: z.json(),
          updatedAt: isoDateTimeSchema,
          upstreamInfo: staticListUpstreamInfoSchema,
        }),
      ),
    ),
    localSummary: z.exactOptional(z.json()),
    localUpdatedAt: z.exactOptional(isoDateTimeSchema),
  }),
);
export type StaticListMetadata = z.infer<typeof staticListMetadataSchema>;
