import type { Logger } from "@logtape/logtape";
import type { JobScheduler } from "@webext-core/job-scheduler";
import { Dexie, type Table } from "dexie";
import { delay } from "es-toolkit";
import { nanoid } from "nanoid";
import type { Writable } from "type-fest";
import type { z } from "zod/mini";

import { type IsoTime, isoTimeSchema } from "@/shared/@model/primitives";
import type {
  StaticListDefinition,
  StaticListInstance,
  StaticListUpstreamInfo,
} from "@/shared/@model/static-list-helpers";
import {
  type StaticListMetadata,
  staticListMetadataSchema,
} from "@/shared/@model/static-list-metadata";
import {
  staticListDefinitionEntries,
  staticListDefinitionLookup,
  type StaticListId,
  staticListIds,
  type StaticListItem,
  type StaticListSummary,
} from "@/shared/@model/static-lists";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import { getBackgroundLogger } from "@/shared/logging";

import type { AliasManager } from "../@service-helpers/alias-manager";
import { fetchFromRemoteSystem } from "../@service-helpers/fetch-from-remote-system";

const logger = getBackgroundLogger(["static-lists-service"]);

const itemBatchSize = 1000;
const lockIntervalInMs = 100;
const lockTimeoutInMs = 10_000;
const metadataTableName = "--metadata--";

async function* streamLines(
  readableStream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = readableStream.getReader();
  let { value: chunk, done } = await reader.read();
  let buffer = "";
  while (!done) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      yield line;
    }
    ({ value: chunk, done } = await reader.read());
  }
  buffer += decoder.decode();
  if (buffer) {
    for (const line of buffer.split("\n")) {
      if (line.length > 0) {
        yield line;
      }
    }
  }
}

function generateTableName(
  listId: StaticListId,
  instance: StaticListInstance,
): string {
  return `${listId}-${instance}`;
}

function pickAnotherInstance(instance: StaticListInstance): StaticListInstance {
  return instance === "a" ? "b" : "a";
}

function extractSummaryFromMetadata(
  metadata: StaticListMetadata,
  mode: "active" | "next" = "active",
): StaticListSummary {
  const listId = metadata.listId;

  const rawSummary = metadata[mode]?.summary;
  const summaryResult =
    staticListDefinitionLookup[listId].summarySchema.safeParse(rawSummary);

  return (
    summaryResult.data ??
    staticListDefinitionLookup[listId].createEmptySummary()
  );
}

type PopulateFromUrlIfOutdatedResult =
  | {
      success: true;
      data: "updateNotNeeded" | "updated";
    }
  | {
      success: false;
      error: string;
    };

export class StaticListsService {
  private readonly aliasManagerForStaticApi: AliasManager;
  private disposed = false;
  private readonly db: Dexie;
  private readonly jobScheduler: JobScheduler;

  private pollableListMetadataByListId: Readonly<
    Record<StaticListId, Pollable<StaticListMetadata | undefined>>
  >;

  private pollableListSummaryByListId: Readonly<
    Record<StaticListId, Pollable<StaticListSummary | undefined>>
  >;
  private pollableNextListSummaryByListId: Readonly<
    Record<StaticListId, Pollable<StaticListSummary | undefined>>
  >;

  private readonly metadataWriteThrottleMs = 500;

