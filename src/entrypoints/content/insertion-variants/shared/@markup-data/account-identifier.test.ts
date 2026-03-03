import { describe, expect, it } from "vitest";

import {
  type AccountIdentifier,
  negativeVkIdSchema,
  positiveVkIdSchema,
  vkNicknameSchema,
} from "@/shared/@primitives/vk";

import { parseAccountIdentifier } from "./account-identifier";

function accountId(value: number): AccountIdentifier {
  return {
    kind: "vkId",
    value: positiveVkIdSchema.parse(value),
    prefix: "id",
  };
}

function communityId(
  value: number,
  prefix: "club" | "group" | "public" = "public",
): AccountIdentifier {
  return {
    kind: "vkId",
    value: negativeVkIdSchema.parse(-value),
    prefix,
  };
}

function nickname(value: string): AccountIdentifier {
  return {
    kind: "vkNickname",
    value: vkNicknameSchema.parse(value),
  };
}

describe("parseAccountIdentifier", () => {
  it.each<[string, AccountIdentifier | undefined]>([
    // Slug with id at first position
    ["1234_5678", accountId(1234)],
    ["-1234_5678", communityId(1234)],
    ["1_0", accountId(1)],
    ["-1_0", communityId(1)],
    ["1234_678extra", accountId(1234)],
    ["5000000000_1", accountId(5_000_000_000)],
    ["-5000000000_1", communityId(5_000_000_000)],

    // Vk domain
    ["@id123", accountId(123)],
    ["id123", accountId(123)],
    ["id1234_5678", accountId(1234)],
    ["id1", accountId(1)],
    ["id123_456", accountId(123)],
    ["id123_r789", accountId(123)],
    ["public123", communityId(123)],
    ["club123", communityId(123, "club")],
    ["group123", communityId(123, "group")],
    ["user.name", nickname("user.name")],

    // URL
    ["/id123", accountId(123)],
    ["/id123?hello=world", accountId(123)],
    ["/id123#fragment", accountId(123)],
    ["/public123", communityId(123)],
    ["/video/@id123", accountId(123)],
    ["/video/id123", accountId(123)],
    ["https://vk.com/id123", accountId(123)],
    ["https://vk.com/id123?hello=world", accountId(123)],
    ["https://vk.com/id123#fragment", accountId(123)],
    ["https://vk.com/public123", communityId(123)],
    ["https://vk.com/video/@id123", accountId(123)],
    ["https://vk.com/video/id123", accountId(123)],
    ["/testing", nickname("testing")],

    // Plain id
    ["1", accountId(1)],
    ["123", accountId(123)],
    ["-1", communityId(1)],
    ["-123", communityId(123)],
  ])("should parse account identifier from %s", (value, expected) => {
    expect(parseAccountIdentifier(value)).toEqual(expected);
  });

  it.each<string>([
    "",
    "@",
    "wall123",
    "video123",
    "album123",
    "photo123",
    "clip123_456",
    "id0",
    "public0",
    "0_1",
    "id 123",
    "id@123",
    "/id123/",
    "/?id=123",
    "not-a-valid-id",
  ])("should return undefined for %s", (value) => {
    expect(parseAccountIdentifier(value)).toBeUndefined();
  });
});
