import type { StringDataSelector } from "@/shared/@model/insertion-configs/shared/primitives";
import {
  type AccountIdentifier,
  interpretVkDomain,
  negativeVkIdSchema,
  positiveVkIdSchema,
  vkDomainSchema,
} from "@/shared/@primitives/vk";

import { resolveStringDataSelector } from "../selector-resolution";

/**
 * @example
 * - @id123
 * - id123
 * - public123
 */
function parseFromVkDomain(value: string): AccountIdentifier | undefined {
  const vkDomainResult = vkDomainSchema.safeParse(value.replace(/^@/, ""));

  if (!vkDomainResult.success) {
    return;
  }

  const interpretedVkDomain = interpretVkDomain(vkDomainResult.data);

  return interpretedVkDomain.kind === "invalid"
    ? undefined
    : interpretedVkDomain;
}

/**
 * @example
 * - /id123
 * - /id123?hello=world
 * - /id123#fragment
 * - /hello
 * - /public123
 * - /video/@id123
 * - /web/20201231120000/https://vk.com/id1234 - web.archive.org
 */
function parseFromUrl(value: string): AccountIdentifier | undefined {
  const lastSegment = value.split("/").at(-1)?.split(/[?#]/)[0];
  if (!lastSegment) {
    return;
  }

  return parseFromVkDomain(lastSegment);
}

/**
 * @example
 * - 123
 * - -123
 */
function parseFromPlainId(value: string): AccountIdentifier | undefined {
  if (!/^-?\d+$/.test(value)) {
    return;
  }
  const rawVkId = Number.parseInt(value);

  const positiveVkIdResult = positiveVkIdSchema.safeParse(rawVkId);
  if (positiveVkIdResult.success) {
    return { kind: "vkId", value: positiveVkIdResult.data, prefix: "id" };
  }

  const negativeVkIdResult = negativeVkIdSchema.safeParse(rawVkId);
  if (negativeVkIdResult.success) {
    return {
      kind: "vkId",
      value: negativeVkIdResult.data,
      prefix: "public", // we don't have access to the real prefix
    };
  }

  return;
}

/**
 * @returns
 * @example
 * - 12345_678 → 12345
 * - -12345_678 → -12345
 * - something12345_678 → 12345
 * - something-12345_678 → -12345
 * - something_else-12345_678 → -12345
 * - something_else_12345_678 → 12345
 */

function parseFromSlugWithId(value: string): AccountIdentifier | undefined {
  const match = /^[a-z_]*(^-?\d+)_\d+/.exec(value)?.[1];
  if (!match) {
    return;
  }

  return parseFromPlainId(match);
}

export function parseAccountIdentifier(
  value: string,
): AccountIdentifier | undefined {
  const plainIdResult = /^-?\d+$/.test(value)
    ? parseFromPlainId(value)
    : undefined;

  return (
    parseFromSlugWithId(value) ??
    plainIdResult ??
    parseFromVkDomain(value) ??
    parseFromUrl(value) ??
    parseFromPlainId(value)
  );
}

export async function extractAccountIdentifierFromMarkup(
  rootElement: HTMLElement,
  accountIdentifierSelector: StringDataSelector,
): Promise<AccountIdentifier | undefined> {
  return resolveStringDataSelector(
    rootElement,
    accountIdentifierSelector,
    parseAccountIdentifier,
  );
}