  constructor({
    aliasManagerForStaticApi,
    jobScheduler,
  }: {
    jobScheduler: JobScheduler;
    aliasManagerForStaticApi: AliasManager;
  }) {
    this.aliasManagerForStaticApi = aliasManagerForStaticApi;
    this.jobScheduler = jobScheduler;

    this.db = new Dexie("static-lists");
    this.db.version(1).stores({
      [metadataTableName]: "listId",
      ...Object.fromEntries(
        staticListDefinitionEntries.flatMap(([listId, listDefinition]) => [
          [
            generateTableName(listId, "a"),
            ["++", ...listDefinition.indexes].join(","),
          ],
          [
            generateTableName(listId, "b"),
            ["++", ...listDefinition.indexes].join(","),
          ],
        ]),
      ),
    });

    const pollableListMetadataByListId: Writable<
      Partial<typeof this.pollableListMetadataByListId>
    > = {};

    const pollableListSummaryByListId: Writable<
      Partial<typeof this.pollableListSummaryByListId>
    > = {};

    const pollableNextListSummaryByListId: Writable<
      Partial<typeof this.pollableNextListSummaryByListId>
    > = {};

    for (const listId of staticListIds) {
      pollableListMetadataByListId[listId] = new Pollable<
        StaticListMetadata | undefined
      >(undefined);

      pollableListSummaryByListId[listId] = new Pollable<
        StaticListSummary | undefined
      >(undefined);

      pollableNextListSummaryByListId[listId] = new Pollable<
        StaticListSummary | undefined
      >(undefined);
    }

    this.pollableListMetadataByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converting partial record to a finished one after a loop
      pollableListMetadataByListId as typeof this.pollableListMetadataByListId;

    this.pollableListSummaryByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converting partial record to a finished one after a loop
      pollableListSummaryByListId as typeof this.pollableListSummaryByListId;

    this.pollableNextListSummaryByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converting partial record to a finished one after a loop
      pollableNextListSummaryByListId as typeof this.pollableNextListSummaryByListId;

    void this.startSyncingMetadataWithDb();
  }

  [Symbol.dispose](): void {
    this.disposed = true;
  }

  private async startSyncingMetadataWithDb() {
    const rawMetadataRecords = await this.getMetadataTable().toArray();
    const parsedMetadataRecords: StaticListMetadata[] = [];

    for (const rawMetadataRecord of rawMetadataRecords) {
      const metadataResult =
        staticListMetadataSchema.safeParse(rawMetadataRecord);
      if (!metadataResult.success) {
        this.getMetadataLogger().warn("Read invalid metadata: {error}", {
          error: metadataResult.error.message,
        });
        continue;
      }
      parsedMetadataRecords.push(metadataResult.data);
    }

    for (const listId of staticListIds) {
      const metadata = parsedMetadataRecords.find(
        (currentMetadata) => currentMetadata.listId === listId,
      ) ?? { listId, activeInstance: "b" };

      this.pollableListMetadataByListId[listId].setValue(metadata);
      this.pollableListSummaryByListId[listId].setValue(
        extractSummaryFromMetadata(metadata),
      );

      this.pollableNextListSummaryByListId[listId].setValue(
        extractSummaryFromMetadata(metadata),
      );
    }

    for (const listId of staticListIds) {
      void this.startWritingMetadataToDbWhenChanged(listId);
    }
  }

  private async startWritingMetadataToDbWhenChanged(listId: StaticListId) {
    let result = await this.pollListMetadata(undefined, listId);

    while (!this.disposed) {
      await delay(this.metadataWriteThrottleMs);
      result = await this.pollListMetadata(result.version, listId);
      await this.getMetadataTable().put(result.value);
      this.getMetadataLogger().debug("Wrote metadata to DB for list {listId}", {
        listId,
      });
    }
  }

  private getListLogger(listId: StaticListId): Logger {
    return logger.getChild([listId]);
  }

  private getMetadataLogger(): Logger {
    return logger.getChild([metadataTableName]);
  }

  private getMetadataTable(): Table<unknown> {
    return this.db.table<unknown>(metadataTableName);
  }

  public async pollListMetadata(
    lastPollVersion: PollVersion | undefined,
    listId: StaticListId,
  ): Promise<PollResult<StaticListMetadata>> {
    let result:
      | PollResult<StaticListMetadata>
      | PollResult<undefined>
      | undefined;

    do {
      result = await this.pollableListMetadataByListId[listId].poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);

    return result;
  }

  public async getListMetadata(
    listId: StaticListId,
  ): Promise<StaticListMetadata> {
    const result = await this.pollListMetadata(undefined, listId);
    return result.value;
  }

