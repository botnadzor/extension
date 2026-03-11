import type { Logger } from "@logtape/logtape";
import { Dexie, type Table } from "dexie";
import { delay } from "es-toolkit";
import { nanoid } from "nanoid";
import type { Writable, WritableDeep } from "type-fest";
import type { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/@logging/core";
import type {
  StaticListCombiningMode,
  StaticListDefinition,
  StaticListItemOrigin,
  StaticListRemoteInstance,
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
import {
  type IsoDateTime,
  isoDateTimeSchema,
} from "@/shared/@primitives/temporal";

import type { AliasManager } from "../@service-helpers/alias-manager";
import { fetchFromRemoteSystem } from "../@service-helpers/fetch-from-remote-system";
import type { RootConfigService } from "./root-config-service";

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

function generateRemoteTableName(
  listId: StaticListId,
  instance: StaticListRemoteInstance,
): string {
  return `${listId}_remote_${instance}`;
}

function generateLocalTableName(listId: StaticListId): string {
  return `${listId}_local`;
}

function pickAnotherInstance(
  instance: StaticListRemoteInstance,
): StaticListRemoteInstance {
  return instance === "a" ? "b" : "a";
}

function extractSummaryFromMetadata(
  metadata: StaticListMetadata,
  mode: "remoteActive" | "remoteNext" = "remoteActive",
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

function extractCombinedSummaryFromMetadata(
  metadata: StaticListMetadata,
): StaticListSummary {
  const listId = metadata.listId;

  const rawSummary = metadata.combinedSummary;
  if (rawSummary) {
    const summaryResult =
      staticListDefinitionLookup[listId].summarySchema.safeParse(rawSummary);
    if (summaryResult.data) {
      return summaryResult.data;
    }
  }

  return extractSummaryFromMetadata(metadata);
}

function extractLocalSummaryFromMetadata(
  metadata: StaticListMetadata,
): StaticListSummary {
  const listId = metadata.listId;

  const rawSummary = metadata.localSummary;
  if (rawSummary) {
    const summaryResult =
      staticListDefinitionLookup[listId].summarySchema.safeParse(rawSummary);
    if (summaryResult.data) {
      return summaryResult.data;
    }
  }

  return staticListDefinitionLookup[listId].createEmptySummary();
}

function extractUpdatedAtFromMetadata(
  metadata: StaticListMetadata,
): IsoDateTime | undefined {
  const combiningMode = metadata.combiningMode;

  if (combiningMode === "remoteOnly") {
    return metadata.remoteActive?.updatedAt;
  }

  if (combiningMode === "localOnly") {
    return metadata.localUpdatedAt;
  }

  // remoteWithLocalOverrides: use the most recent timestamp
  const remoteUpdatedAt = metadata.remoteActive?.updatedAt;
  const localUpdatedAt = metadata.localUpdatedAt;

  if (!remoteUpdatedAt) {
    return localUpdatedAt;
  }

  if (!localUpdatedAt) {
    return remoteUpdatedAt;
  }

  // ISO date strings can be compared lexicographically
  return [remoteUpdatedAt, localUpdatedAt].toSorted().toReversed()[0];
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
  private readonly rootConfigService: RootConfigService;
  private disposed = false;
  private readonly db: Dexie;

  private pollableListMetadataByListId: Readonly<
    Record<StaticListId, Pollable<StaticListMetadata | undefined>>
  >;

  private pollableListSummaryByListId: Readonly<
    Record<StaticListId, Pollable<StaticListSummary | undefined>>
  >;
  private pollableRemoteNextListSummaryByListId: Readonly<
    Record<StaticListId, Pollable<StaticListSummary | undefined>>
  >;
  private pollableListUpdatedAtByListId: Readonly<
    Record<StaticListId, Pollable<IsoDateTime | undefined>>
  >;

  private readonly metadataWriteThrottleMs = 500;

  constructor({
    aliasManagerForStaticApi,
    rootConfigService,
  }: {
    aliasManagerForStaticApi: AliasManager;
    rootConfigService: RootConfigService;
  }) {
    this.aliasManagerForStaticApi = aliasManagerForStaticApi;
    this.rootConfigService = rootConfigService;

    this.db = new Dexie("static-lists");
    this.db.version(2).stores({
      [metadataTableName]: "listId",
      ...Object.fromEntries(
        staticListDefinitionEntries.flatMap(([listId, listDefinition]) => [
          [
            generateRemoteTableName(listId, "a"),
            ["++", ...listDefinition.indexes].join(","),
          ],
          [
            generateRemoteTableName(listId, "b"),
            ["++", ...listDefinition.indexes].join(","),
          ],
          [
            generateLocalTableName(listId),
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

    const pollableRemoteNextListSummaryByListId: Writable<
      Partial<typeof this.pollableRemoteNextListSummaryByListId>
    > = {};

    const pollableListUpdatedAtByListId: Writable<
      Partial<typeof this.pollableListUpdatedAtByListId>
    > = {};

    for (const listId of staticListIds) {
      pollableListMetadataByListId[listId] = new Pollable<
        StaticListMetadata | undefined
      >(undefined);

      pollableListSummaryByListId[listId] = new Pollable<
        StaticListSummary | undefined
      >(undefined);

      pollableRemoteNextListSummaryByListId[listId] = new Pollable<
        StaticListSummary | undefined
      >(undefined);

      pollableListUpdatedAtByListId[listId] = new Pollable<
        IsoDateTime | undefined
      >(undefined);
    }

    this.pollableListMetadataByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converting partial record to a finished one after a loop
      pollableListMetadataByListId as typeof this.pollableListMetadataByListId;

    this.pollableListSummaryByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converting partial record to a finished one after a loop
      pollableListSummaryByListId as typeof this.pollableListSummaryByListId;

    this.pollableRemoteNextListSummaryByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converting partial record to a finished one after a loop
      pollableRemoteNextListSummaryByListId as typeof this.pollableRemoteNextListSummaryByListId;

    this.pollableListUpdatedAtByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converting partial record to a finished one after a loop
      pollableListUpdatedAtByListId as typeof this.pollableListUpdatedAtByListId;

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
      ) ?? {
        listId,
        remoteActiveInstance: "b",
        combiningMode: "remoteWithLocalOverrides",
      };

      this.pollableListMetadataByListId[listId].setValue(metadata);
      this.pollableListSummaryByListId[listId].setValue(
        extractCombinedSummaryFromMetadata(metadata),
      );

      this.pollableRemoteNextListSummaryByListId[listId].setValue(
        extractSummaryFromMetadata(metadata, "remoteNext"),
      );

      this.pollableListUpdatedAtByListId[listId].setValue(
        extractUpdatedAtFromMetadata(metadata),
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
    this.activeRemoteTableCache.delete(metadata.listId);
    this.pollableListMetadataByListId[metadata.listId].setValue(metadata);
    this.pollableListSummaryByListId[metadata.listId].setValue(
      extractCombinedSummaryFromMetadata(metadata),
    );
    this.pollableRemoteNextListSummaryByListId[metadata.listId].setValue(
      extractSummaryFromMetadata(metadata, "remoteNext"),
    );
    this.pollableListUpdatedAtByListId[metadata.listId].setValue(
      extractUpdatedAtFromMetadata(metadata),
    );
  }

  // Combined summary (respects combining mode) — used by most consumers
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

  // Combined list updated timestamp (respects combining mode)
  public async pollListUpdatedAt(
    lastPollVersion: PollVersion | undefined,
    listId: StaticListId,
  ): Promise<PollResult<IsoDateTime | undefined>> {
    return this.pollableListUpdatedAtByListId[listId].poll(lastPollVersion);
  }

  public async getListUpdatedAt(
    listId: StaticListId,
  ): Promise<IsoDateTime | undefined> {
    const result = await this.pollListUpdatedAt(undefined, listId);
    return result.value;
  }

  // Remote summary (always from remote, regardless of combining mode)
  public async getRemoteListSummary(
    listId: StaticListId,
  ): Promise<StaticListSummary> {
    const metadata = await this.getListMetadata(listId);
    return extractSummaryFromMetadata(metadata);
  }

  // Local summary
  public async getLocalListSummary(
    listId: StaticListId,
  ): Promise<StaticListSummary> {
    const metadata = await this.getListMetadata(listId);
    return extractLocalSummaryFromMetadata(metadata);
  }

  public async pollRemoteNextListSummary(
    lastPollVersion: PollVersion | undefined,
    listId: StaticListId,
  ): Promise<PollResult<StaticListSummary>> {
    let result:
      | PollResult<StaticListSummary>
      | PollResult<undefined>
      | undefined;

    do {
      result = await this.pollableRemoteNextListSummaryByListId[listId].poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);
    return result;
  }

  public async getRemoteNextListSummary(
    listId: StaticListId,
  ): Promise<StaticListSummary> {
    const result = await this.pollRemoteNextListSummary(undefined, listId);
    return result.value;
  }

  private async waitForAnotherLock(
    listId: StaticListId,
    initialListMetadata: StaticListMetadata,
  ): Promise<StaticListMetadata> {
    let lockMetadata = initialListMetadata;

    if (!lockMetadata.remoteNext) {
      return lockMetadata;
    }

    const listLogger = this.getListLogger(listId);
    listLogger.debug("Waiting for another lock");

    do {
      const lockReportedAtTimestamp = new Date(
        lockMetadata.remoteNext.updatedAt,
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
    } while (lockMetadata.remoteNext);

    listLogger.debug("Another lock is no longer held");
    return lockMetadata;
  }

  private isListUpToDate(
    listMetadata: StaticListMetadata,
    upstreamGeneratedAt: IsoDateTime,
    toleranceInMinutes: number | undefined,
  ): boolean {
    const activeStartedAtLocally = listMetadata.remoteActive?.startedAt;
    if (!activeStartedAtLocally) {
      return false;
    }

    if (activeStartedAtLocally >= upstreamGeneratedAt) {
      return true;
    }

    return (
      new Date(upstreamGeneratedAt).getTime() +
        (toleranceInMinutes ?? 0) * 60 * 1000 >=
      Date.now()
    );
  }

  public async populateListIfOutdated(
    listId: StaticListId,
    toleranceInMinutes: number | undefined,
  ): Promise<PopulateFromUrlIfOutdatedResult> {
    const listLogger = this.getListLogger(listId);
    listLogger.info("Populating if outdated");
    const startedAt = Date.now();

    const lockId = nanoid(8);

    const rootConfig = await this.rootConfigService.get();
    const upstreamInfo =
      rootConfig.remoteSystemLookup.staticApi.listLookup[listId];

    try {
      const initialMetadata = await this.getListMetadata(listId);
      if (
        this.isListUpToDate(
          initialMetadata,
          upstreamInfo.generatedAt,
          toleranceInMinutes,
        )
      ) {
        listLogger.info("List is up to date");
        return { success: true, data: "updateNotNeeded" };
      }

      const listDefinition: StaticListDefinition =
        staticListDefinitionLookup[listId];

      const mutableSummary = listDefinition.createEmptySummary();

      let lockMetadata = initialMetadata;
      do {
        lockMetadata = await this.waitForAnotherLock(listId, lockMetadata);

        if (
          this.isListUpToDate(
            lockMetadata,
            upstreamInfo.generatedAt,
            toleranceInMinutes,
          )
        ) {
          return { success: true, data: "updateNotNeeded" };
        }

        this.setListMetadata({
          ...lockMetadata,
          remoteNext: {
            lockId,
            startedAt: isoDateTimeSchema.parse(startedAt),
            summary: structuredClone(mutableSummary),
            updatedAt: isoDateTimeSchema.parse(startedAt),
            upstreamInfo,
          },
        });

        lockMetadata = await this.getListMetadata(listId);
      } while (lockMetadata.remoteNext?.lockId !== lockId);

      const fetchResult = await fetchFromRemoteSystem({
        aliasManager: this.aliasManagerForStaticApi,
        urlSuffix: `/lists/${listId}.jsonl`,
      });

      if (!fetchResult.success) {
        return {
          success: false,
          error: `Failed to fetch list from static API (reason: ${fetchResult.reason})`,
        };
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

      const previouslyActiveStoreName = generateRemoteTableName(
        listId,
        initialMetadata.remoteActiveInstance,
      );

      const previouslyActiveTable = this.db.table<unknown>(
        previouslyActiveStoreName,
      );

      const nextInstance = pickAnotherInstance(
        initialMetadata.remoteActiveInstance,
      );
      const nextStoreName = generateRemoteTableName(listId, nextInstance);
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
        const lockMetadataRemoteNext = lockMetadata.remoteNext;

        if (lockMetadataRemoteNext?.lockId !== lockId) {
          listLogger.error(
            "List was unexpectedly locked by another instance ({lockId})",
            { lockId: lockMetadata.remoteNext?.lockId },
          );

          return {
            success: false,
            error: `List was unexpectedly locked by another instance (${lockMetadata.remoteNext?.lockId ?? "unknown"})`,
          };
        }

        await this.db.transaction("rw", nextTable, async () => {
          await nextTable.bulkAdd(items);
        });

        if (shouldSetListMetadata) {
          this.setListMetadata({
            ...lockMetadata,
            remoteNext: {
              ...lockMetadataRemoteNext,
              summary: structuredClone(mutableSummary),
              updatedAt: isoDateTimeSchema.parse(undefined),
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

      const { remoteNext: unusedRemoteNext, ...metadataWithoutRemoteNext } =
        lockMetadata;
      const newMetadata: StaticListMetadata = {
        ...metadataWithoutRemoteNext,
        remoteActiveInstance: nextInstance,
        remoteActive: {
          startedAt: isoDateTimeSchema.parse(startedAt),
          summary: finalSummary,
          updatedAt: isoDateTimeSchema.parse(startedAt),
          upstreamInfo,
        },
      };

      // Recompute combined summary after remote data changed
      const updatedMetadata = await this.recomputeCombinedSummaryForMetadata(
        listId,
        newMetadata,
      );
      this.setListMetadata(updatedMetadata);

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
        if (metadata.remoteNext?.lockId === lockId) {
          const { remoteNext, ...rest } = metadata;
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

  public updateIfNeeded(payload?: {
    listIds?: StaticListId[] | undefined;
    toleranceInMinutes?: number | undefined;
  }): void {
    for (const listId of payload?.listIds ?? staticListIds) {
      void this.populateListIfOutdated(listId, payload?.toleranceInMinutes);
    }
  }

  // ── Remote table access ────────────────────────────────────────────

  private activeRemoteTableCache = new Map<StaticListId, Table<unknown>>();

  private async getActiveRemoteTable(
    listId: StaticListId,
  ): Promise<Table<unknown>> {
    const cachedResult = this.activeRemoteTableCache.get(listId);
    if (cachedResult) {
      return cachedResult;
    }

    const metadata = await this.getListMetadata(listId);
    const activeTable = this.db.table<unknown>(
      generateRemoteTableName(listId, metadata.remoteActiveInstance),
    );
    this.activeRemoteTableCache.set(listId, activeTable);
    return activeTable;
  }

  // ── Local table access ─────────────────────────────────────────────

  private getLocalTable(listId: StaticListId): Table<unknown> {
    return this.db.table<unknown>(generateLocalTableName(listId));
  }

  // ── Combining mode ─────────────────────────────────────────────────

  public async getCombiningMode(
    listId: StaticListId,
  ): Promise<StaticListCombiningMode> {
    const metadata = await this.getListMetadata(listId);
    return metadata.combiningMode;
  }

  public async setCombiningMode(
    listId: StaticListId,
    mode: StaticListCombiningMode,
  ): Promise<void> {
    const metadata = await this.getListMetadata(listId);
    const updatedMetadata = await this.recomputeCombinedSummaryForMetadata(
      listId,
      { ...metadata, combiningMode: mode },
    );
    this.setListMetadata(updatedMetadata);
  }

  // ── Local item management ──────────────────────────────────────────

  public async getLocalItems<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<Array<StaticListItem<ListId>>> {
    const localTable = this.getLocalTable(listId);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- data type is unknown, but we've parsed it with the right schema
    return (await localTable.toArray()) as Array<StaticListItem<ListId>>;
  }

  public async setLocalItems<ListId extends StaticListId>(
    listId: ListId,
    items: Array<StaticListItem<ListId>>,
  ): Promise<void> {
    const localTable = this.getLocalTable(listId);
    await localTable.clear();
    if (items.length > 0) {
      await localTable.bulkAdd(items);
    }
    await this.recomputeLocalAndCombinedSummary(listId);
  }

  public async addLocalItem<ListId extends StaticListId>(
    listId: ListId,
    item: StaticListItem<ListId>,
  ): Promise<void> {
    const localTable = this.getLocalTable(listId);
    await localTable.add(item);
    await this.recomputeLocalAndCombinedSummary(listId);
  }

  public async putLocalItem<ListId extends StaticListId>(
    listId: ListId,
    item: StaticListItem<ListId>,
  ): Promise<void> {
    const listDefinition = staticListDefinitionLookup[listId];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- indexes are always strings (object keys)
    const firstIndex = listDefinition.indexes[0] as string;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown, accessing by dynamic key
    const firstIndexValue = (item as Record<string, unknown>)[firstIndex];

    const localTable = this.getLocalTable(listId);
    await localTable.where({ [firstIndex]: firstIndexValue }).delete();
    await localTable.add(item);
    await this.recomputeLocalAndCombinedSummary(listId);
  }

  public async removeLocalItem<
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
  ): Promise<{ deletedCount: number }> {
    const localTable = this.getLocalTable(listId);
    const deletedCount = await localTable
      .where({ [String(index)]: value })
      .delete();
    await this.recomputeLocalAndCombinedSummary(listId);
    return { deletedCount };
  }

  // ── Item origin ────────────────────────────────────────────────────

  public async getItemOrigin<
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
  ): Promise<StaticListItemOrigin | undefined> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- indexes are always strings (object keys)
    const firstIndex = staticListDefinitionLookup[listId].indexes[0] as string;
    const localTable = this.getLocalTable(listId);
    const remoteTable = await this.getActiveRemoteTable(listId);

    // Look up by the provided index to find items
    const localItem = await localTable.get({ [index]: value });
    const remoteItem = await remoteTable.get({ [index]: value });

    if (localItem && remoteItem) {
      // Check if the local item matches a remote item by first index (override)
      const localFirstIndexValue =
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown, accessing by dynamic key
        (localItem as Record<string, unknown>)[firstIndex];
      const remoteByFirstIndex = await remoteTable.get({
        [firstIndex]: localFirstIndexValue,
      });
      return remoteByFirstIndex ? "localOverride" : "local";
    }

    if (localItem) {
      return "local";
    }

    if (remoteItem) {
      return "remote";
    }

    return undefined;
  }

  // ── Paginated read access ─────────────────────────────────────────

  public async getItemCount(listId: StaticListId): Promise<number> {
    const metadata = await this.getListMetadata(listId);
    const combiningMode = metadata.combiningMode;

    if (combiningMode === "localOnly") {
      return this.getLocalTable(listId).count();
    }

    const remoteTable = await this.getActiveRemoteTable(listId);

    if (combiningMode === "remoteOnly") {
      return remoteTable.count();
    }

    // remoteWithLocalOverrides: remote count + pure-local additions
    const remoteCount = await remoteTable.count();
    const pureLocalCount = await this.countPureLocalItems(listId);
    return remoteCount + pureLocalCount;
  }

  public async getItemsPage(
    listId: StaticListId,
    params: { offset: number; limit: number },
  ): Promise<{
    items: Array<{
      item: unknown;
      origin: StaticListItemOrigin;
      valid: boolean;
    }>;
    totalCount: number;
  }> {
    const metadata = await this.getListMetadata(listId);
    const combiningMode = metadata.combiningMode;
    const listDefinition = staticListDefinitionLookup[listId];

    function validateItem(item: unknown): boolean {
      return listDefinition.storedItemSchema.safeParse(item).success;
    }

    if (combiningMode === "localOnly") {
      const localTable = this.getLocalTable(listId);
      const totalCount = await localTable.count();
      const rawItems = await localTable
        .offset(params.offset)
        .limit(params.limit)
        .toArray();

      return {
        items: rawItems.map((item) => ({
          item,
          origin: "local" satisfies StaticListItemOrigin,
          valid: validateItem(item),
        })),
        totalCount,
      };
    }

    const remoteTable = await this.getActiveRemoteTable(listId);

    if (combiningMode === "remoteOnly") {
      const totalCount = await remoteTable.count();
      const rawItems = await remoteTable
        .offset(params.offset)
        .limit(params.limit)
        .toArray();

      return {
        items: rawItems.map((item) => ({
          item,
          origin: "remote" satisfies StaticListItemOrigin,
          valid: validateItem(item),
        })),
        totalCount,
      };
    }

    // remoteWithLocalOverrides
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- indexes are always strings (object keys)
    const firstIndex = listDefinition.indexes[0] as string;

    // Load all local items (always small set)
    const localItems = await this.getLocalTable(listId).toArray();
    const localByKey = new Map<unknown, unknown>();
    for (const item of localItems) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown, accessing by dynamic key
      localByKey.set((item as Record<string, unknown>)[firstIndex], item);
    }

    const remoteCount = await remoteTable.count();

    // Count pure-local items (not overriding any remote)
    const pureLocalItems: unknown[] = [];
    for (const [key, item] of localByKey) {
      const remoteMatch = await remoteTable.get({ [firstIndex]: key });
      if (!remoteMatch) {
        pureLocalItems.push(item);
      }
    }

    const totalCount = remoteCount + pureLocalItems.length;

    // If offset is within the remote range, read from remote table
    if (params.offset < remoteCount) {
      const rawRemoteItems = await remoteTable
        .offset(params.offset)
        .limit(params.limit)
        .toArray();

      type PageItem = {
        item: unknown;
        origin: StaticListItemOrigin;
        valid: boolean;
      };

      const items: PageItem[] = rawRemoteItems.map((remoteItem) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown, accessing by dynamic key
        const key = (remoteItem as Record<string, unknown>)[firstIndex];
        const localItem = localByKey.get(key);
        if (localItem) {
          return {
            item: localItem,
            origin: "localOverride" satisfies StaticListItemOrigin,
            valid: validateItem(localItem),
          };
        }
        return {
          item: remoteItem,
          origin: "remote" satisfies StaticListItemOrigin,
          valid: validateItem(remoteItem),
        };
      });

      // If we got fewer items than the limit and there are pure-local items to append
      const remaining = params.limit - items.length;
      if (remaining > 0 && pureLocalItems.length > 0) {
        for (const item of pureLocalItems.slice(0, remaining)) {
          items.push({
            item,
            origin: "local" satisfies StaticListItemOrigin,
            valid: validateItem(item),
          });
        }
      }

      return { items, totalCount };
    }

    // Offset is beyond remote items — serve from pure-local items
    const pureLocalOffset = params.offset - remoteCount;
    const pureLocalPage = pureLocalItems.slice(
      pureLocalOffset,
      pureLocalOffset + params.limit,
    );

    return {
      items: pureLocalPage.map((item) => ({
        item,
        origin: "local" satisfies StaticListItemOrigin,
        valid: validateItem(item),
      })),
      totalCount,
    };
  }

  public async searchItems(
    listId: StaticListId,
    params: { index: string; value: unknown },
  ): Promise<{
    items: Array<{
      item: unknown;
      origin: StaticListItemOrigin;
      valid: boolean;
    }>;
  }> {
    const metadata = await this.getListMetadata(listId);
    const combiningMode = metadata.combiningMode;
    const listDefinition = staticListDefinitionLookup[listId];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- indexes are always strings (object keys)
    const firstIndex = listDefinition.indexes[0] as string;

    function validateItem(item: unknown): boolean {
      return listDefinition.storedItemSchema.safeParse(item).success;
    }

    const localTable = this.getLocalTable(listId);
    const remoteTable = await this.getActiveRemoteTable(listId);

    if (combiningMode === "localOnly") {
      const rawItems = await localTable
        .where({ [params.index]: params.value })
        .toArray();
      return {
        items: rawItems.map((item) => ({
          item,
          origin: "local" satisfies StaticListItemOrigin,
          valid: validateItem(item),
        })),
      };
    }

    if (combiningMode === "remoteOnly") {
      const rawItems = await remoteTable
        .where({ [params.index]: params.value })
        .toArray();
      return {
        items: rawItems.map((item) => ({
          item,
          origin: "remote" satisfies StaticListItemOrigin,
          valid: validateItem(item),
        })),
      };
    }

    // remoteWithLocalOverrides: search both, deduplicate by first index
    const remoteItems = await remoteTable
      .where({ [params.index]: params.value })
      .toArray();
    const localItems = await localTable
      .where({ [params.index]: params.value })
      .toArray();

    const localByKey = new Map<unknown, unknown>();
    for (const item of localItems) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown, accessing by dynamic key
      localByKey.set((item as Record<string, unknown>)[firstIndex], item);
    }

    type PageItem = {
      item: unknown;
      origin: StaticListItemOrigin;
      valid: boolean;
    };

    const seenKeys = new Set<unknown>();
    const items: PageItem[] = [];

    for (const remoteItem of remoteItems) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown, accessing by dynamic key
      const key = (remoteItem as Record<string, unknown>)[firstIndex];
      seenKeys.add(key);

      const localItem = localByKey.get(key);
      if (localItem) {
        items.push({
          item: localItem,
          origin: "localOverride",
          valid: validateItem(localItem),
        });
      } else {
        items.push({
          item: remoteItem,
          origin: "remote",
          valid: validateItem(remoteItem),
        });
      }
    }

    // Add pure-local items not already seen
    for (const [key, item] of localByKey) {
      if (!seenKeys.has(key)) {
        items.push({
          item,
          origin: "local",
          valid: validateItem(item),
        });
      }
    }

    return { items };
  }

  private async countPureLocalItems(listId: StaticListId): Promise<number> {
    const listDefinition = staticListDefinitionLookup[listId];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- indexes are always strings (object keys)
    const firstIndex = listDefinition.indexes[0] as string;

    const localItems = await this.getLocalTable(listId).toArray();
    const remoteTable = await this.getActiveRemoteTable(listId);

    let count = 0;
    for (const localItem of localItems) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown, accessing by dynamic key
      const key = (localItem as Record<string, unknown>)[firstIndex];
      const remoteMatch = await remoteTable.get({ [firstIndex]: key });
      if (!remoteMatch) {
        count += 1;
      }
    }
    return count;
  }

  // ── Summary recomputation ──────────────────────────────────────────

  private async recomputeLocalAndCombinedSummary(
    listId: StaticListId,
  ): Promise<void> {
    const listDefinition: StaticListDefinition =
      staticListDefinitionLookup[listId];
    const localItems = await this.getLocalTable(listId).toArray();

    const mutableLocalSummary = listDefinition.createEmptySummary();
    for (const item of localItems) {
      listDefinition.mutateSummary(mutableLocalSummary, item);
    }

    const metadata = await this.getListMetadata(listId);
    const updatedMetadata = await this.recomputeCombinedSummaryForMetadata(
      listId,
      {
        ...metadata,
        localSummary: structuredClone(mutableLocalSummary),
        localUpdatedAt: isoDateTimeSchema.parse(Date.now()),
      },
    );
    this.setListMetadata(updatedMetadata);
  }

  private async recomputeCombinedSummaryForMetadata(
    listId: StaticListId,
    metadata: StaticListMetadata,
  ): Promise<StaticListMetadata> {
    const combiningMode = metadata.combiningMode;
    const listDefinition: StaticListDefinition =
      staticListDefinitionLookup[listId];

    let combinedSummary: NonNullable<StaticListMetadata["combinedSummary"]>;

    if (combiningMode === "remoteOnly") {
      combinedSummary =
        metadata.remoteActive?.summary ?? listDefinition.createEmptySummary();
    } else if (combiningMode === "localOnly") {
      combinedSummary =
        metadata.localSummary ?? listDefinition.createEmptySummary();
    } else {
      // remoteWithLocalOverrides — start with remote, adjust for local items
      const remoteSummaryRaw = metadata.remoteActive?.summary;
      const remoteSummaryResult =
        listDefinition.summarySchema.safeParse(remoteSummaryRaw);
      const mutableCombined: WritableDeep<StaticListSummary> = structuredClone(
        remoteSummaryResult.data ?? listDefinition.createEmptySummary(),
      );

      const localItems = await this.getLocalTable(listId).toArray();
      const remoteTable = await this.getActiveRemoteTable(listId);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- indexes are always strings (object keys)
      const firstIndex = listDefinition.indexes[0] as string;

      for (const localItem of localItems) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown, accessing by dynamic key
        const localItemKey = (localItem as Record<string, unknown>)[firstIndex];
        const matchingRemoteItem = await remoteTable.get({
          [firstIndex]: localItemKey,
        });

        if (matchingRemoteItem) {
          // Override: remove the remote item's contribution, add local item's
          listDefinition.unmutateSummary(mutableCombined, matchingRemoteItem);
        }
        // Either way, add the local item's contribution
        listDefinition.mutateSummary(mutableCombined, localItem);
      }

      combinedSummary = mutableCombined;
    }

    return { ...metadata, combinedSummary };
  }

  // ── Public data access ─────────────────────────────────────────────

  async getItems<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<Array<StaticListItem<ListId>>> {
    const metadata = await this.getListMetadata(listId);
    const combiningMode = metadata.combiningMode;

    if (combiningMode === "localOnly") {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- data type is unknown, but we've parsed it with the right schema
      return (await this.getLocalTable(listId).toArray()) as Array<
        StaticListItem<ListId>
      >;
    }

    const remoteTable = await this.getActiveRemoteTable(listId);

    if (combiningMode === "remoteOnly") {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- data type is unknown, but we've parsed it with the right schema
      return (await remoteTable.toArray()) as Array<StaticListItem<ListId>>;
    }

    // remoteWithLocalOverrides
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown
    const remoteItems = (await remoteTable.toArray()) as Array<
      StaticListItem<ListId>
    >;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie stores items as unknown
    const localItems = (await this.getLocalTable(listId).toArray()) as Array<
      StaticListItem<ListId>
    >;

    if (localItems.length === 0) {
      return remoteItems;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- indexes are always strings (object keys)
    const firstIndex = staticListDefinitionLookup[listId].indexes[0] as string;

    const localByKey = new Map<unknown, StaticListItem<ListId>>();
    for (const item of localItems) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- accessing item by dynamic key
      localByKey.set((item as Record<string, unknown>)[firstIndex], item);
    }

    const result: Array<StaticListItem<ListId>> = remoteItems.map((item) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- accessing item by dynamic key
      const key = (item as Record<string, unknown>)[firstIndex];
      return localByKey.get(key) ?? item;
    });

    // Append pure-local items (not overriding any remote)
    const remoteKeys = new Set(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- accessing item by dynamic key
      remoteItems.map((item) => (item as Record<string, unknown>)[firstIndex]),
    );
    for (const [key, item] of localByKey) {
      if (!remoteKeys.has(key)) {
        result.push(item);
      }
    }

    return result;
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
    options?: { origin?: "remote" | "local" },
  ): Promise<StaticListItem<ListId> | undefined> {
    const listLogger = this.getListLogger(listId);
    const staticListDefinition = staticListDefinitionLookup[listId];

    async function findInTable(
      table: Table<unknown>,
    ): Promise<StaticListItem<ListId> | undefined> {
      const rawItem = await table.get({ [index]: value });
      if (!rawItem) {
        return undefined;
      }

      const parsedItem =
        staticListDefinition.storedItemSchema.safeParse(rawItem);

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

    // Explicit origin bypasses combining mode
    if (options?.origin === "remote") {
      return findInTable(await this.getActiveRemoteTable(listId));
    }
    if (options?.origin === "local") {
      return findInTable(this.getLocalTable(listId));
    }

    // Default: follow combining mode
    const metadata = await this.getListMetadata(listId);
    const combiningMode = metadata.combiningMode;

    if (combiningMode === "remoteOnly") {
      return findInTable(await this.getActiveRemoteTable(listId));
    }
    if (combiningMode === "localOnly") {
      return findInTable(this.getLocalTable(listId));
    }

    // remoteWithLocalOverrides: check local first, fall back to remote
    const localResult = await findInTable(this.getLocalTable(listId));
    if (localResult) {
      return localResult;
    }
    return findInTable(await this.getActiveRemoteTable(listId));
  }
}
