import { z } from "zod/mini";

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

export const positiveVkIdSchema = z
  .int()
  .check(z.minimum(1), z.maximum(1_000_000_000_000))
  .brand<"PositiveVkId">();
/** @public */
export type PositiveVkId = z.infer<typeof positiveVkIdSchema>;

export const negativeVkIdSchema = z
  .int()
  .check(z.minimum(-1_000_000_000_000), z.maximum(-1))
  .brand<"NegativeVkId">();
/** @public */
export type NegativeVkId = z.infer<typeof negativeVkIdSchema>;

export const vkIdSchema = z.union([positiveVkIdSchema, negativeVkIdSchema]);
/** @public */
export type VkId = z.infer<typeof vkIdSchema>;

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

export type InterpretedVkDomain =
  | {
      kind: "vkId";
      prefix: "id";
      value: PositiveVkId;
    }
  | {
      kind: "vkId";
      prefix: "club" | "group" | "public";
      value: NegativeVkId;
    }
  | {
      kind: "vkNickname";
      value: VkNickname;
    }
  | {
      kind: "invalid";
      value: string;
    };

export function interpretVkDomain(vkDomain: VkDomain): InterpretedVkDomain {
  const [, vkIdPrefix, rawVkId] =
    /^((?:album|albums|clip|clips|club|group|id|photo|photos|poll|public|video|wall|write)?)(-?\d+)(_(\d+))?(_r(\d+))?$/.exec(
      vkDomain,
    ) ?? [];

  const vkIdResult = vkIdSchema.safeParse(Number.parseInt(rawVkId ?? ""));
  if (vkIdResult.success && vkIdPrefix) {
    switch (vkIdPrefix) {
      case "id": {
        return {
          kind: "vkId",
          prefix: "id",
          value: positiveVkIdSchema.parse(vkIdResult.data),
        };
      }
      case "club":
      case "group":
      case "public": {
        return {
          kind: "vkId",
          prefix: vkIdPrefix,
          value: negativeVkIdSchema.parse(vkIdResult.data * -1),
        };
      }

      default: {
        return { kind: "invalid", value: vkDomain };
      }
    }
  }

  const nickname = vkNicknameSchema.parse(vkDomain);
  const invalidVkIdLikeNickname = /^(?:id|public|club|group)0$|^0_\d+$/;

  return invalidVkIdLikeNickname.test(nickname)
    ? { kind: "invalid", value: vkDomain }
    : { kind: "vkNickname", value: nickname };
}

export type AccountIdentifier = Exclude<
  InterpretedVkDomain,
  { kind: "invalid" }
>;

export function stringifyAccountIdentifier(
  accountIdentifier: AccountIdentifier,
): VkDomain {
  if (accountIdentifier.kind === "vkId") {
    return vkDomainSchema.parse(
      `${accountIdentifier.prefix}${Math.abs(accountIdentifier.value)}`,
    );
  }

  return vkDomainSchema.parse(accountIdentifier.value);
}
