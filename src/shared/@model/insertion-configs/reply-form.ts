import { z } from "zod/mini";

import {
  elementCountSelectorSchema,
  elementPlacementSchema,
  elementPresenceSelectorSchema,
  markupEditSchema,
  stringDataSelectorSchema,
} from "./shared/primitives";
import { createInsertionConfigSchema } from "./shared/schema";

export const replyFormInsertionConfigSchema = createInsertionConfigSchema(
  "replyForm",
  {
    markup: z.readonly(
      z.object({
        data: z.readonly(
          z.object({
            accountIdentifier: stringDataSelectorSchema,
            attachedItemCount: elementCountSelectorSchema,
            newAttachmentButtonPresence: elementPresenceSelectorSchema,
          }),
        ),
        edits: z.readonly(z.array(markupEditSchema)),
        ui: z.readonly(
          z.object({
            bnCardAttachmentButton: elementPlacementSchema,
          }),
        ),
      }),
    ),
  },
);

export type ReplyFormInsertionConfig = z.infer<
  typeof replyFormInsertionConfigSchema
>;
