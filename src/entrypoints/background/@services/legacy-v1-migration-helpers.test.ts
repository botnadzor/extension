import { describe, expect, it } from "vitest";

import type { AuthInput } from "@/shared/@model/auth";
import { defaultUserConfig } from "@/shared/@model/user-config";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

import {
  migrateAuthInputFromLegacyTokenState,
  migrateUserConfigFromLegacyState,
} from "./legacy-v1-migration-helpers";

function authInput(accessCode: string): AuthInput {
  return {
    accessCode,
    accessCodeEnteredAt: isoDateTimeSchema.parse("2024-01-01T00:00:00Z"),
  };
}

describe("migrateAuthInputFromLegacyTokenState", () => {
  it("should migrate legacy access code into v2 auth input", () => {
    const result = migrateAuthInputFromLegacyTokenState({
      legacyTokenState: {
        userToken: "  legacy-access-code  ",
      },
      migratedAt: isoDateTimeSchema.parse("2024-02-01T00:00:00Z"),
    });

    expect(result).toEqual({
      accessCode: "legacy-access-code",
      accessCodeEnteredAt: isoDateTimeSchema.parse("2024-02-01T00:00:00Z"),
    });
  });

  it("should skip empty legacy access code", () => {
    const result = migrateAuthInputFromLegacyTokenState({
      legacyTokenState: {
        userToken: "   ",
      },
      migratedAt: authInput("").accessCodeEnteredAt,
    });

    expect(result).toBeUndefined();
  });
});

describe("migrateUserConfigFromLegacyState", () => {
  it("should migrate hidden tags, colors and flags", () => {
    const result = migrateUserConfigFromLegacyState({
      legacyConfig: {
        types: [{ id: 1 }, { id: 2 }],
      },
      legacyUserSettings: {
        disabledTypesIds: [1, 999],
        customTypesColors: {
          1: "not-a-color",
          2: " #ABCDEF ",
          3: "#123456",
          abc: "#654321",
        },
        isRepliesCollectingEnabled: true,
        isFansTableView: true,
      },
    });

    expect(result).toEqual({
      tagOverrideLookup: {
        1: {
          hidden: true,
        },
        2: {
          colorForHighlight: "#abcdef",
        },
      },
      fansDisplay: "table",
      collectingComments: true,
    });
  });

  it("should return undefined for legacy state equal to v2 defaults", () => {
    const result = migrateUserConfigFromLegacyState({
      legacyConfig: undefined,
      legacyUserSettings: {
        isFansTableView: false,
        isRepliesCollectingEnabled: false,
      },
    });

    expect(result).toEqual(undefined);
    expect(defaultUserConfig).toEqual({
      tagOverrideLookup: {},
      fansDisplay: "default",
    });
  });
});
