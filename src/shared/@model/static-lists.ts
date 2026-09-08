import type { JsonValue } from "type-fest";
import type { z } from "zod/mini";

import { accountListDefinition } from "./static-lists/=accounts";
import { announcementListDefinition } from "./static-lists/=announcements";
import { insertionListDefinition } from "./static-lists/=insertions";
import { tagListDefinition } from "./static-lists/=tags";
import { wallListDefinition } from "./static-lists/=walls";

export const staticListDefinitionLookup = {
  accounts: accountListDefinition,
  announcements: announcementListDefinition,
  insertions: insertionListDefinition,
  tags: tagListDefinition,
  walls: wallListDefinition,
};

export type StaticListId = keyof typeof staticListDefinitionLookup;
type StaticListDefinitionLookup = typeof staticListDefinitionLookup;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.keys returns a string array (limitation of TS)
export const staticListIds = Object.keys(
  staticListDefinitionLookup,
) as StaticListId[];

type StaticListItemByListId = {
  [ListId in StaticListId]: StaticListDefinitionLookup[ListId] extends {
    interpretedItemSchema: infer InterpretedItemSchema extends
      z.ZodMiniType<JsonValue>;
  }
    ? z.infer<InterpretedItemSchema>
    : never;
};

type StaticListSummaryByListId = {
  [ListId in StaticListId]: StaticListDefinitionLookup[ListId] extends {
    summarySchema: infer SummarySchema extends z.ZodMiniType<JsonValue>;
  }
    ? z.infer<SummarySchema>
    : never;
};

export type StaticListItem<ListId extends StaticListId = StaticListId> =
  ListId extends StaticListId ? StaticListItemByListId[ListId] : never;

export type StaticListSummary<ListId extends StaticListId = StaticListId> =
  ListId extends StaticListId ? StaticListSummaryByListId[ListId] : never;

export type StaticListsDataIssueState =
  | { kind: "none" }
  | { kind: "initialDataUnavailable" }
  | { kind: "updatesBlockedButExistingDataUsable" };

/** @public */
export type { AccountListItem } from "./static-lists/=accounts";
/** @public */
export type { AnnouncementListItem } from "./static-lists/=announcements";
/** @public */
export type { InsertionListItem } from "./static-lists/=insertions";
/** @public */
export type { TagListItem } from "./static-lists/=tags";
/** @public */
export type { WallListItem } from "./static-lists/=walls";
