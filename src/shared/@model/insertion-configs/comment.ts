import { z } from "zod/mini";

import {
  actionBarPlacementSchema,
  elementPlacementSchema,
  imageUrlSelectorSchema,
  markupEditSchema,
  stringDataSelectorSchema,
} from "./shared/primitives";
import { createInsertionConfigSchema } from "./shared/schema";

export const commentInsertionConfigSchema = createInsertionConfigSchema(
  "comment",
  {
    markup: z.readonly(
      z.object({
        data: z.readonly(
          z.object({
            accountAvatar: imageUrlSelectorSchema,
            accountIdentifier: stringDataSelectorSchema,
            accountName: stringDataSelectorSchema,
            commentIdentifier: z.union([
              z.literal(false),
              stringDataSelectorSchema,
            ]),
            postCommentCount: z.union([
              z.literal(false),
              stringDataSelectorSchema,
            ]),
          }),
        ),
        edits: z.readonly(z.array(markupEditSchema)),
        ui: z.readonly(
          z.object({
            actionBar: actionBarPlacementSchema,
            affiliationBadge: elementPlacementSchema,
            affiliationHighlight: elementPlacementSchema,
            regDate: elementPlacementSchema,
          }),
        ),
      }),
    ),
  },
);

export type CommentInsertionConfig = z.infer<
  typeof commentInsertionConfigSchema
>;