  private setListMetadata(metadata: StaticListMetadata): void {
    this.activeListTableCache.delete(metadata.listId);
    this.pollableListMetadataByListId[metadata.listId].setValue(metadata);
    this.pollableListSummaryByListId[metadata.listId].setValue(
      extractSummaryFromMetadata(metadata),
    );
    this.pollableNextListSummaryByListId[metadata.listId].setValue(
      extractSummaryFromMetadata(metadata, "next"),
    );
  }

  public async pollListSummary(
    lastPollVersion: PollVersion | undefined,
    listId: StaticListId,
  ): Promise<PollResult<StaticListSummary>> {
    let result:
      | PollResult<StaticListSummary>
      | PollResult<undefined>
      | undefined;

    do {
      result = await this.pollableListSummaryByListId[listId].poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);

    return result;
  }

  public async getListSummary(
    listId: StaticListId,
  ): Promise<StaticListSummary> {
    const result = await this.pollListSummary(undefined, listId);
    return result.value;
  }

  public async pollNextListSummary(
    lastPollVersion: PollVersion | undefined,
    listId: StaticListId,
  ): Promise<PollResult<StaticListSummary>> {
    let result:
      | PollResult<StaticListSummary>
      | PollResult<undefined>
      | undefined;

    do {
      result = await this.pollableNextListSummaryByListId[listId].poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);
    return result;
  }

  public async getNextListSummary(
    listId: StaticListId,
  ): Promise<StaticListSummary> {
    const result = await this.pollNextListSummary(undefined, listId);
    return result.value;
  }

  private async waitForAnotherLock(
    listId: StaticListId,
    initialListMetadata: StaticListMetadata,
  ): Promise<StaticListMetadata> {
    let lockMetadata = initialListMetadata;

    if (!lockMetadata.next) {
      return lockMetadata;
    }

    const listLogger = this.getListLogger(listId);
    listLogger.debug("Waiting for another lock");

    do {
      const lockReportedAtTimestamp = new Date(
        lockMetadata.next.updatedAt,
      ).getTime();

      if (lockReportedAtTimestamp < Date.now() - lockTimeoutInMs) {
        listLogger.debug(
          "Another lock has been held for over {lockTimeoutInMs}ms, overtaking it",
          { lockTimeoutInMs },
        );

        return lockMetadata;
      }

      await delay(lockIntervalInMs);
      lockMetadata = await this.getListMetadata(listId);
    } while (lockMetadata.next);

    listLogger.debug("Another lock is no longer held");
    return lockMetadata;
  }

  private isListUpToDate(
    listMetadata: StaticListMetadata,
    upstreamGeneratedAt: IsoTime,
  ): boolean {
    const startedAtLocally = listMetadata.active?.startedAt;
    return startedAtLocally ? startedAtLocally >= upstreamGeneratedAt : false;
  }

