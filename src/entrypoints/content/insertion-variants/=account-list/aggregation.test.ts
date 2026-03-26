import { describe, expect, it } from "vitest";

import type { AccountAffiliation } from "@/shared/@model/account-affiliation";
import { hexColorSchema, tagIdSchema } from "@/shared/@primitives/misc";
import { positiveVkIdSchema, vkNicknameSchema } from "@/shared/@primitives/vk";

import {
  deriveAccountChart,
  type DerivedAccountRow,
  mergeRememberedAccounts,
} from "./aggregation";

function createAffiliationWithResolvedVkId(resolvedVkId: number) {
  return {
    color: hexColorSchema.parse("#111111"),
    colorForHighlight: hexColorSchema.parse("#222222"),
    resolvedVkId: positiveVkIdSchema.parse(resolvedVkId),
    tags: [
      {
        color: hexColorSchema.parse("#111111"),
        id: tagIdSchema.parse("1"),
        name: "Tag",
        type: "accountCategory",
      },
    ],
  } satisfies AccountAffiliation;
}

function createNicknameAccount({
  instanceId,
  nickname,
  resolvedVkId,
}: {
  instanceId: string;
  nickname: string;
  resolvedVkId?: number;
}): DerivedAccountRow {
  return {
    ...(resolvedVkId === undefined
      ? {}
      : {
          accountAffiliation: createAffiliationWithResolvedVkId(resolvedVkId),
        }),
    accountIdentifier: {
      kind: "vkNickname",
      value: vkNicknameSchema.parse(nickname),
    },
    accountName: nickname,
    instanceId,
  };
}

describe("deriveAccountChart", () => {
  it("uses resolvedVkId from account affiliation for chart bins", () => {
    const chart = deriveAccountChart([
      createNicknameAccount({
        instanceId: "instance-1",
        nickname: "nickname_user",
        resolvedVkId: 1_234_567,
      }),
    ]);

    expect(chart.buckets).toEqual([
      {
        counts: [0, 1],
        million: 1,
      },
    ]);
  });
});

describe("mergeRememberedAccounts", () => {
  it("uses resolvedVkId as stable identity when merging remembered rows", () => {
    const mergedAccounts = mergeRememberedAccounts({
      currentAccounts: [
        createNicknameAccount({
          instanceId: "instance-2",
          nickname: "new_nickname",
          resolvedVkId: 1_234_567,
        }),
      ],
      rememberedAccounts: [
        createNicknameAccount({
          instanceId: "instance-1",
          nickname: "old_nickname",
          resolvedVkId: 1_234_567,
        }),
      ],
    });

    expect(mergedAccounts).toHaveLength(1);
    expect(mergedAccounts[0]?.instanceId).toBe("instance-2");
    expect(mergedAccounts[0]?.accountIdentifier).toEqual({
      kind: "vkNickname",
      value: vkNicknameSchema.parse("new_nickname"),
    });
  });
});
