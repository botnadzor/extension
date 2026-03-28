import { z } from "zod/mini";

import { isoDateTimeSchema } from "../@primitives/temporal";
import {
  staticListCombiningModeSchema,
  staticListRemoteInstanceSchema,
  staticListUpstreamInfoSchema,
} from "./static-list-helpers";
import {
  type StaticListId,
  staticListIds,
  type StaticListSummary,
} from "./static-lists";

/**
 * Persist only the state that cannot be reproduced cheaply.
 *
 * Remote summaries live here because they are built during download and keep
 * `remoteOnly` reads fast after restart. Local and combined summaries stay out
 * of storage on purpose: they are dev-only derived views and are recomputed in
 * memory when needed.
 */
export const staticListMetadataSchema = z.readonly(
  z.object({
    listId: z.enum(staticListIds),
    physicalStorageVersion: z.number().check(z.int(), z.nonnegative()),
    derivedDataVersion: z.string(),
    combiningMode: staticListCombiningModeSchema,
    remoteActiveInstance: staticListRemoteInstanceSchema,
    remoteActive: z.exactOptional(
      z.readonly(
        z.object({
          startedAt: isoDateTimeSchema,
          summary: z.json(),
          updatedAt: isoDateTimeSchema,
          upstreamInfo: staticListUpstreamInfoSchema,
        }),
      ),
    ),
    remoteStaging: z.exactOptional(
      z.readonly(
        z.object({
          durableLineNumber: z.exactOptional(
            z.number().check(z.int(), z.nonnegative()),
          ),
          startedAt: isoDateTimeSchema,
          summary: z.json(),
          updatedAt: isoDateTimeSchema,
          upstreamInfo: staticListUpstreamInfoSchema,
        }),
      ),
    ),
    localUpdatedAt: z.exactOptional(isoDateTimeSchema),
  }),
);
export type StoredStaticListMetadata = z.infer<typeof staticListMetadataSchema>;

type StoredStaticListMetadataRemoteState = NonNullable<
  StoredStaticListMetadata["remoteActive"]
>;
type StoredStaticListMetadataRemoteStagingState = NonNullable<
  StoredStaticListMetadata["remoteStaging"]
>;

type StaticListMetadataRemoteActiveState<ListId extends StaticListId> =
  Readonly<
    Omit<StoredStaticListMetadataRemoteState, "summary"> & {
      summary: StaticListSummary<ListId>;
    }
  >;

type StaticListMetadataRemoteStagingState<ListId extends StaticListId> =
  Readonly<
    Omit<StoredStaticListMetadataRemoteStagingState, "summary"> & {
      summary: StaticListSummary<ListId>;
    }
  >;

type StaticListMetadataBase = Omit<
  StoredStaticListMetadata,
  "listId" | "remoteActive" | "remoteStaging"
>;

type StaticListMetadataByListId = {
  [ListId in StaticListId]: Readonly<
    StaticListMetadataBase & {
      listId: ListId;
      remoteActive?: StaticListMetadataRemoteActiveState<ListId>;
      remoteStaging?: StaticListMetadataRemoteStagingState<ListId>;
    }
  >;
};

export type StaticListMetadata<ListId extends StaticListId = StaticListId> =
  ListId extends StaticListId ? StaticListMetadataByListId[ListId] : never;