  async populateFromUrlIfOutdated(
    listId: StaticListId,
    upstreamInfo: StaticListUpstreamInfo,
  ): Promise<PopulateFromUrlIfOutdatedResult> {
    const listLogger = this.getListLogger(listId);
    listLogger.info("Populating from URL if outdated");
    const startedAt = Date.now();

    const lockId = nanoid(8);

    try {
      const initialMetadata = await this.getListMetadata(listId);
      if (this.isListUpToDate(initialMetadata, upstreamInfo.generatedAt)) {
        listLogger.info("List is up to date");
        return { success: true, data: "updateNotNeeded" };
      }

      const listDefinition: StaticListDefinition =
        staticListDefinitionLookup[listId];

      const mutableSummary = listDefinition.createEmptySummary();

      let lockMetadata = initialMetadata;
      do {
        lockMetadata = await this.waitForAnotherLock(listId, lockMetadata);

        if (this.isListUpToDate(lockMetadata, upstreamInfo.generatedAt)) {
          return { success: true, data: "updateNotNeeded" };
        }

        this.setListMetadata({
          ...lockMetadata,
          next: {
            lockId,
            startedAt: isoTimeSchema.parse(startedAt),
            summary: structuredClone(mutableSummary),
            updatedAt: isoTimeSchema.parse(startedAt),
            upstreamInfo,
          },
        });

        lockMetadata = await this.getListMetadata(listId);
      } while (lockMetadata.next?.lockId !== lockId);

      const fetchResult = await fetchFromRemoteSystem({
        aliasManager: this.aliasManagerForStaticApi,
        urlSuffix: `/lists/${listId}.jsonl`,
      });

      if (!fetchResult.success) {
        return { success: false, error: fetchResult.reason };
      }

      if (fetchResult.response.status !== 200) {
        return {
          success: false,
          error: `Failed to fetch list from static API: ${fetchResult.response.status}`,
        };
      }

      if (!fetchResult.response.body) {
        return { success: false, error: "No response body from static API" };
      }

      const previouslyActiveStoreName = generateTableName(
        listId,
        initialMetadata.activeInstance,
      );

      const previouslyActiveTable = this.db.table<unknown>(
        previouslyActiveStoreName,
      );

      const nextInstance = pickAnotherInstance(initialMetadata.activeInstance);
      const nextStoreName = generateTableName(listId, nextInstance);
      const nextTable = this.db.table<unknown>(nextStoreName);
      await nextTable.clear();

      let storedBatchCount = 0;
      let storedItemCount = 0;

      const storeBatch = async ({
        items,
        shouldSetListMetadata,
      }: {
        items: unknown[];
        shouldSetListMetadata: boolean;
      }): Promise<
        (PopulateFromUrlIfOutdatedResult & { success: false }) | undefined
      > => {
        if (items.length === 0) {
          return undefined;
        }

        storedBatchCount += 1;
        storedItemCount += items.length;
        const batchStartedAt = Date.now();

        lockMetadata = await this.getListMetadata(listId);
        const lockMetadataNext = lockMetadata.next;

        if (lockMetadataNext?.lockId !== lockId) {
          listLogger.error(
            "List was unexpectedly locked by another instance ({lockId})",
            { lockId: lockMetadata.next?.lockId },
          );

          return {
            success: false,
            error: `List was unexpectedly locked by another instance (${lockMetadata.next?.lockId ?? "unknown"})`,
          };
        }

        await this.db.transaction("rw", nextTable, async () => {
          await nextTable.bulkAdd(items);
        });

        if (shouldSetListMetadata) {
          this.setListMetadata({
            ...lockMetadata,
            next: {
              ...lockMetadataNext,
              summary: structuredClone(mutableSummary),
              updatedAt: isoTimeSchema.parse(undefined),
            },
          });
        }

        listLogger.debug(
          "Stored batch {batchCount} with {length} items in {ms}ms",
          {
            batchCount: storedBatchCount,
            length: items.length,
            ms: Date.now() - batchStartedAt,
          },
        );

        return undefined;
      };

      let lineNumber = 0;
      let itemsToStore: unknown[] = [];

      for await (const line of streamLines(fetchResult.response.body)) {
        lineNumber += 1;
        const receivedItemResult = listDefinition.receivedItemSchema.safeParse(
          JSON.parse(line),
        );

        if (!receivedItemResult.success) {
          listLogger.error(
            "Invalid item received at line {lineNumber}: {line} -> {error}",
            {
              lineNumber,
              line,
              error: receivedItemResult.error.message,
            },
          );
          continue;
        }

        const itemToStore = listDefinition.mapReceivedToStored(
          receivedItemResult.data,
        );

        itemsToStore.push(itemToStore);
        listDefinition.mutateSummary(mutableSummary, itemToStore);

        if (itemsToStore.length >= itemBatchSize) {
          const batchResult = await storeBatch({
            items: itemsToStore,
            shouldSetListMetadata: true,
          });
          if (batchResult) {
            return batchResult;
          }
          itemsToStore = [];
        }
      }

      const finalBatchResult = await storeBatch({
        items: itemsToStore,
        shouldSetListMetadata: false,
      });

      if (finalBatchResult) {
        return finalBatchResult;
      }

      const finalSummary = structuredClone(mutableSummary);

      listLogger.info(
        "Populated {storedItemCount} items (batches: {storedBatchCount}) in {ms}ms with {summary}",
        {
          storedItemCount,
          storedBatchCount,
          ms: Date.now() - startedAt,
          summary: finalSummary,
        },
      );

      this.setListMetadata({
        listId,
        activeInstance: nextInstance,
        active: {
          startedAt: isoTimeSchema.parse(startedAt),
          summary: finalSummary,
          updatedAt: isoTimeSchema.parse(startedAt),
          upstreamInfo,
        },
      });

      listLogger.debug("Saved metadata");

      const clearStartedAt = Date.now();
      await previouslyActiveTable.clear();
      listLogger.info("Cleared previously active table in {ms}ms", {
        ms: Date.now() - clearStartedAt,
      });

      return { success: true, data: "updated" };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      listLogger.error(
        "Unexpected error while populating: {error} {errorStack}",
        {
          listId,
          error: errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
        },
      );

      try {
        const metadata = await this.getListMetadata(listId);
        if (metadata.next?.lockId === lockId) {
          const { next, ...rest } = metadata;
          this.setListMetadata(rest);
        }
      } catch (anotherError) {
        const anotherErrorMessage =
          anotherError instanceof Error
            ? anotherError.message
            : String(anotherError);

        logger.error(
          "Unexpected error while cleaning up after failed populate of list {listId}: {error}",
          { listId, error: anotherErrorMessage },
        );
      }

      return { success: false, error: errorMessage };
    }
  }

