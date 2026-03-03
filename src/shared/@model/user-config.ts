import { z } from "zod/mini";

import {
  hexColorSchema,
  optionalTrueSchema,
  tagIdSchema,
} from "../@primitives/misc";

const tagOverrideSchema = z.object({
  colorForHighlight: z.exactOptional(hexColorSchema),
  hidden: optionalTrueSchema,
});

export const userConfigSchema = z.readonly(
  z.object({
    tagOverrideLookup: z.record(tagIdSchema, tagOverrideSchema),
    fansDisplay: z.enum(["default", "table"]), // lists of post reactions, comment likes and subscribers
    collectingComments: optionalTrueSchema,
  }),
);

export type UserConfig = z.infer<typeof userConfigSchema>;

export const defaultUserConfig: UserConfig = {
  tagOverrideLookup: {},
  fansDisplay: "default",
};
