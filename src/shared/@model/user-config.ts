import { z } from "zod/mini";

import {
  hexColorSchema,
  optionalTrueSchema,
  tagIdSchema,
} from "../primitive-values";

const tagOverrideSchema = z.object({
  color: z.exactOptional(hexColorSchema),
  hidden: optionalTrueSchema,
});

export const userConfigSchema = z.readonly(
  z.object({
    tagOverrideLookup: z.record(tagIdSchema, tagOverrideSchema),
    likesDisplay: z.enum(["default", "table"]),
    collectingComments: optionalTrueSchema,
  }),
);

export type UserConfig = z.infer<typeof userConfigSchema>;

export const defaultUserConfig: UserConfig = {
  tagOverrideLookup: {},
  likesDisplay: "default",
};
