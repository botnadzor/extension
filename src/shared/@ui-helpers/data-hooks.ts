import * as React from "react";
import type { JsonValue } from "type-fest";

import type { AnnouncementVersionFilter } from "../../entrypoints/background/@services/extension-version-service";
import type { StaticListMetadata } from "../@model/static-list-metadata";
import type {
  StaticListId,
  StaticListItem,
  StaticListSummary,
} from "../@model/static-lists";
import { createPollableValueHook } from "../@pollable/react";
import type { VkDomain } from "../@primitives/vk";
import {
  authService,
  dxConfigService,
  extensionVersionService,
  frontendService,
  inspectorService,
  notificationService,
  popupService,
  staticListsService,
  userConfigService,
} from "../proxy-services";

export const useAccountInspection = createPollableValueHook(
  (lastPollVersion, vkDomain: VkDomain) =>
    inspectorService.pollAccountInspection(lastPollVersion, vkDomain),
  { hookNameForDebugging: "useAccountInspection" },
);

export const useActivePopupTab = createPollableValueHook(
  (lastPollVersion) => popupService.pollActiveTab(lastPollVersion),
  { hookNameForDebugging: "useActivePopupTab" },
);

export const useAuthCheck = createPollableValueHook(
  (lastPollVersion) => authService.pollAuthCheck(lastPollVersion),
  { hookNameForDebugging: "useAuthCheck" },
);

export const useAuthStatus = createPollableValueHook(
  (lastPollVersion) => authService.pollAuthStatus(lastPollVersion),
  { hookNameForDebugging: "useAuthStatus" },
);

export const useDxConfig = createPollableValueHook(
  (lastPollVersion) => dxConfigService.poll(lastPollVersion),
  { hookNameForDebugging: "useDxConfig" },
);

export const useExtensionVersionInfo = createPollableValueHook(
  (lastPollVersion) => extensionVersionService.pollInfo(lastPollVersion),
  { hookNameForDebugging: "useExtensionVersionInfo" },
);

export const useFilteredAnnouncements = createPollableValueHook(
  (lastPollVersion, filter: AnnouncementVersionFilter) =>
    extensionVersionService.pollFilteredAnnouncements(lastPollVersion, filter),
  { hookNameForDebugging: "useFilteredAnnouncements" },
);

export const useFrontendBaseUrl = createPollableValueHook(
  (lastPollVersion) => frontendService.pollBaseUrl(lastPollVersion),
  { hookNameForDebugging: "useFrontendBaseUrl" },
);

export const useGlobalNotificationsState = createPollableValueHook(
  (lastPollVersion) =>
    notificationService.pollGlobalNotificationsState(lastPollVersion),
  { hookNameForDebugging: "useGlobalNotificationsState" },
);

type UseRemoteStagingStaticListSummary = <ListId extends StaticListId>(
  listId: ListId,
) => StaticListSummary<ListId> | undefined;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mapping generic list return type to specific list summary shape
export const useRemoteStagingStaticListSummary = createPollableValueHook(
  (lastPollVersion, listId: StaticListId) =>
    staticListsService.pollRemoteStagingSummary(lastPollVersion, listId),
  {
    hookNameForDebugging: "useRemoteStagingStaticListSummary",
    throttleInterval: 100,
  },
) as UseRemoteStagingStaticListSummary;

type UseStaticListItems = <ListId extends StaticListId>(
  listId: ListId,
) => Array<StaticListItem<ListId>>;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mapping generic list return type to specific list item shape
export const useStaticListItems = createPollableValueHook(
  (lastPollVersion, listId: StaticListId) =>
    staticListsService.pollItems(lastPollVersion, listId),
  { hookNameForDebugging: "useStaticListItems" },
) as UseStaticListItems;

type UseStaticListMetadata = <ListId extends StaticListId>(
  listId: ListId,
) => StaticListMetadata<ListId>;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mapping generic list return type to specific list metadata shape
export const useStaticListMetadata = createPollableValueHook(
  (lastPollVersion, listId: StaticListId) =>
    staticListsService.pollListMetadata(lastPollVersion, listId),
  { hookNameForDebugging: "useStaticListMetadata" },
) as UseStaticListMetadata;

type UseStaticListSummary = <ListId extends StaticListId>(
  listId: ListId,
) => StaticListSummary<ListId>;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mapping generic list return type to specific list summary shape
export const useStaticListSummary = createPollableValueHook(
  (lastPollVersion, listId: StaticListId) =>
    staticListsService.pollListSummary(lastPollVersion, listId),
  { hookNameForDebugging: "useStaticListSummary", throttleInterval: 100 },
) as UseStaticListSummary;

export const useUserConfig = createPollableValueHook(
  (lastPollVersion) => userConfigService.poll(lastPollVersion),
  { hookNameForDebugging: "useUserConfig" },
);

const stableValueForUndefined = Symbol.for("stableValueForUndefined");
function useStableValue<Value extends JsonValue | undefined>(
  value: Value,
): Value {
  const serializedValue =
    value === undefined ? stableValueForUndefined : JSON.stringify(value);
  return React.useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- stringifiedConfig is produced from value
      (serializedValue === stableValueForUndefined
        ? undefined
        : JSON.parse(serializedValue)) as Value,
    [serializedValue],
  );
}

/**
 * When mounted, the hook will keep selected (or all) static lists up to date.
 * The hook will call static lists service every minute to check whether lists
 * are outdated.
 *
 * Note that static lists will update not more often than the root config
 * (which is being cached). See RootConfigService for details on timing.
 */
export function useStaticListsAutoUpdate(payload?: {
  listIds?: StaticListId[];
  toleranceInMinutes?: number;
}): void {
  const stablePayload = useStableValue(payload);

  React.useEffect(() => {
    void staticListsService.updateIfNeeded(stablePayload);

    const interval = setInterval(() => {
      void staticListsService.updateIfNeeded(stablePayload);
    }, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [stablePayload]);
}
