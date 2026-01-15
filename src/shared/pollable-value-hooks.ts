import { createPollableValueHook } from "./create-pollable-value-hook";
import type { VkDomain } from "./primitive-values";
import {
  authService,
  frontendService,
  inspectorService,
  notificationService,
  popupService,
  staticListsService,
  userConfigService,
} from "./proxy-services";
import type {
  StaticListId,
  StaticListItem,
  StaticListSummary,
} from "./static-lists";

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
