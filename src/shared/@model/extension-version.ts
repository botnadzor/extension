import semverSatisfies from "semver/functions/satisfies";

import type { Semver, SemverRange } from "../@primitives/semver";
import type { BuildInfo } from "./build-info";

type ExtensionLifecycle = "release" | "prerelease" | "snapshot";

export type BaseExtensionVersionInfo = {
  buildInfo: BuildInfo;
  lifecycle: ExtensionLifecycle;
  version: Semver;
  versionName: string;
};

export type ExtensionVersionDeprecation =
  | {
      reason: "aged";
      ageInDays: number;
      allowedAgeInDays: number;
    }
  | {
      reason: "noLongerSupportedByApi";
      supportedExtensionVersionRange: SemverRange;
    };

export type ExtensionVersionInfo = BaseExtensionVersionInfo & {
  deprecation?: ExtensionVersionDeprecation;
};

const allowedAgeInDaysLookup: Partial<Record<ExtensionLifecycle, number>> = {
  prerelease: 14,
  snapshot: 7,
};

export function deriveExtensionVersionDeprecation(
  baseInfo: BaseExtensionVersionInfo,
  supportedExtensionVersionRange: SemverRange,
  ageInDays: number,
): ExtensionVersionDeprecation | undefined {
  if (
    (baseInfo.lifecycle === "release" || baseInfo.lifecycle === "prerelease") &&
    !semverSatisfies(baseInfo.versionName, supportedExtensionVersionRange, {
      includePrerelease: true,
    })
  ) {
    return {
      reason: "noLongerSupportedByApi",
      supportedExtensionVersionRange,
    };
  }

  const allowedAgeInDays = allowedAgeInDaysLookup[baseInfo.lifecycle];

  if (typeof allowedAgeInDays !== "number" || ageInDays <= allowedAgeInDays) {
    return undefined;
  }

  return {
    reason: "aged",
    allowedAgeInDays,
    ageInDays,
  };
}
