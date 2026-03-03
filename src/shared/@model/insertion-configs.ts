import { z } from "zod/mini";

import { accountInsertionConfigSchema } from "./insertion-configs/account";
import { commentInsertionConfigSchema } from "./insertion-configs/comment";
import { replyFormInsertionConfigSchema } from "./insertion-configs/reply-form";
import { reviewInsertionConfigSchema } from "./insertion-configs/review";

export const insertionConfigSchema = z.union([
  accountInsertionConfigSchema,
  commentInsertionConfigSchema,
  replyFormInsertionConfigSchema,
  reviewInsertionConfigSchema,
]);

export type InsertionConfig = z.infer<typeof insertionConfigSchema>;
export type InsertionVariant = InsertionConfig["variant"];
