import { z } from "zod/mini";

import { isoDateTimeSchema } from "../@primitives/temporal";
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
          startedAt: isoDateTimeSchema,
          summary: z.json(),
          updatedAt: isoDateTimeSchema,
          upstreamInfo: staticListUpstreamInfoSchema,
        }),
      ),
    ),
    next: z.exactOptional(
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
  }),
);
export type StaticListMetadata = z.infer<typeof staticListMetadataSchema>;