  private activeListTableCache = new Map<StaticListId, Table<unknown>>();

  private async getActiveListTable(
    listId: StaticListId,
  ): Promise<Table<unknown>> {
    const cachedResult = this.activeListTableCache.get(listId);
    if (cachedResult) {
      return cachedResult;
    }

    const metadata = await this.getListMetadata(listId);
    const activeTable = this.db.table<unknown>(
      generateTableName(listId, metadata.activeInstance),
    );
    this.activeListTableCache.set(listId, activeTable);
    return activeTable;
  }

  async getItems<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<Array<StaticListItem<ListId>>> {
    const activeTable = await this.getActiveListTable(listId);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- data type is unknown, but we've parsed it with the right schema
    return (await activeTable.toArray()) as Array<StaticListItem<ListId>>;
  }

  async pollItems<ListId extends StaticListId>(
    lastPollVersion: PollVersion | undefined,
    listId: ListId,
  ): Promise<PollResult<Array<StaticListItem<ListId>>>> {
    const metadataResult = await this.pollListMetadata(lastPollVersion, listId);
    return {
      value: await this.getItems(listId),
      version: metadataResult.version,
    };
  }

  async findItem<
    ListId extends StaticListId,
    Index extends keyof z.infer<
      (typeof staticListDefinitionLookup)[ListId]["storedItemSchema"]
    >,
  >(
    listId: ListId,
    index: Index,
    value: z.infer<
      (typeof staticListDefinitionLookup)[ListId]["storedItemSchema"]
    >[Index],
  ): Promise<StaticListItem<ListId> | undefined> {
    const listLogger = this.getListLogger(listId);
    const activeTable = await this.getActiveListTable(listId);

    const staticListDefinition = staticListDefinitionLookup[listId];

    const rawItem = await activeTable.get({ [index]: value });
    if (!rawItem) {
      return undefined;
    }

    const parsedItem = staticListDefinition.storedItemSchema.safeParse(rawItem);

    if (!parsedItem.success) {
      listLogger.error("Invalid item {rawItem}: {error}", {
        rawItem,
        error: parsedItem.error.message,
      });
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- data type is unknown, but we've parsed it with the right schema
    return parsedItem.data as StaticListItem<ListId>;
  }
}
