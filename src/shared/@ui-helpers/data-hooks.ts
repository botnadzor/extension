import * as React from "react";
import type { JsonValue } from "type-fest";

import type { VkDomain } from "../@model/primitives";
import type {
  StaticListId,
  StaticListItem,
  StaticListSummary,
} from "../@model/static-lists";
import { createPollableValueHook } from "../@pollable/react";
import {
  authService,
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

export const useFrontendBaseUrl = createPollableValueHook(
  (lastPollVersion) => frontendService.pollBaseUrl(lastPollVersion),
  { hookNameForDebugging: "useFrontendBaseUrl" },
);

export const useGlobalNotificationsState = createPollableValueHook(
  (lastPollVersion) =>
    notificationService.pollGlobalNotificationsState(lastPollVersion),
  { hookNameForDebugging: "useGlobalNotificationsState" },
);

type UseNextStaticListSummary = <ListId extends StaticListId>(
  listId: ListId,
) => StaticListSummary<ListId>;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mapping generic list return type to specific list summary shape
export const useNextStaticListSummary = createPollableValueHook(
  (lastPollVersion, listId: StaticListId) =>
    staticListsService.pollNextListSummary(lastPollVersion, listId),
  { hookNameForDebugging: "useNextStaticListSummary", throttleInterval: 100 },
) as UseNextStaticListSummary;

type UseStaticListItems = <ListId extends StaticListId>(
  listId: ListId,
) => Array<StaticListItem<ListId>>;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mapping generic list return type to specific list item shape
export const useStaticListItems = createPollableValueHook(
  (lastPollVersion, listId: StaticListId) =>
    staticListsService.pollItems(lastPollVersion, listId),
  { hookNameForDebugging: "useStaticListItems" },
) as UseStaticListItems;

export const useStaticListMetadata = createPollableValueHook(
  (lastPollVersion, listId: StaticListId) =>
    staticListsService.pollListMetadata(lastPollVersion, listId),
  { hookNameForDebugging: "useStaticListMetadata" },
);

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
