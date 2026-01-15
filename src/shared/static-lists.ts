import type { z } from "zod/mini";

import type { StaticListDefinition } from "./static-list-helpers";
import { accountListDefinition } from "./static-lists/=accounts";
import { announcementListDefinition } from "./static-lists/=announcements";
import { tagListDefinition } from "./static-lists/=tags";
import { wallListDefinition } from "./static-lists/=walls";

export const staticListDefinitionLookup = {
  accounts: accountListDefinition,
  announcements: announcementListDefinition,
  tags: tagListDefinition,
  walls: wallListDefinition,
} satisfies Record<string, StaticListDefinition>;

export type StaticListId = keyof typeof staticListDefinitionLookup;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.keys returns a string array (limitation of TS)
export const staticListIds = Object.keys(
  staticListDefinitionLookup,
) as StaticListId[];

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.entries returns a string in tuple key (limitation of TS)
export const staticListDefinitionEntries = Object.entries(
  staticListDefinitionLookup,
) as Array<[StaticListId, StaticListDefinition]>;

export type StaticListItem<ListId extends StaticListId> = z.infer<
  (typeof staticListDefinitionLookup)[ListId]["storedItemSchema"]
>;

export type StaticListSummary<ListId extends StaticListId = StaticListId> =
  z.infer<(typeof staticListDefinitionLookup)[ListId]["summarySchema"]>;
