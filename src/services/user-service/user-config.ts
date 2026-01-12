import { z } from "zod/mini";

import {
  hexColorSchema,
  optionalTrueSchema,
  tagIdSchema,
} from "@/lib/primitive-values";
import { defineStoreWithSchema } from "@/lib/store-with-schema";

const tagOverrideSchema = z.object({
  color: z.exactOptional(hexColorSchema),
  hidden: optionalTrueSchema,
});

const userConfigSchema = z.readonly(
  z.object({
    tagOverrideLookup: z.record(tagIdSchema, tagOverrideSchema),
    likesDisplay: z.enum(["default", "table"]),
    collectingComments: optionalTrueSchema,
  }),
);

export type UserConfig = z.infer<typeof userConfigSchema>;

export const userConfigStore = defineStoreWithSchema(
  "sync:user-config",
  userConfigSchema,
);

export const defaultUserConfig: UserConfig = {
  tagOverrideLookup: {},
  likesDisplay: "default",
};
