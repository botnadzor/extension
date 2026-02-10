// cspell:ignore MMDD XMMDD hhmm

import { type Semver, semverSchema } from "../@primitives/semver";
import type { IsoDateTime } from "../@primitives/temporal";

export type BuildMode = "production" | "development";

/** Additional information about the build (to distinguish edge cases) */
export type BuildRemark = "modified" | "mergedWithBase";

export type BuildInfo = {
  /** Commit hash if known */
  commitHash?: string;
  /** Commit time if known, build time otherwise */
  implementedAt: IsoDateTime;
  mode: BuildMode;
  remark?: BuildRemark;
};

const snapshotVersionYearOffset = 2025;

const buildSuffixMeaningLookup = {
  0: { mode: "production", noGit: false, remark: undefined },
  1: { mode: "production", noGit: false, remark: "modified" },
  2: { mode: "production", noGit: false, remark: "mergedWithBase" },
  8: { mode: "production", noGit: true, remark: undefined },
  9: { mode: "development", noGit: false, remark: undefined },
} as const satisfies Record<
  number,
  { mode: BuildMode; noGit: boolean; remark: BuildRemark | undefined }
>;

/** {@link buildSuffixMeaningLookup} */
type BuildSuffix = keyof typeof buildSuffixMeaningLookup;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function findMatchingBuildSuffix(buildInfo: BuildInfo): BuildSuffix {
  for (const [rawSuffix, meaning] of Object.entries(buildSuffixMeaningLookup)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- key is always a valid BuildSuffix digit from the record
    const suffix = Number(rawSuffix) as BuildSuffix;
    if (
      meaning.mode === buildInfo.mode &&
      meaning.noGit === !buildInfo.commitHash &&
      meaning.remark === buildInfo.remark
    ) {
      return suffix;
    }
  }

  return 8;
}

/**
 * Format: `0.XMMDD.hhmmS`
 *
 * Where:
 * - `X` is the year offset from 2025 (e.g. 1 for 2026, 2 for 2027, etc.)
 * - `MMDD` is the month and day
 * - `hhmm` is the hour and minute (leading zeros are omitted)
 * - `S` is the build suffix (see {@link buildSuffixMeaningLookup})
 *
 * This operation is lossy. Date and time are assumed to be in UTC.
 */
export function stringifyBuildInfoAsVersion(buildInfo: BuildInfo): Semver {
  const date = new Date(buildInfo.implementedAt);
  const yearWithOffset = date.getUTCFullYear() - snapshotVersionYearOffset;

  const semverMinor = `${yearWithOffset}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;

  const hhmm = date.getUTCHours() * 100 + date.getUTCMinutes();
  const semverPatch = hhmm * 10 + findMatchingBuildSuffix(buildInfo);

  return semverSchema.parse(`0.${semverMinor}.${semverPatch}`);
}

/**
 * Format: `{prefix}.{YYMMDD}.{commit}[-suffix]`
 * or `{prefix}.{YYMMDDhhmmss}.nogit` when git info is unavailable.
 *
 * Where:
 * - `prefix` is `"dev"` for development builds and `"build"` for production builds
 * - `YYMMDD` is the year, month and day
 * - `commit` is the first 7 characters of the commit hash
 * - `suffix` is the build suffix in kebab-case (e.g. `-modified`)
 *
 * This operation is lossy. Date and time are assumed to be in UTC.
 */
export function stringifyBuildInfoAsVersionName(buildInfo: BuildInfo): string {
  const prefix = buildInfo.mode === "development" ? "dev" : "build";

  if (!buildInfo.commitHash) {
    const date = new Date(buildInfo.implementedAt);
    const timestamp =
      String(date.getUTCFullYear()).slice(2) +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds());
    return `${prefix}.${timestamp}.nogit`;
  }

  const date = new Date(buildInfo.implementedAt);
  const yymmdd =
    String(date.getUTCFullYear()).slice(2) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate());

  const suffix =
    buildInfo.remark === "modified"
      ? "-modified"
      : buildInfo.remark === "mergedWithBase"
        ? "-merged-with-base"
        : "";

  return `${prefix}.${yymmdd}.${buildInfo.commitHash.slice(0, 7)}${suffix}`;
}
