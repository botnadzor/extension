import { z } from "zod/mini";

import { isoTimeSchema } from "./primitives";
import {
  staticListInstanceSchema,
  staticListUpstreamInfoSchema,
} from "./static-list-helpers";
import { staticListIds } from "./static-lists";

export const staticListMetadataSchema = z.readonly(
  z.object({
    listId: z.enum(staticListIds),
    activeInstance: staticListInstanceSchema,
    active: z.exactOptional(
      z.readonly(
        z.object({
          startedAt: isoTimeSchema,
          summary: z.json(),
          updatedAt: isoTimeSchema,
          upstreamInfo: staticListUpstreamInfoSchema,
        }),
      ),
    ),
    next: z.exactOptional(
      z.readonly(
        z.object({
          lockId: z.string(),
          startedAt: isoTimeSchema,
          summary: z.json(),
          updatedAt: isoTimeSchema,
          upstreamInfo: staticListUpstreamInfoSchema,
        }),
      ),
    ),
  }),
);
export type StaticListMetadata = z.infer<typeof staticListMetadataSchema>;
