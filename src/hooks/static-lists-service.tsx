import { createPollableValueHook } from "@/lib/create-pollable-value-hook";
import { staticListsService } from "@/lib/proxy-services";
import type {
  StaticListId,
  StaticListItem,
  StaticListSummary,
} from "@/lib/static-lists";

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
  { hookNameForDebugging: "useStaticListSummary" },
) as UseStaticListSummary;
