import { z } from "zod/mini";

import { optionalTrueSchema } from "../@primitives/misc";
import { isoDateTimeSchema } from "../@primitives/temporal";
import { staticListIds } from "./static-lists";

export const staticListIdSchema = z.enum(staticListIds);

export const dxConfigSchema = z.readonly(
  z.object({
    insertionForceRerenderedAt: z.exactOptional(isoDateTimeSchema),
    insertionDataInDom: optionalTrueSchema,
    insertionFraming: optionalTrueSchema,
    insertionLabeling: optionalTrueSchema,
    insertionsRemoved: optionalTrueSchema,
    sidepanelTab: z.exactOptional(z.enum(staticListIds)),
  }),
);

export type DxConfig = z.infer<typeof dxConfigSchema>;

export const defaultDxConfig: DxConfig = {};
