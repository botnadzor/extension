import { isEqual } from "es-toolkit";
import semverSatisfies from "semver/functions/satisfies";

import {
  baseExtensionVersionInfo,
  deriveExtensionVersionDeprecation,
  type ExtensionVersionInfo,
} from "@/shared/@model/extension-version";
import type { StaticListItem } from "@/shared/@model/static-lists";
import type { PollResult, PollVersion } from "@/shared/@pollable/core";
import { omitUndefined } from "@/shared/omit-undefined";

import type { RootConfigService } from "./root-config-service";
import type { StaticListsService } from "./static-lists-service";

/**
 * Determines how announcements are filtered by extension version.
 *
 * - `"default"`: Uses only `extensionVersionRange`, which controls whether the
 *   announcement is visible at all.
 *
 * - `"toast"`: First applies `extensionVersionRange`, then additionally applies
 *   `extensionVersionRangeForToast` when present. This allows toast visibility
 *   to be narrower than the general announcement visibility, but never wider.
 *
 * Announcements are filtered only for release and prerelease builds
 * (e.g. 2.0.0 or 2.0.0-beta.1). Snapshot builds do not filter announcements.
 */
export type AnnouncementVersionFilter = "default" | "toast";

function checkVersionRange(versionToUse: string, semverRange: string): boolean {
  return semverSatisfies(versionToUse, semverRange, {
    includePrerelease: true,
  });
}

function applyFilter(
  announcement: StaticListItem<"announcements">,
  filter: AnnouncementVersionFilter,
  versionToUse: string,
): boolean {
  if (!checkVersionRange(versionToUse, announcement.extensionVersionRange)) {
    return false;
  }

  if (filter !== "toast" || !announcement.extensionVersionRangeForToast) {
    return true;
  }

  return checkVersionRange(
    versionToUse,
    announcement.extensionVersionRangeForToast,
  );
}

export class ExtensionVersionService {
  private readonly rootConfigService: RootConfigService;
  private readonly staticListsService: StaticListsService;

  private lastPolledExtensionVersionInfoValue: ExtensionVersionInfo | undefined;

  constructor({
    rootConfigService,
    staticListsService,
  }: {
    rootConfigService: RootConfigService;
    staticListsService: StaticListsService;
  }) {
    this.rootConfigService = rootConfigService;
    this.staticListsService = staticListsService;
  }

  async getInfo(): Promise<ExtensionVersionInfo> {
    const result = await this.pollInfo(undefined);
    return result.value;
  }

  async pollInfo(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<ExtensionVersionInfo>> {
    const extensionVersionRangeResult =
      await this.rootConfigService.pollExtensionVersionRange(lastPollVersion);

    const ageInDays = Math.floor(
      (Date.now() -
        new Date(baseExtensionVersionInfo.buildInfo.implementedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const deprecation = deriveExtensionVersionDeprecation(
      baseExtensionVersionInfo,
      extensionVersionRangeResult.value,
      ageInDays,
    );

    const value = omitUndefined({ ...baseExtensionVersionInfo, deprecation });

    // Return the same object reference if extension version info has not changed since the last poll
    if (
      this.lastPolledExtensionVersionInfoValue &&
      isEqual(value, this.lastPolledExtensionVersionInfoValue)
    ) {
      return {
        value: this.lastPolledExtensionVersionInfoValue,
        version: extensionVersionRangeResult.version,
      };
    }

    this.lastPolledExtensionVersionInfoValue = value;
    return { value, version: extensionVersionRangeResult.version };
  }

  async getFilteredAnnouncements(
    filter: AnnouncementVersionFilter,
  ): Promise<Array<StaticListItem<"announcements">>> {
    const result = await this.pollFilteredAnnouncements(undefined, filter);
    return result.value;
  }

  async pollFilteredAnnouncements(
    lastPollVersion: PollVersion | undefined,
    filter: AnnouncementVersionFilter,
  ): Promise<PollResult<Array<StaticListItem<"announcements">>>> {
    const result = await this.staticListsService.pollItems(
      lastPollVersion,
      "announcements",
    );

    const versionToUse =
      baseExtensionVersionInfo.lifecycle === "prerelease" ||
      baseExtensionVersionInfo.lifecycle === "release"
        ? baseExtensionVersionInfo.versionName
        : undefined;

    if (!versionToUse) {
      return result;
    }

    const filteredItems = result.value.filter((announcement) =>
      applyFilter(announcement, filter, versionToUse),
    );

    return { value: filteredItems, version: result.version };
  }

  async getFilteredInsertions(): Promise<Array<StaticListItem<"insertions">>> {
    const result = await this.pollFilteredInsertions(undefined);
    return result.value;
  }

  async pollFilteredInsertions(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<Array<StaticListItem<"insertions">>>> {
    const result = await this.staticListsService.pollItems(
      lastPollVersion,
      "insertions",
    );

    const versionToUse =
      baseExtensionVersionInfo.lifecycle === "prerelease" ||
      baseExtensionVersionInfo.lifecycle === "release"
        ? baseExtensionVersionInfo.versionName
        : undefined;

    if (!versionToUse) {
      return result;
    }

    const filteredItems = result.value.filter((insertion) => {
      return (
        !insertion.extensionVersionRange ||
        semverSatisfies(versionToUse, insertion.extensionVersionRange, {
          includePrerelease: true,
        })
      );
    });

    return { value: filteredItems, version: result.version };
  }
}
