import { z } from "zod/mini";

import {
  elementPlacementSchema,
  imageUrlSelectorSchema,
  markupEditSchema,
  stringDataSelectorSchema,
} from "./shared/primitives";
import { createInsertionConfigSchema } from "./shared/schema";

export const reviewInsertionConfigSchema = createInsertionConfigSchema(
  "review",
  {
    markup: z.readonly(
      z.object({
        data: z.readonly(
          z.object({
            accountAvatar: imageUrlSelectorSchema,
            accountIdentifier: stringDataSelectorSchema,
            accountName: stringDataSelectorSchema,
            reviewIdentifier: z.union([
              z.literal(false),
              stringDataSelectorSchema,
            ]),
          }),
        ),
        edits: z.readonly(z.array(markupEditSchema)),
        ui: z.readonly(
          z.object({
            actionBar: elementPlacementSchema,
            affiliationBadge: elementPlacementSchema,
            affiliationHighlight: elementPlacementSchema,
            regDate: elementPlacementSchema,
          }),
        ),
      }),
    ),
  },
);

export type ReviewInsertionConfig = z.infer<typeof reviewInsertionConfigSchema>;
