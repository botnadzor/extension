import { nanoid } from "nanoid";
import semverValid from "semver/functions/valid";
import semverValidRange from "semver/ranges/valid";
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

export const isoDateSchema = z
  .string()
  .check(z.regex(/^\d{4}-\d{2}-\d{2}$/))
  .brand<"IsoDate">();
/** @public */
export type IsoDate = z.infer<typeof isoDateSchema>;

export const isoTimeSchema = z
  .pipe(
    z.transform((input: unknown) =>
      input === undefined
        ? new Date().toISOString()
        : input instanceof Date
          ? input.toISOString()
          : typeof input === "number"
            ? new Date(input).toISOString()
            : input,
    ),
    z.string().check(
      z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/),
      z.overwrite((value: string) => value.replace(/\.\d{3}Z/, "Z")),
    ),
  )
  .brand<"IsoString">();
/** @public */
export type IsoTime = z.infer<typeof isoTimeSchema>;

export const itemCountSchema = z.number().check(z.int(), z.nonnegative());
/** @public */
export type ItemCount = z.infer<typeof itemCountSchema>;

/**
 * @example id123, public123 club123 custom_username
 * @example NOT 123, wall123, video123 etc.
 */
export const vkDomainSchema = z
  .string()
  .check(z.regex(/^[\w.]+$/))
  .brand<"VkDomain">();
/** @public */
export type VkDomain = z.infer<typeof vkDomainSchema>;

export const vkIdSchema = z
  .number()
  .check(
    z.int(),
    z.minimum(-5_000_000_000),
    z.maximum(5_000_000_000),
    (ctx) => {
      if (ctx.value === 0) {
        ctx.issues.push({
          code: "custom",
          message: "VkId must be non-zero",
          input: ctx.value,
        });
      }
    },
  )
  .brand<"VkId">();
/** @public */
export type VkId = z.infer<typeof vkIdSchema>;

export const positiveVkIdSchema = vkIdSchema
  .check(z.minimum(1), z.maximum(5_000_000_000))
  .brand<"PositiveVkId">();
/** @public */
export type PositiveVkId = z.infer<typeof positiveVkIdSchema>;

export function isPositiveVkId(vkId: VkId): vkId is PositiveVkId {
  return vkId > 0;
}

/**
 * @example custom_username
 * @example NOT 123, id123, wall123, video123 etc.
 */
export const vkNicknameSchema = z
  .string()
  .check(z.regex(/^[\w.]+$/))
  .brand<"VkNickname">();
/** @public */
export type VkNickname = z.infer<typeof vkNicknameSchema>;

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

export const semverSchema = z
  .string()
  .check(z.refine(semverValid, "Invalid semver"))
  .brand<"Semver">();
/** @public */
export type Semver = z.infer<typeof semverSchema>;

export const semverRangeSchema = z
  .string()
  .check(z.refine(semverValidRange, "Invalid semver range"))
  .brand<"SemverRange">();
/** @public */
export type SemverRange = z.infer<typeof semverRangeSchema>;

// These types are similar to Json* types from 'type-fest', but they also support `undefined`
export type ConfigObject = { [Key in string]: ConfigValue } & {
  [Key in string]?: ConfigValue;
};
export type ConfigArray = ConfigValue[] | readonly ConfigValue[];
export type ConfigPrimitive = string | number | boolean | null | undefined;
export type ConfigValue = ConfigPrimitive | ConfigObject | ConfigArray;
