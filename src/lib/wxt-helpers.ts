// cspell:ignore MMDD XMMDD hhmm

import { execSync } from "node:child_process";

import { type Semver, semverSchema } from "./primitive-values";

const repoDirPath = import.meta.dirname;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Takes timestamp in milliseconds and returns YYYYMMDDhhmmss in UTC timezone
 */
function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);

  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

type GitInfo = {
  commitHash: string; // full hash length
  commitTimestamp: number; // in milliseconds
  modifiedSinceCommitting: boolean;
  prBehindBase: boolean; // true if process.env["WXT_PR_BEHIND_BASE"] is true
};

function collectGitInfo(
  givenCommitHash: string | undefined,
): GitInfo | undefined {
  try {
    const commitHash =
      givenCommitHash ??
      execSync("git rev-parse HEAD", {
        cwd: repoDirPath,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

    const commitUnixTimestamp = execSync(
      `git log -1 --format=%ct ${commitHash}`,
      {
        cwd: repoDirPath,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();

    // Check if working tree is dirty (has uncommitted changes)
    const status = execSync("git status --porcelain", {
      cwd: repoDirPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    return {
      commitHash,
      commitTimestamp: Number(commitUnixTimestamp) * 1000,
      modifiedSinceCommitting: status.length > 0,
      prBehindBase: process.env["WXT_PR_BEHIND_BASE"] === "true",
    };
  } catch {
    return undefined;
  }
}

/**
 * If `WXT_EXTENSION_VERSION_NAME` is set, returns it as is.
 *
 * Otherwise, returns YYMMDD.COMMIT_HASH[-SUFFIX].
 * SUFFIX can be "dev" for dev mode or "modified" for production mode
 * with modifications since last commit.
 */
function generateExtensionVersionName(
  mode: string,
  gitInfo: GitInfo | undefined,
): string {
  const envVar: unknown = process.env["WXT_EXTENSION_VERSION_NAME"];

  if (typeof envVar === "string") {
    return semverSchema.parse(envVar);
  }

  const modeIdentifier = mode === "development" ? "dev" : "build";

  const releaseIdentifiers: string[] = [];

  if (gitInfo) {
    let commitHashSuffix = "";
    if (mode === "prod" && gitInfo.modifiedSinceCommitting) {
      commitHashSuffix = "-modified";
    } else if (gitInfo.prBehindBase) {
      commitHashSuffix = "-merged-with-base";
    }

    releaseIdentifiers.push(
      modeIdentifier,
      formatTimestamp(gitInfo.commitTimestamp).slice(2, 8) /* YYMMDD */,
      `${gitInfo.commitHash.slice(0, 7)}${commitHashSuffix}`,
    );
  } else {
    releaseIdentifiers.push(
      modeIdentifier,
      formatTimestamp(Date.now()),
      "nogit",
    );
  }

  return releaseIdentifiers.join(".");
}

/**
 * Returns 0.XMMDD.hhmmS
 * Where
 * - X is the year offset from 2025 (e.g. 1 for 2026, 2 for 2027, etc.)
 * - MMDD is the month and day
 * - hhmm is the hour and minute (leading zeros are omitted)
 * - S is the build suffix
 *   - 0 is for production mode
 *   - 1 is for production mode with modifications since last commit
 *   - 2 is for production mode with PR behind base
 *   - 8 is for production mode with no git info available
 *   - 9 is for dev mode
 */
function generateFallbackExtensionVersion(
  mode: string,
  gitInfo: GitInfo | undefined,
): Semver {
  const timestampToUse = gitInfo?.commitTimestamp ?? Date.now();
  const formattedTimestamp = formatTimestamp(timestampToUse);

  // We can only use numbers between 1 and 65536, trimming bits of date to fit
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/version

  const year = Number(formattedTimestamp.slice(0, 4) /* YYYY */);
  const yearWithOffset = year - 2025;

  const minor = `${yearWithOffset}${formattedTimestamp.slice(4, 8) /* MMDD */}`;

  let buildSuffix: number;
  if (mode === "development") {
    buildSuffix = 9;
  } else if (gitInfo) {
    if (gitInfo.modifiedSinceCommitting) {
      buildSuffix = 1;
    } else if (gitInfo.prBehindBase) {
      buildSuffix = 2;
    } else {
      buildSuffix = 0;
    }
  } else {
    buildSuffix = 8;
  }

  const patch =
    Number(formattedTimestamp.slice(8, 12) /* hhmm */) * 10 + buildSuffix;

  return semverSchema.parse(`0.${minor}.${patch}`);
}

export function determineExtensionVersioning(mode: string): {
  extensionVersion: Semver;
  extensionVersionName: string;
  publishable: boolean;
} {
  const extensionVersionNameFromEnv = process.env["WXT_EXTENSION_VERSION_NAME"];
  const gitInfo = collectGitInfo(process.env["WXT_PR_BRANCH_COMMIT_HASH"]);

  if (extensionVersionNameFromEnv) {
    const extensionVersionNameResult = semverSchema.safeParse(
      extensionVersionNameFromEnv,
    );

    if (!extensionVersionNameResult.success) {
      // eslint-disable-next-line no-restricted-syntax -- early crash of the build process (can't be wrapped into success: true/false)
      throw new Error(
        `Invalid extension version name: ${process.env["WXT_EXTENSION_VERSION_NAME"]}. Expected a valid semver.`,
      );
    }

    const [extensionVersion, preReleaseSuffix] =
      extensionVersionNameResult.data.split("-");

    return {
      extensionVersion: preReleaseSuffix
        ? generateFallbackExtensionVersion(mode, gitInfo)
        : semverSchema.parse(extensionVersion),
      extensionVersionName: extensionVersionNameResult.data,
      publishable: !preReleaseSuffix,
    };
  }

  return {
    extensionVersion: generateFallbackExtensionVersion(mode, gitInfo),
    extensionVersionName: generateExtensionVersionName(mode, gitInfo),
    publishable: false,
  };
}
