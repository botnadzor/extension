import { z } from "zod/mini";

import {
  elementPlacementSchema,
  imageUrlSelectorSchema,
  markupEditSchema,
  stringDataSelectorSchema,
} from "./shared/primitives";
import { createInsertionConfigSchema } from "./shared/schema";

export const accountInsertionConfigSchema = createInsertionConfigSchema(
  "account",
  {
    markup: z.readonly(
      z.object({
        data: z.readonly(
          z.object({
            accountAvatar: imageUrlSelectorSchema,
            accountIdentifier: stringDataSelectorSchema,
            accountName: stringDataSelectorSchema,
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

export type AccountInsertionConfig = z.infer<
  typeof accountInsertionConfigSchema
>;
