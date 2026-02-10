import { nanoid } from "nanoid";
import { z } from "zod/mini";

export const accessCodeSchema = z.string();

export const contentIdSchema = z
  .catch(z.string().check(z.regex(/^[\w-]{4,32}$/)), () => nanoid(8))
  .brand<"ContentId">();
/** @public Identifies an instance of content script (think of this as a tab ID) */
export type ContentId = z.infer<typeof contentIdSchema>;

export const hexColorSchema = z
  .string()
  .check(z.regex(/^#[\da-f]{6}$/))
  .brand<"HexColor">();
/** @public */
export type HexColor = z.infer<typeof hexColorSchema>;

export const itemCountSchema = z.number().check(z.int(), z.nonnegative());
/** @public */
export type ItemCount = z.infer<typeof itemCountSchema>;

export const tagIdSchema = z
  .string()
  .check(z.regex(/^((d|r)?\d+)$/))
  .brand<"TagId">();
/** @public */
export type TagId = z.infer<typeof tagIdSchema>;

export const tagSuggestionSchema = z.union([
  tagIdSchema,
  z.literal("untagged"),
]);
/** @public */
export type TagSuggestion = z.infer<typeof tagSuggestionSchema>;

export const tagTypeSchema = z.enum([
  "accountCategory",
  "accountSubcategory",
  "region",
]);
/** @public */
export type TagType = z.infer<typeof tagTypeSchema>;

export const optionalTrueSchema = z.exactOptional(z.literal(true));
/** @public */
export type OptionalTrue = z.infer<typeof optionalTrueSchema>;
