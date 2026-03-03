import { isEqual } from "es-toolkit";
import semverSatisfies from "semver/functions/satisfies";

import {
  deriveExtensionVersionDeprecation,
  type ExtensionVersionInfo,
} from "@/shared/@model/extension-version";
import type { StaticListItem } from "@/shared/@model/static-lists";
import type { PollResult, PollVersion } from "@/shared/@pollable/core";
import { omitUndefined } from "@/shared/omit-undefined";

import type { RootConfigService } from "./root-config-service";
import type { StaticListsService } from "./static-lists-service";

/**
 * Determines which semver range field to use for filtering announcements.
 *
 * - `"default"`: Always uses `extensionVersionRange`. This is the primary
 *   version range that determines general visibility of the announcement.
 *
 * - `"toast"`: Uses `extensionVersionRangeForToast` if present, otherwise
 *   falls back to `extensionVersionRange`. This allows announcements to have
 *   a narrower version range for toasts while being visible in the default
 *   view for a wider range.
 *
 * Note that announcements are filtered only if the current extension version
 * is a release or a prerelease (e.g. 2.0.0 or 2.0.0-beta.1). Snapshots (i.e.
 * builds from commits or local development builds) do not filter announcements.
 */
export type AnnouncementVersionFilter = "default" | "toast";

// See vite section in wxt.config.ts for the origin of this variable
const baseExtensionVersionInfo = __BASE_EXTENSION_VERSION_INFO__;

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

    const filteredItems = result.value.filter((announcement) => {
      const semverRangeToUse =
        filter === "default"
          ? announcement.extensionVersionRange
          : (announcement.extensionVersionRangeForToast ??
            announcement.extensionVersionRange);

      return semverSatisfies(versionToUse, semverRangeToUse, {
        includePrerelease: true,
      });
    });

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
