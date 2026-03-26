import { z } from "zod/mini";

import {
  elementPlacementSchema,
  elementSelectorSchema,
  markupEditSchema,
} from "./shared/primitives";
import { createInsertionConfigSchema } from "./shared/schema";

export const accountListInsertionConfigSchema = createInsertionConfigSchema(
  "accountList",
  {
    markup: z.readonly(
      z.object({
        data: z.readonly(
          z.object({
            accountList: elementSelectorSchema,
            activeTab: z.union([z.literal(false), elementSelectorSchema]),
            loadMoreButton: z.union([z.literal(false), elementSelectorSchema]),
          }),
        ),
        edits: z.readonly(z.array(markupEditSchema)),
        ui: z.readonly(
          z.object({
            /**
             * Placement for the chart summary block and the surrounding text /
             * controls that live in the account-list shadow root above the
             * native account list.
             */
            summary: elementPlacementSchema,
            /**
             * A ghost DOM anchor used only to measure where the React table
             * overlay should appear inside the shadow root. It should stay
             * mounted, use `pointer-events: none`, and typically be positioned
             * absolutely so its resolved bbox and paddings can be mirrored by
             * the overlay table without relying on `markup.data.accountList`.
             */
            tableMeasurer: elementPlacementSchema,
          }),
        ),
      }),
    ),
  },
);

export type AccountListInsertionConfig = z.infer<
  typeof accountListInsertionConfigSchema
>;
