import { execSync } from "node:child_process";

import {
  type BuildInfo,
  stringifyBuildInfoAsVersion,
  stringifyBuildInfoAsVersionName,
} from "./shared/@model/build-info";
import type { BaseExtensionVersionInfo } from "./shared/@model/extension-version";
import { semverSchema } from "./shared/@primitives/semver";
import { isoDateTimeSchema } from "./shared/@primitives/temporal";
import { omitUndefined } from "./shared/omit-undefined";

const repoDirPath = import.meta.dirname;

const extensionVersionNameFromEnv = process.env["WXT_EXTENSION_VERSION_NAME"];
const prBranchCommitHashFromEnv = process.env["WXT_PR_BRANCH_COMMIT_HASH"];
const mergedWithBaseFromEnv = process.env["WXT_MERGED_WITH_BASE"] === "true";

function generateBuildInfoFromEnvironment(configEnvMode: string): BuildInfo {
  const mode = configEnvMode === "development" ? "development" : "production";

  const sanitizedPrBranchCommitHash =
    prBranchCommitHashFromEnv?.match(/^[\da-f]+$/i)?.[0];

  if (prBranchCommitHashFromEnv && !sanitizedPrBranchCommitHash) {
    // eslint-disable-next-line no-restricted-syntax -- early crash of the build process (can't be wrapped into success: true/false)
    throw new Error(
      `Invalid PR branch commit hash: ${prBranchCommitHashFromEnv}. Expected a valid commit hash.`,
    );
  }

  try {
    const commitHash =
      sanitizedPrBranchCommitHash ??
      execSync("git rev-parse HEAD", {
        cwd: repoDirPath,
        encoding: "utf8",
        stdio: "pipe",
      }).trim();

    const commitUnixTimestamp = execSync(
      `git log -1 --format=%ct ${commitHash}`,
      {
        cwd: repoDirPath,
        encoding: "utf8",
        stdio: "pipe",
      },
    ).trim();

    // Check if working tree is dirty (has uncommitted changes)
    const status = execSync("git status --porcelain", {
      cwd: repoDirPath,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();

    const modifiedSinceCommitting = status.length > 0;

    const remark: "modified" | "mergedWithBase" | undefined =
      modifiedSinceCommitting && mode === "production"
        ? "modified"
        : mergedWithBaseFromEnv
          ? "mergedWithBase"
          : undefined;

    return omitUndefined({
      commitHash,
      implementedAt: isoDateTimeSchema.parse(
        Number(commitUnixTimestamp) * 1000,
      ),
      mode,
      remark,
    });
  } catch {
    return {
      implementedAt: isoDateTimeSchema.parse(Date.now()),
      mode,
    };
  }
}

function doGenerateBaseExtensionVersionInfo(
  configEnvMode: string,
): BaseExtensionVersionInfo {
  const buildInfo = generateBuildInfoFromEnvironment(configEnvMode);

  if (extensionVersionNameFromEnv) {
    const parseResult = semverSchema.safeParse(extensionVersionNameFromEnv);

    if (!parseResult.success) {
      // eslint-disable-next-line no-restricted-syntax -- early crash of the build process (can't be wrapped into success: true/false)
      throw new Error(
        `Invalid extension version name: ${extensionVersionNameFromEnv}. Expected a valid semver (e.g. 2.0.0 or 2.0.0-beta.1)`,
      );
    }

    const hasPreReleaseSuffix = parseResult.data.includes("-");

    if (hasPreReleaseSuffix) {
      return {
        buildInfo,
        lifecycle: "prerelease",
        version: stringifyBuildInfoAsVersion(buildInfo),
        versionName: parseResult.data,
      };
    }

    return {
      buildInfo,
      lifecycle: "release",
      version: parseResult.data,
      versionName: parseResult.data,
    };
  }

  return {
    buildInfo,
    lifecycle: "snapshot",
    version: stringifyBuildInfoAsVersion(buildInfo),
    versionName: stringifyBuildInfoAsVersionName(buildInfo),
  };
}

let cachedResult: BaseExtensionVersionInfo | undefined;
let cachedConfigEnvMode: string | undefined;

export function generateBaseExtensionVersionInfo(
  configEnvMode: string,
): BaseExtensionVersionInfo {
  if (cachedResult && cachedConfigEnvMode === configEnvMode) {
    return cachedResult;
  }

  cachedConfigEnvMode = configEnvMode;
  cachedResult = doGenerateBaseExtensionVersionInfo(configEnvMode);

  return cachedResult;
}
