import type { Logger } from "@logtape/logtape";
import type { IndexableType, Table } from "dexie";
import type { Writable, WritableDeep } from "type-fest";
import type { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/@logging/categories";
import type {
  StaticListCombiningMode,
  StaticListItemOrigin,
  StaticListRemoteInstance,
  StaticListRemoteUpdateIssue,
  StaticListRemoteUpdateIssueStage,
  StaticListUpstreamInfo,
} from "@/shared/@model/static-list-helpers";
import type { StaticListMetadata } from "@/shared/@model/static-list-metadata";
import {
  staticListDefinitionLookup,
  type StaticListId,
  staticListIds,
  type StaticListItem,
  type StaticListsDataIssueState,
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
import { deriveStaticListsDataIssueState } from "./static-lists-service/data-issue-state";
import {
  getStaticListDefinitionInfo,
  type StaticListDefinitionInfo,
} from "./static-lists-service/definition-helpers";
import { interpretStoredRow } from "./static-lists-service/interpretation";
import {
  StaticListDatabases,
  type StaticListRowsDatabase,
} from "./static-lists-service/list-database";
import {
  omitLocalUpdatedAt,
  reconcileLocalMetadataWithRowsState,
  type StaticListLocalRowsState,
} from "./static-lists-service/local-metadata-helpers";
import {
  createDefaultStaticListMetadata,
  extractSummaryFromMetadata,
  extractUpdatedAtFromMetadata,
  getStaticListMetadataStore,
  pickAnotherRemoteInstance,
  shouldComputeDevSummaries,
  tryExtractSummaryFromMetadata,
  tryParseStaticListMetadata,
} from "./static-lists-service/metadata-helpers";
import {
  analyzeRemoteStagingTailRows,
  reconcileRemoteStagingMetadataWithRowsState,
  shouldVerifyResumedLine,
  type StaticListRemoteRowsState,
} from "./static-lists-service/remote-metadata-helpers";
import { isQuotaExceededRemoteUpdateError } from "./static-lists-service/remote-update-issue-helpers";
import {
  createStoredRemoteRow,
  prepareUnvalidatedLocalRow,
  prepareValidatedLocalRow,
} from "./static-lists-service/row-helpers";
import {
  cloneEmptySummary,
  createEmptySummary,
  tryInterpretSummaryItemDelta,
  withUpdatedDerivedDataVersion,
} from "./static-lists-service/summary-helpers";
import type {
  LocalWriteResult,
  RemoveLocalItemTarget,
  StaticListPageEntry,
  StaticListPutLocalItemsOptions,
  StoredLocalRow,
  StoredRemoteRow,
} from "./static-lists-service/types";

const logger = getBackgroundLogger(["static-lists-service"]);

const itemBatchSize = 1000;
const maxGetItemsCount = 10_000;
const defaultLocalRowLimit = 1000;
const resumeVerificationStride = 1000;

type PopulateFromUrlIfOutdatedResult =
  | {
      success: true;
      data: "updateNotNeeded" | "updated";
    }
  | {
      success: false;
      error: string;
    };

type ListContext = {
  listId: StaticListId;
  definitionInfo: StaticListDefinitionInfo;
  databases: StaticListDatabases;
  metadataStore: ReturnType<typeof getStaticListMetadataStore>;
  metadata: StaticListMetadata;
};

type PreparedLocalRowResult =
  | { success: true; row: StoredLocalRow }
  | { success: false; error: string; details?: unknown };

type RemoteStagingSession = {
  activeInstance: StaticListRemoteInstance;
  mutableStagingSummary: WritableDeep<StaticListSummary>;
  resumedHeadLineNumber: number;
  startedAtIso: IsoDateTime;
  targetInstance: StaticListRemoteInstance;
  targetTable: Table<StoredRemoteRow, number>;
};

type PopulateRemoteListOptions = {
  allowBlockedRetry?: boolean;
  deleteActiveCache?: boolean;
  forcePopulate?: boolean;
};

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
  if (buffer.length === 0) {
    return;
  }

  for (const line of buffer.split("\n")) {
    if (line.length > 0) {
      yield line;
    }
  }
}
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toIndexableType(value: IDBValidKey): IndexableType {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie's equals() API requires IndexableType, so we explicitly bridge from IDBValidKey here
  return value as unknown as IndexableType;
}

function omitRemoteStaging<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
): StaticListMetadata<ListId> {
  const {
    remoteStaging: remoteStagingOmitted,
    ...metadataWithoutRemoteStaging
  } = metadata;
  void remoteStagingOmitted;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- removing an exact-optional property via rest is correct at runtime but TS loses that shape
  return metadataWithoutRemoteStaging as StaticListMetadata<ListId>;
}

function omitRemoteActive<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
): StaticListMetadata<ListId> {
  const { remoteActive: remoteActiveOmitted, ...metadataWithoutRemoteActive } =
    metadata;
  void remoteActiveOmitted;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- removing an exact-optional property via rest is correct at runtime but TS loses that shape
  return metadataWithoutRemoteActive as StaticListMetadata<ListId>;
}

function omitRemoteUpdateIssue<ListId extends StaticListId>(
  metadata: StaticListMetadata<ListId>,
): StaticListMetadata<ListId> {
  const {
    remoteUpdateIssue: remoteUpdateIssueOmitted,
    ...metadataWithoutRemoteUpdateIssue
  } = metadata;
  void remoteUpdateIssueOmitted;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- removing an exact-optional property via rest is correct at runtime but TS loses that shape
  return metadataWithoutRemoteUpdateIssue as StaticListMetadata<ListId>;
}

function sortLocalRows(rows: StoredLocalRow[]): StoredLocalRow[] {
  return rows.toSorted((left, right) => {
    if (left.u !== right.u) {
      return right.u.localeCompare(left.u);
    }

    return left.i.localeCompare(right.i);
  });
}

function createPageEntryFromStoredRow(
  listId: StaticListId,
  storedRow: StoredLocalRow | StoredRemoteRow,
  origin: StaticListItemOrigin,
  shadowedRemoteRowKeys: IDBValidKey[] = [],
): StaticListPageEntry {
  const interpretedRow = interpretStoredRow(listId, storedRow, origin);

  return {
    rowKey: interpretedRow.rowKey,
    origin,
    logicalPrimaryKey: interpretedRow.logicalPrimaryKey,
    indexValues: interpretedRow.cachedIndexValues,
    sourceText: interpretedRow.sourceText,
    sourceItem: interpretedRow.sourceItem,
    interpretation: interpretedRow.interpretation,
    shadowedRemoteRowKeys,
  };
}

function coerceLegacyRemoveLocalItemTarget(
  listId: StaticListId,
  targetOrIndex: RemoveLocalItemTarget | string,
  value?: unknown,
): RemoveLocalItemTarget {
  if (typeof targetOrIndex === "object") {
    return targetOrIndex;
  }

  const definitionInfo = getStaticListDefinitionInfo(listId);
  if (targetOrIndex !== definitionInfo.logicalPrimaryKeySlot.definition.name) {
    // eslint-disable-next-line no-restricted-syntax -- invalid legacy index usage is a programmer error and should fail loudly
    throw new Error(
      `Unsupported legacy removeLocalItem index "${targetOrIndex}" for ${listId}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the legacy overload only supports the logical primary key, which is always an IDB-valid key
  return { logicalPrimaryKey: value as IDBValidKey };
}

/**
 * Static lists persist remote rows as raw JSONL source and interpret them only
 * when something reads them.
 *
 * That split is the main architectural choice behind this rewrite:
 *
 * - remote storage stays source-preserving across extension upgrades
 * - `derivedDataVersion` can force a cheap redownload instead of a DB rebuild
 * - malformed remote/local rows remain inspectable in the sidepanel
 * - local/combined summaries stay in memory so `remoteOnly` avoids dev-only
 *   overhead
 */
export class StaticListsService {
  private readonly aliasManagerForStaticApi: AliasManager;
  private readonly rootConfigService: RootConfigService;
  private disposed = false;

  private readonly contextByListId = new Map<StaticListId, ListContext>();
  private readonly initializationPromiseByListId = new Map<
    StaticListId,
    Promise<ListContext>
  >();
  private readonly updatePromiseByListId = new Map<
    StaticListId,
    Promise<PopulateFromUrlIfOutdatedResult>
  >();
  private readonly localMutationTailByListId = new Map<
    StaticListId,
    Promise<void>
  >();

  private readonly localSummaryByListId = new Map<
    StaticListId,
    StaticListSummary
  >();
  private readonly combinedSummaryByListId = new Map<
    StaticListId,
    StaticListSummary
  >();

  private readonly pollableListMetadataByListId: Readonly<
    Record<StaticListId, Pollable<StaticListMetadata | undefined>>
  >;
  private readonly pollableListSummaryByListId: Readonly<
    Record<StaticListId, Pollable<StaticListSummary | undefined>>
  >;
  private readonly pollableRemoteStagingSummaryByListId: Readonly<
    Record<StaticListId, Pollable<StaticListSummary | undefined>>
  >;
  private readonly pollableDataIssueState: Pollable<StaticListsDataIssueState>;
  private readonly pollableListUpdatedAtByListId: Readonly<
    Record<StaticListId, Pollable<IsoDateTime | undefined>>
  >;

  constructor({
    aliasManagerForStaticApi,
    rootConfigService,
  }: {
    aliasManagerForStaticApi: AliasManager;
    rootConfigService: RootConfigService;
  }) {
    this.aliasManagerForStaticApi = aliasManagerForStaticApi;
    this.rootConfigService = rootConfigService;

    const pollableListMetadataByListId: Writable<
      Partial<typeof this.pollableListMetadataByListId>
    > = {};
    const pollableListSummaryByListId: Writable<
      Partial<typeof this.pollableListSummaryByListId>
    > = {};
    const pollableRemoteStagingSummaryByListId: Writable<
      Partial<typeof this.pollableRemoteStagingSummaryByListId>
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
      pollableRemoteStagingSummaryByListId[listId] = new Pollable<
        StaticListSummary | undefined
      >(undefined);
      pollableListUpdatedAtByListId[listId] = new Pollable<
        IsoDateTime | undefined
      >(undefined);
    }

    this.pollableListMetadataByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the constructor fully populates each per-list pollable map before freezing it onto readonly fields
      pollableListMetadataByListId as typeof this.pollableListMetadataByListId;
    this.pollableListSummaryByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the constructor fully populates each per-list pollable map before freezing it onto readonly fields
      pollableListSummaryByListId as typeof this.pollableListSummaryByListId;
    this.pollableRemoteStagingSummaryByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the constructor fully populates each per-list pollable map before freezing it onto readonly fields
      pollableRemoteStagingSummaryByListId as typeof this.pollableRemoteStagingSummaryByListId;
    this.pollableListUpdatedAtByListId =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the constructor fully populates each per-list pollable map before freezing it onto readonly fields
      pollableListUpdatedAtByListId as typeof this.pollableListUpdatedAtByListId;

    this.pollableDataIssueState = new Pollable<StaticListsDataIssueState>({
      kind: "none",
    });
  }

  [Symbol.dispose](): void {
    this.disposed = true;

    for (const context of this.contextByListId.values()) {
      context.databases.closeAll();
    }
  }

  private getListLogger(listId: StaticListId): Logger {
    return logger.getChild([listId]);
  }

  private async getRemoteRowsState(
    remoteTable: Table<StoredRemoteRow, number> | undefined,
  ): Promise<StaticListRemoteRowsState> {
    if (!remoteTable) {
      return "missing";
    }

    return (await remoteTable.count()) === 0 ? "empty" : "present";
  }

  private async getRemoteHeadLineNumber(
    remoteTable: Table<StoredRemoteRow, number>,
  ): Promise<number> {
    const lastRow = await remoteTable.orderBy("r").last();
    return lastRow?.r ?? 0;
  }

  private async getRemoteTailRows(
    remoteTable: Table<StoredRemoteRow, number>,
    lineNumberExclusive: number,
  ): Promise<StoredRemoteRow[]> {
    return lineNumberExclusive <= 0
      ? await remoteTable.orderBy("r").toArray()
      : await remoteTable.where("r").above(lineNumberExclusive).sortBy("r");
  }

  private async discardRemoteStaging(
    listId: StaticListId,
    options?: { deleteRows?: boolean },
  ): Promise<void> {
    const context = await this.ensureListContext(listId);

    if (options?.deleteRows !== false) {
      await context.databases.deleteRemoteDatabase(
        pickAnotherRemoteInstance(context.metadata.remoteActiveInstance),
      );
    }

    if (context.metadata.remoteStaging) {
      await this.persistMetadata(listId, omitRemoteStaging(context.metadata));
    }
  }

  private async promoteRemoteStaging({
    activeInstance,
    listId,
    startedAtIso,
    summary,
    targetInstance,
    upstreamInfo,
  }: {
    activeInstance: StaticListRemoteInstance;
    listId: StaticListId;
    startedAtIso: IsoDateTime;
    summary: StaticListSummary;
    targetInstance: StaticListRemoteInstance;
    upstreamInfo: StaticListUpstreamInfo;
  }): Promise<void> {
    const context = await this.ensureListContext(listId);
    const finalMetadata = withUpdatedDerivedDataVersion(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- this runtime update path works with an erased list id, but the summary was built from that same list's definition
      {
        ...this.getCurrentMetadata(listId),
        remoteActiveInstance: targetInstance,
        remoteActive: {
          startedAt: startedAtIso,
          updatedAt: isoDateTimeSchema.parse(Date.now()),
          upstreamInfo,
          summary: structuredClone(summary),
        },
      } as StaticListMetadata,
    );

    if (shouldComputeDevSummaries(finalMetadata.combiningMode)) {
      await this.persistMetadata(listId, omitRemoteStaging(finalMetadata), {
        publish: false,
      });
      await this.recomputeDevSummaries(listId);
    } else {
      await this.persistMetadata(listId, omitRemoteStaging(finalMetadata));
    }

    await context.databases.deleteRemoteDatabase(activeInstance);
  }

  private async createFreshRemoteStaging(
    listId: StaticListId,
    upstreamInfo: StaticListUpstreamInfo,
  ): Promise<RemoteStagingSession> {
    const context = await this.ensureListContext(listId);
    const startedAtIso = isoDateTimeSchema.parse(Date.now());
    const targetInstance = pickAnotherRemoteInstance(
      context.metadata.remoteActiveInstance,
    );
    const activeInstance = context.metadata.remoteActiveInstance;
    const targetDatabase =
      await context.databases.resetRemoteDatabase(targetInstance);
    const mutableStagingSummary: WritableDeep<StaticListSummary> =
      cloneEmptySummary(listId);

    await this.persistMetadata(
      listId,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- this runtime update path works with an erased list id, but the summary was built from that same list's definition
      {
        ...context.metadata,
        remoteStaging: {
          durableLineNumber: 0,
          startedAt: startedAtIso,
          updatedAt: startedAtIso,
          upstreamInfo,
          summary: structuredClone(mutableStagingSummary),
        },
      } as StaticListMetadata,
    );

    return {
      activeInstance,
      mutableStagingSummary,
      resumedHeadLineNumber: 0,
      startedAtIso,
      targetInstance,
      targetTable: targetDatabase.rows,
    };
  }

  private async tryResumeRemoteStaging(
    listId: StaticListId,
    upstreamInfo: StaticListUpstreamInfo,
  ): Promise<RemoteStagingSession | undefined> {
    const context = await this.ensureListContext(listId);
    const listLogger = this.getListLogger(listId);
    const remoteStaging = context.metadata.remoteStaging;
    if (!remoteStaging) {
      return;
    }

    if (
      remoteStaging.upstreamInfo.generatedAt !== upstreamInfo.generatedAt ||
      remoteStaging.upstreamInfo.itemCount !== upstreamInfo.itemCount
    ) {
      listLogger.info(
        "Discarding staging because upstream info changed ({oldGeneratedAt}/{oldItemCount} -> {newGeneratedAt}/{newItemCount})",
        {
          newGeneratedAt: upstreamInfo.generatedAt,
          newItemCount: upstreamInfo.itemCount,
          oldGeneratedAt: remoteStaging.upstreamInfo.generatedAt,
          oldItemCount: remoteStaging.upstreamInfo.itemCount,
        },
      );
      await this.discardRemoteStaging(listId);
      return;
    }

    if (remoteStaging.durableLineNumber === undefined) {
      listLogger.info(
        "Discarding staging because durable cursor is missing in persisted metadata",
      );
      await this.discardRemoteStaging(listId);
      return;
    }

    const targetInstance = pickAnotherRemoteInstance(
      context.metadata.remoteActiveInstance,
    );
    const targetTable = await context.databases.getRemoteRows(targetInstance, {
      createIfMissing: false,
    });
    const remoteRowsState = await this.getRemoteRowsState(targetTable);

    if (remoteRowsState !== "present" || !targetTable) {
      listLogger.info(
        "Discarding staging because resumable rows are no longer present ({remoteRowsState})",
        { remoteRowsState },
      );
      await this.discardRemoteStaging(listId, {
        deleteRows: remoteRowsState !== "missing",
      });
      return;
    }

    const resumedHeadLineNumber =
      await this.getRemoteHeadLineNumber(targetTable);
    if (resumedHeadLineNumber > upstreamInfo.itemCount) {
      listLogger.info(
        "Discarding staging because staged rows exceed upstream item count ({resumedHeadLineNumber} > {itemCount})",
        {
          itemCount: upstreamInfo.itemCount,
          resumedHeadLineNumber,
        },
      );
      await this.discardRemoteStaging(listId);
      return;
    }

    const tailRows = await this.getRemoteTailRows(
      targetTable,
      remoteStaging.durableLineNumber,
    );
    const tailAnalysis = analyzeRemoteStagingTailRows({
      durableLineNumber: remoteStaging.durableLineNumber,
      headLineNumber: resumedHeadLineNumber,
      tailLineNumbers: tailRows.map((row) => row.r),
    });

    if (!tailAnalysis.success) {
      listLogger.info(
        "Discarding staging because persisted tail is invalid ({reason})",
        { reason: tailAnalysis.reason },
      );
      await this.discardRemoteStaging(listId);
      return;
    }

    const mutableStagingSummary: WritableDeep<StaticListSummary> =
      structuredClone(
        extractSummaryFromMetadata(context.metadata, "remoteStaging"),
      );

    for (const tailRow of tailRows) {
      const interpretedRow = interpretStoredRow(listId, tailRow, "remote");
      if (interpretedRow.interpretation.success) {
        context.definitionInfo.definition.adjustSummary(
          mutableStagingSummary,
          interpretedRow.interpretation.item,
          1,
        );
      }
    }

    if (tailRows.length > 0) {
      await this.persistMetadata(
        listId,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- this runtime update path works with an erased list id, but the summary was built from that same list's definition
        {
          ...this.getCurrentMetadata(listId),
          remoteStaging: {
            ...remoteStaging,
            durableLineNumber: resumedHeadLineNumber,
            summary: structuredClone(mutableStagingSummary),
            updatedAt: isoDateTimeSchema.parse(Date.now()),
          },
        } as StaticListMetadata,
      );

      listLogger.info(
        "Recovered staging summary tail for {repairedLineCount} row(s) before resume",
        {
          repairedLineCount: tailAnalysis.repairedLineCount,
        },
      );
    }

    listLogger.info("Resuming staging from line {resumedHeadLineNumber}", {
      resumedHeadLineNumber,
    });

    return {
      activeInstance: context.metadata.remoteActiveInstance,
      mutableStagingSummary,
      resumedHeadLineNumber,
      startedAtIso: remoteStaging.startedAt,
      targetInstance,
      targetTable,
    };
  }

  private async recordRemoteUpdateIssue({
    error,
    listId,
    stage,
    upstreamInfo,
  }: {
    error: unknown;
    listId: StaticListId;
    stage: StaticListRemoteUpdateIssueStage;
    upstreamInfo: StaticListUpstreamInfo;
  }): Promise<boolean> {
    if (!isQuotaExceededRemoteUpdateError(error)) {
      return false;
    }

    const issue: StaticListRemoteUpdateIssue = {
      failedAt: isoDateTimeSchema.parse(Date.now()),
      kind: "quotaExceeded",
      stage,
      upstreamInfo,
    };

    const context = await this.ensureListContext(listId);
    await context.databases.deleteRemoteDatabase(
      pickAnotherRemoteInstance(context.metadata.remoteActiveInstance),
    );

    await this.persistMetadata(
      listId,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- this runtime update path works with an erased list id while preserving the current list-specific metadata shape
      {
        ...omitRemoteStaging(context.metadata),
        remoteUpdateIssue: issue,
      } as StaticListMetadata,
    );

    return true;
  }

  private async prepareBlockedRemoteUpdateRetry(
    listId: StaticListId,
    options?: { deleteActiveCache?: boolean },
  ): Promise<void> {
    const context = await this.ensureListContext(listId);
    let nextMetadata = omitRemoteUpdateIssue(
      omitRemoteStaging(context.metadata),
    );

    if (context.metadata.remoteStaging) {
      await context.databases.deleteRemoteDatabase(
        pickAnotherRemoteInstance(context.metadata.remoteActiveInstance),
      );
    }

    if (options?.deleteActiveCache && context.metadata.remoteActive) {
      await context.databases.deleteRemoteDatabase(
        context.metadata.remoteActiveInstance,
      );
      nextMetadata = omitRemoteActive(nextMetadata);
    }

    await this.persistMetadata(listId, nextMetadata);
  }

  /**
   * Initialization is where we reconcile persisted metadata with the actual
   * databases on disk.
   *
   * The recovery policy intentionally treats remote and local state
   * differently: remote snapshots are disposable and cheap to redownload,
   * while local rows are the only state that may represent developer edits.
   * That is why metadata/summary incompatibility resets remote state only, but
   * a physical storage-version mismatch still wipes everything.
   */
  private async initializeListContext(
    listId: StaticListId,
  ): Promise<ListContext> {
    const listLogger = this.getListLogger(listId);
    const definitionInfo = getStaticListDefinitionInfo(listId);
    const metadataStore = getStaticListMetadataStore(listId);
    let databases = new StaticListDatabases(listId);

    async function resetDatabases() {
      databases.closeAll();
      await databases.deleteAllDatabases();
      databases = new StaticListDatabases(listId);
    }

    async function resetRemoteDatabases() {
      databases.closeAll();
      await databases.deleteRemoteDatabases();
      databases = new StaticListDatabases(listId);
    }

    const rawMetadata = await metadataStore.getValue();
    let metadata = rawMetadata
      ? tryParseStaticListMetadata(listId, rawMetadata)
      : undefined;

    if (rawMetadata && !metadata) {
      listLogger.warn(
        "Stored metadata is incompatible with the current list definition, resetting remote state and preserving local rows",
      );

      await resetRemoteDatabases();
      metadata = createDefaultStaticListMetadata(listId);
      await metadataStore.setValue(metadata);
    }

    if (
      metadata &&
      metadata.physicalStorageVersion !==
        definitionInfo.definition.physicalStorageVersion
    ) {
      listLogger.warn(
        "Physical storage version mismatch {storedVersion} -> {runtimeVersion}, wiping list storage",
        {
          storedVersion: metadata.physicalStorageVersion,
          runtimeVersion: definitionInfo.definition.physicalStorageVersion,
        },
      );

      await resetDatabases();
      metadata = undefined;
    }

    if (!metadata) {
      await resetRemoteDatabases();
      metadata = createDefaultStaticListMetadata(listId);
      await metadataStore.setValue(metadata);
    }

    const activeRemoteRows = await databases.getRemoteRows(
      metadata.remoteActiveInstance,
      { createIfMissing: false },
    );
    if (metadata.remoteActive && !activeRemoteRows) {
      listLogger.warn(
        "Remote active database is missing, clearing remote metadata",
      );

      metadata = omitRemoteStaging(omitRemoteActive(metadata));
      await metadataStore.setValue(metadata);
    }

    const inactiveRemoteInstance = pickAnotherRemoteInstance(
      metadata.remoteActiveInstance,
    );
    const inactiveRemoteTable = await databases.getRemoteRows(
      inactiveRemoteInstance,
      { createIfMissing: false },
    );
    const remoteStagingRecovery = reconcileRemoteStagingMetadataWithRowsState(
      metadata,
      await this.getRemoteRowsState(inactiveRemoteTable),
    );
    metadata = remoteStagingRecovery.metadata;

    switch (remoteStagingRecovery.recovery) {
      case "missing": {
        listLogger.warn(
          "Remote staging metadata exists but the inactive remote database is missing, clearing staging metadata",
        );
        await metadataStore.setValue(metadata);
        break;
      }

      case "empty": {
        listLogger.warn(
          "Inactive remote database is empty, clearing staging metadata and deleting the empty database",
        );
        await databases.deleteRemoteDatabase(inactiveRemoteInstance);
        await metadataStore.setValue(metadata);
        break;
      }

      case "orphaned": {
        listLogger.warn(
          "Inactive remote database exists without staging metadata, deleting orphaned staging rows",
        );
        await databases.deleteRemoteDatabase(inactiveRemoteInstance);
        break;
      }

      case "present":
      case undefined: {
        break;
      }
    }

    if (metadata.localUpdatedAt) {
      const localTable = await databases.getLocalRows({
        createIfMissing: false,
      });
      const localRowsState: StaticListLocalRowsState = localTable
        ? (await localTable.count()) === 0
          ? "empty"
          : "present"
        : "missing";
      const localMetadataRecovery = reconcileLocalMetadataWithRowsState(
        metadata,
        localRowsState,
      );

      if (localMetadataRecovery.recovery) {
        if (localMetadataRecovery.recovery === "empty") {
          listLogger.warn(
            "Local database exists but is empty, clearing local metadata",
          );
          await databases.deleteLocalDatabase();
        } else {
          listLogger.debug(
            "Local database is missing, clearing stale local metadata",
          );
        }

        metadata = localMetadataRecovery.metadata;
        await metadataStore.setValue(metadata);
      }
    }

    if (
      metadata.derivedDataVersion !==
        definitionInfo.definition.derivedDataVersion &&
      !tryExtractSummaryFromMetadata(metadata)
    ) {
      listLogger.warn(
        "Stored active summary is incompatible with derived data version {storedVersion} -> {runtimeVersion}, resetting remote state and preserving local rows",
        {
          storedVersion: metadata.derivedDataVersion,
          runtimeVersion: definitionInfo.definition.derivedDataVersion,
        },
      );

      await resetRemoteDatabases();
      metadata = createDefaultStaticListMetadata(listId);
      await metadataStore.setValue(metadata);
    }

    const initializedMetadata = metadata;

    const context: ListContext = {
      listId,
      definitionInfo,
      databases,
      metadataStore,
      metadata: initializedMetadata,
    };

    this.contextByListId.set(listId, context);

    if (shouldComputeDevSummaries(initializedMetadata.combiningMode)) {
      await this.recomputeDevSummaries(listId);
    }

    this.publishListState(listId);
    return context;
  }

  private async ensureListContext(listId: StaticListId): Promise<ListContext> {
    const cachedContext = this.contextByListId.get(listId);
    if (cachedContext) {
      return cachedContext;
    }

    let initializationPromise = this.initializationPromiseByListId.get(listId);
    if (!initializationPromise) {
      initializationPromise = this.initializeListContext(listId).finally(() => {
        this.initializationPromiseByListId.delete(listId);
      });

      this.initializationPromiseByListId.set(listId, initializationPromise);
    }

    return await initializationPromise;
  }

  private getCurrentMetadata<ListId extends StaticListId>(
    listId: ListId,
  ): StaticListMetadata<ListId> {
    const context = this.contextByListId.get(listId);
    if (!context) {
      // eslint-disable-next-line no-restricted-syntax -- callers only reach this after initialization; throwing surfaces broken service state immediately
      throw new Error(`Static list context is not initialized for ${listId}`);
    }

    const { metadata } = context;
    if (metadata.listId !== listId) {
      // eslint-disable-next-line no-restricted-syntax -- stored context metadata should always match the owning list id
      throw new Error(`Static list metadata listId mismatch for ${listId}`);
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- runtime guard above re-establishes the generic list-id correlation
    return metadata as StaticListMetadata<ListId>;
  }

  private async persistMetadata<ListId extends StaticListId>(
    listId: ListId,
    metadata: StaticListMetadata<ListId>,
    options?: { publish?: boolean },
  ): Promise<void> {
    const context = await this.ensureListContext(listId);
    context.metadata = metadata;
    await context.metadataStore.setValue(metadata);
    if (options?.publish !== false) {
      this.publishListState(listId);
    }
  }

  private publishListState(listId: StaticListId): void {
    const context = this.contextByListId.get(listId);
    if (!context) {
      return;
    }

    const metadata = context.metadata;

    this.pollableListMetadataByListId[listId].setValue(metadata);
    this.pollableRemoteStagingSummaryByListId[listId].setValue(
      metadata.remoteStaging
        ? extractSummaryFromMetadata(metadata, "remoteStaging")
        : undefined,
    );
    this.pollableListUpdatedAtByListId[listId].setValue(
      extractUpdatedAtFromMetadata(metadata),
    );
    this.pollableDataIssueState.setValue(
      deriveStaticListsDataIssueState(
        [...this.contextByListId.values()].map(
          ({ metadata: currentMetadata }) => currentMetadata,
        ),
      ),
    );

    if (metadata.combiningMode === "remoteOnly") {
      this.pollableListSummaryByListId[listId].setValue(
        extractSummaryFromMetadata(metadata),
      );
      return;
    }

    if (metadata.combiningMode === "localOnly") {
      this.pollableListSummaryByListId[listId].setValue(
        this.localSummaryByListId.get(listId) ?? createEmptySummary(listId),
      );
      return;
    }

    this.pollableListSummaryByListId[listId].setValue(
      this.combinedSummaryByListId.get(listId) ?? createEmptySummary(listId),
    );
  }

  private async getActiveRemoteTable(
    listId: StaticListId,
  ): Promise<Table<StoredRemoteRow, number> | undefined> {
    const context = await this.ensureListContext(listId);
    return await context.databases.getRemoteRows(
      context.metadata.remoteActiveInstance,
      { createIfMissing: false },
    );
  }

  private async getLocalDatabase(
    listId: StaticListId,
    options?: { createIfMissing?: boolean },
  ): Promise<StaticListRowsDatabase<StoredLocalRow, string> | undefined> {
    const context = await this.ensureListContext(listId);
    return await context.databases.getLocalDatabase(options);
  }

  private async getWritableLocalDatabase(
    listId: StaticListId,
  ): Promise<StaticListRowsDatabase<StoredLocalRow, string>> {
    const localDatabase = await this.getLocalDatabase(listId, {
      createIfMissing: true,
    });

    if (!localDatabase) {
      // eslint-disable-next-line no-restricted-syntax -- write callers require a writable local database
      throw new Error(`Failed to create local database for ${listId}`);
    }

    return localDatabase;
  }

  private async getLocalTable(
    listId: StaticListId,
    options?: { createIfMissing?: boolean },
  ): Promise<Table<StoredLocalRow, string> | undefined> {
    const localDatabase = await this.getLocalDatabase(listId, options);
    return localDatabase?.rows;
  }

  private async getLocalRowsState(
    listId: StaticListId,
  ): Promise<StaticListLocalRowsState> {
    const localTable = await this.getLocalTable(listId, {
      createIfMissing: false,
    });
    if (!localTable) {
      return "missing";
    }

    return (await localTable.count()) === 0 ? "empty" : "present";
  }

  private async withLocalMutationLock<T>(
    listId: StaticListId,
    callback: () => Promise<T>,
  ): Promise<T> {
    const previousTail = this.localMutationTailByListId.get(listId);
    const settledPreviousTail = previousTail?.catch(() => undefined);
    let releaseCurrentTail: (() => void) | undefined;
    const currentTail = new Promise<void>((resolve) => {
      releaseCurrentTail = resolve;
    });
    const queuedTail = (settledPreviousTail ?? Promise.resolve()).then(
      () => currentTail,
    );

    this.localMutationTailByListId.set(listId, queuedTail);
    await settledPreviousTail;

    try {
      return await callback();
    } finally {
      releaseCurrentTail?.();

      if (this.localMutationTailByListId.get(listId) === queuedTail) {
        this.localMutationTailByListId.delete(listId);
      }
    }
  }

  private async afterLocalRowsChanged(
    listId: StaticListId,
    localTable?: Table<StoredLocalRow, string>,
  ): Promise<void> {
    const remainingLocalRowCount = localTable ? await localTable.count() : 0;
    const metadata = this.getCurrentMetadata(listId);
    const updatedMetadata =
      remainingLocalRowCount === 0
        ? omitLocalUpdatedAt(metadata)
        : {
            ...metadata,
            localUpdatedAt: isoDateTimeSchema.parse(Date.now()),
          };

    if (remainingLocalRowCount === 0) {
      const context = await this.ensureListContext(listId);
      await context.databases.deleteLocalDatabase();
    }

    await this.persistMetadata(listId, updatedMetadata, {
      publish: !shouldComputeDevSummaries(updatedMetadata.combiningMode),
    });

    if (shouldComputeDevSummaries(updatedMetadata.combiningMode)) {
      await this.recomputeDevSummaries(listId);
      return;
    }

    this.clearDevSummaryCaches(listId);
    this.publishListState(listId);
  }

  private async getPureLocalRows(
    listId: StaticListId,
  ): Promise<StoredLocalRow[]> {
    const localTable = await this.getLocalTable(listId, {
      createIfMissing: false,
    });
    if (!localTable) {
      return [];
    }

    const localRows = sortLocalRows(await localTable.toArray());
    const activeRemoteTable = await this.getActiveRemoteTable(listId);
    if (!activeRemoteTable) {
      return localRows;
    }
    const remotePresenceByLogicalPrimaryKey = new Map<IDBValidKey, boolean>();

    for (const localRow of localRows) {
      if (localRow.p === undefined) {
        continue;
      }

      if (!remotePresenceByLogicalPrimaryKey.has(localRow.p)) {
        remotePresenceByLogicalPrimaryKey.set(
          localRow.p,
          (await activeRemoteTable
            .where("p")
            .equals(toIndexableType(localRow.p))
            .count()) > 0,
        );
      }
    }

    return localRows.filter(
      (localRow) =>
        localRow.p === undefined ||
        !remotePresenceByLogicalPrimaryKey.get(localRow.p),
    );
  }

  private async recomputeLocalSummary(
    listId: StaticListId,
  ): Promise<StaticListSummary> {
    const mutableSummary: WritableDeep<StaticListSummary> =
      cloneEmptySummary(listId);
    const localTable = await this.getLocalTable(listId, {
      createIfMissing: false,
    });
    const localRows = localTable ? await localTable.toArray() : [];

    for (const localRow of localRows) {
      tryInterpretSummaryItemDelta(
        listId,
        mutableSummary,
        localRow,
        "local",
        1,
      );
    }

    const summary: StaticListSummary = mutableSummary;
    this.localSummaryByListId.set(listId, summary);
    return summary;
  }

  private async recomputeCombinedSummary(
    listId: StaticListId,
  ): Promise<StaticListSummary> {
    const metadata = this.getCurrentMetadata(listId);
    const mutableSummary: WritableDeep<StaticListSummary> = structuredClone(
      extractSummaryFromMetadata(metadata),
    );
    const localTable = await this.getLocalTable(listId, {
      createIfMissing: false,
    });
    const localRows = localTable ? await localTable.toArray() : [];
    const activeRemoteTable = await this.getActiveRemoteTable(listId);
    if (!activeRemoteTable) {
      for (const localRow of localRows) {
        tryInterpretSummaryItemDelta(
          listId,
          mutableSummary,
          localRow,
          "local",
          1,
        );
      }

      const summary: StaticListSummary = mutableSummary;
      this.combinedSummaryByListId.set(listId, summary);
      return summary;
    }
    const processedShadowedKeys = new Set<IDBValidKey>();

    for (const localRow of localRows) {
      if (localRow.p !== undefined && !processedShadowedKeys.has(localRow.p)) {
        const matchingRemoteRows = await activeRemoteTable
          .where("p")
          .equals(toIndexableType(localRow.p))
          .toArray();

        for (const remoteRow of matchingRemoteRows) {
          tryInterpretSummaryItemDelta(
            listId,
            mutableSummary,
            remoteRow,
            "remote",
            -1,
          );
        }

        processedShadowedKeys.add(localRow.p);
      }

      tryInterpretSummaryItemDelta(
        listId,
        mutableSummary,
        localRow,
        "local",
        1,
      );
    }

    const summary: StaticListSummary = mutableSummary;
    this.combinedSummaryByListId.set(listId, summary);
    return summary;
  }

  private async recomputeDevSummaries(listId: StaticListId): Promise<void> {
    const metadata = this.getCurrentMetadata(listId);
    const localSummary = await this.recomputeLocalSummary(listId);

    if (metadata.combiningMode === "remoteWithLocalOverrides") {
      await this.recomputeCombinedSummary(listId);
    } else if (metadata.combiningMode === "localOnly") {
      this.combinedSummaryByListId.set(listId, localSummary);
    }

    this.publishListState(listId);
  }

  private clearDevSummaryCaches(listId: StaticListId): void {
    this.localSummaryByListId.delete(listId);
    this.combinedSummaryByListId.delete(listId);
  }

  private resolveSlotName(
    listId: StaticListId,
    publicIndexName: string,
  ): "p" | `s${number}` {
    const slotName =
      getStaticListDefinitionInfo(listId).publicIndexNameToSlotName[
        publicIndexName
      ];

    if (!slotName) {
      // eslint-disable-next-line no-restricted-syntax -- callers must request declared indexes only
      throw new Error(
        `Unknown static list index "${publicIndexName}" for ${listId}`,
      );
    }

    return slotName;
  }

  private async findRowInTable<
    Row extends StoredRemoteRow | StoredLocalRow,
    Key,
  >(
    table: Table<Row, Key>,
    slotName: "p" | `s${number}`,
    value: IDBValidKey,
  ): Promise<Row | undefined> {
    return (
      (await table.where(slotName).equals(toIndexableType(value)).first()) ??
      undefined
    );
  }

  private async getVisibleEntryCount(listId: StaticListId): Promise<number> {
    const metadata = await this.getListMetadata(listId);

    if (metadata.combiningMode === "localOnly") {
      const localTable = await this.getLocalTable(listId, {
        createIfMissing: false,
      });
      return localTable ? await localTable.count() : 0;
    }

    const activeRemoteTable = await this.getActiveRemoteTable(listId);
    const remoteStoredCount = activeRemoteTable
      ? await activeRemoteTable.count()
      : 0;
    if (metadata.combiningMode === "remoteOnly") {
      return remoteStoredCount;
    }

    const pureLocalRows = await this.getPureLocalRows(listId);
    return remoteStoredCount + pureLocalRows.length;
  }

  public async pollListMetadata<ListId extends StaticListId>(
    lastPollVersion: PollVersion | undefined,
    listId: ListId,
  ): Promise<PollResult<StaticListMetadata<ListId>>> {
    await this.ensureListContext(listId);

    let result:
      | PollResult<StaticListMetadata | undefined>
      | PollResult<undefined>
      | undefined;

    do {
      const pollVersion =
        result === undefined ? lastPollVersion : result.version;
      result =
        await this.pollableListMetadataByListId[listId].poll(pollVersion);
    } while (!result.value);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pollable values are published from validated per-list metadata
    return result as unknown as PollResult<StaticListMetadata<ListId>>;
  }

  public async getListMetadata<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<StaticListMetadata<ListId>> {
    const result = await this.pollListMetadata(undefined, listId);
    return result.value;
  }

  public async pollListSummary<ListId extends StaticListId>(
    lastPollVersion: PollVersion | undefined,
    listId: ListId,
  ): Promise<PollResult<StaticListSummary<ListId>>> {
    await this.ensureListContext(listId);

    let result:
      | PollResult<StaticListSummary | undefined>
      | PollResult<undefined>
      | undefined;

    do {
      const pollVersion =
        result === undefined ? lastPollVersion : result.version;
      result = await this.pollableListSummaryByListId[listId].poll(pollVersion);
    } while (!result.value);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pollable values are published from list-specific validated summaries
    return result as unknown as PollResult<StaticListSummary<ListId>>;
  }

  public async getListSummary<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<StaticListSummary<ListId>> {
    const result = await this.pollListSummary(undefined, listId);
    return result.value;
  }

  public async pollListUpdatedAt(
    lastPollVersion: PollVersion | undefined,
    listId: StaticListId,
  ): Promise<PollResult<IsoDateTime | undefined>> {
    await this.ensureListContext(listId);
    return this.pollableListUpdatedAtByListId[listId].poll(lastPollVersion);
  }

  public async getListUpdatedAt(
    listId: StaticListId,
  ): Promise<IsoDateTime | undefined> {
    const result = await this.pollListUpdatedAt(undefined, listId);
    return result.value;
  }

  public async pollDataIssueState(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<StaticListsDataIssueState>> {
    await Promise.all(
      staticListIds.map(async (listId) => this.ensureListContext(listId)),
    );
    return await this.pollableDataIssueState.poll(lastPollVersion);
  }

  public async getDataIssueState(): Promise<StaticListsDataIssueState> {
    const result = await this.pollDataIssueState(undefined);
    return result.value;
  }

  public async getRemoteListSummary<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<StaticListSummary<ListId>> {
    const metadata = await this.getListMetadata(listId);
    return extractSummaryFromMetadata(metadata);
  }

  public async getRemoteStagingSummary<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<StaticListSummary<ListId> | undefined> {
    const metadata = await this.getListMetadata(listId);
    return metadata.remoteStaging
      ? extractSummaryFromMetadata(metadata, "remoteStaging")
      : undefined;
  }

  public async pollRemoteStagingSummary<ListId extends StaticListId>(
    lastPollVersion: PollVersion | undefined,
    listId: ListId,
  ): Promise<PollResult<StaticListSummary<ListId> | undefined>> {
    await this.ensureListContext(listId);
    const result =
      await this.pollableRemoteStagingSummaryByListId[listId].poll(
        lastPollVersion,
      );

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pollable values are published from list-specific validated summaries
    return result as unknown as PollResult<
      StaticListSummary<ListId> | undefined
    >;
  }

  public async getLocalListSummary<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<StaticListSummary<ListId>> {
    if (!this.localSummaryByListId.has(listId)) {
      await this.recomputeLocalSummary(listId);
    }

    return (
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- local summaries are stored per validated list id but the map itself is intentionally erased
      (this.localSummaryByListId.get(listId) as
        | StaticListSummary<ListId>
        | undefined) ?? createEmptySummary(listId)
    );
  }

  public getLocalRowLimit(listId: StaticListId): number {
    return (
      staticListDefinitionLookup[listId].localRowLimit ?? defaultLocalRowLimit
    );
  }

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
    const listLogger = this.getListLogger(listId);
    const metadata = await this.getListMetadata(listId);
    const localMetadataRecovery = reconcileLocalMetadataWithRowsState(
      { ...metadata, combiningMode: mode },
      await this.getLocalRowsState(listId),
    );
    const updatedMetadata = localMetadataRecovery.metadata;

    if (localMetadataRecovery.recovery === "empty") {
      listLogger.warn(
        "Local database exists but is empty, clearing local metadata on mode change",
      );
      const context = await this.ensureListContext(listId);
      await context.databases.deleteLocalDatabase();
    } else if (localMetadataRecovery.recovery === "missing") {
      listLogger.debug(
        "Local database is missing, clearing stale local metadata on mode change",
      );
    }

    await this.persistMetadata(listId, updatedMetadata, {
      publish: !shouldComputeDevSummaries(mode),
    });

    if (shouldComputeDevSummaries(mode)) {
      await this.recomputeDevSummaries(listId);
      return;
    }

    this.clearDevSummaryCaches(listId);
    this.publishListState(listId);
  }

  private needsRemoteUpdate({
    metadata,
    upstreamGeneratedAt,
    toleranceInMinutes,
    listId,
  }: {
    metadata: StaticListMetadata;
    upstreamGeneratedAt: IsoDateTime;
    toleranceInMinutes: number | undefined;
    listId: StaticListId;
  }): boolean {
    const definition = staticListDefinitionLookup[listId];

    if (!metadata.remoteActive) {
      return true;
    }

    if (metadata.derivedDataVersion !== definition.derivedDataVersion) {
      return true;
    }

    if (metadata.remoteActive.upstreamInfo.generatedAt >= upstreamGeneratedAt) {
      return false;
    }

    return (
      new Date(upstreamGeneratedAt).getTime() +
        (toleranceInMinutes ?? 0) * 60 * 1000 <
      Date.now()
    );
  }

  private async populateRemoteList(
    listId: StaticListId,
    toleranceInMinutes: number | undefined,
    options?: PopulateRemoteListOptions,
  ): Promise<PopulateFromUrlIfOutdatedResult> {
    const listLogger = this.getListLogger(listId);
    const context = await this.ensureListContext(listId);
    const rootConfig = await this.rootConfigService.get();
    const upstreamInfo =
      rootConfig.remoteSystemLookup.staticApi.listLookup[listId];
    const metadata = this.getCurrentMetadata(listId);

    if (
      metadata.remoteUpdateIssue?.kind === "quotaExceeded" &&
      !options?.allowBlockedRetry
    ) {
      listLogger.info(
        "Skipping automatic remote update because quota-blocked state is active",
      );
      return { success: true, data: "updateNotNeeded" };
    }

    if (
      !options?.forcePopulate &&
      !this.needsRemoteUpdate({
        listId,
        metadata,
        toleranceInMinutes,
        upstreamGeneratedAt: upstreamInfo.generatedAt,
      })
    ) {
      return { success: true, data: "updateNotNeeded" };
    }

    if (options?.allowBlockedRetry) {
      await this.prepareBlockedRemoteUpdateRetry(
        listId,
        options.deleteActiveCache ? { deleteActiveCache: true } : undefined,
      );
    }

    let shouldForceFreshRestart = false;
    let currentStage: StaticListRemoteUpdateIssueStage = "createStaging";

    for (;;) {
      try {
        currentStage = "createStaging";
        const stagingSession = shouldForceFreshRestart
          ? await this.createFreshRemoteStaging(listId, upstreamInfo)
          : ((await this.tryResumeRemoteStaging(listId, upstreamInfo)) ??
            (await this.createFreshRemoteStaging(listId, upstreamInfo)));

        const {
          activeInstance,
          mutableStagingSummary,
          resumedHeadLineNumber,
          startedAtIso,
          targetInstance,
          targetTable,
        } = stagingSession;

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

        let lineNumber = 0;
        let storedBatchCount = 0;
        let storedRowCount = 0;
        let rowsToStore: StoredRemoteRow[] = [];
        let restartFreshReason: string | undefined;

        const flushBatch = async (shouldPersistStagingProgress: boolean) => {
          if (rowsToStore.length === 0) {
            return;
          }

          currentStage = "writeRows";
          const durableLineNumber = rowsToStore.at(-1)?.r ?? 0;
          storedBatchCount += 1;
          storedRowCount += rowsToStore.length;
          await targetTable.bulkPut(rowsToStore);
          rowsToStore = [];

          if (!shouldPersistStagingProgress) {
            return;
          }

          const currentMetadata = this.getCurrentMetadata(listId);
          if (!currentMetadata.remoteStaging) {
            return;
          }

          await this.persistMetadata(
            listId,
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- this runtime update path works with an erased list id, but the summary was built from that same list's definition
            {
              ...currentMetadata,
              remoteStaging: {
                ...currentMetadata.remoteStaging,
                durableLineNumber,
                updatedAt: isoDateTimeSchema.parse(Date.now()),
                summary: structuredClone(mutableStagingSummary),
              },
            } as StaticListMetadata,
          );
        };

        for await (const line of streamLines(fetchResult.response.body)) {
          lineNumber += 1;

          if (lineNumber <= resumedHeadLineNumber) {
            if (
              !shouldVerifyResumedLine({
                durableLineNumber: resumedHeadLineNumber,
                lineNumber,
                stride: resumeVerificationStride,
              })
            ) {
              continue;
            }

            const stagedRow = await targetTable
              .where("r")
              .equals(lineNumber)
              .first();

            if (!stagedRow) {
              restartFreshReason = `Missing staged row at line ${lineNumber}`;
              break;
            }

            if (stagedRow.t !== line) {
              restartFreshReason = `Staged row content mismatch at line ${lineNumber}`;
              break;
            }

            continue;
          }

          const storedRow = createStoredRemoteRow({
            listId,
            lineNumber,
            sourceText: line,
          });

          rowsToStore.push(storedRow);

          const interpretedRow = interpretStoredRow(
            listId,
            storedRow,
            "remote",
          );
          if (interpretedRow.interpretation.success) {
            context.definitionInfo.definition.adjustSummary(
              mutableStagingSummary,
              interpretedRow.interpretation.item,
              1,
            );
          }

          if (rowsToStore.length >= itemBatchSize) {
            await flushBatch(true);
          }
        }

        if (!restartFreshReason && lineNumber < resumedHeadLineNumber) {
          restartFreshReason = `Remote list ended at line ${lineNumber} before staged prefix ${resumedHeadLineNumber}`;
        }

        if (
          !restartFreshReason &&
          resumedHeadLineNumber === upstreamInfo.itemCount &&
          lineNumber !== resumedHeadLineNumber
        ) {
          restartFreshReason = `Remote list length changed during direct promotion verification (${lineNumber} !== ${resumedHeadLineNumber})`;
        }

        if (restartFreshReason) {
          listLogger.warn(
            "Selective resume verification failed, discarding staging and retrying fresh: {reason}",
            { reason: restartFreshReason },
          );
          await this.discardRemoteStaging(listId);

          if (shouldForceFreshRestart) {
            return { success: false, error: restartFreshReason };
          }

          shouldForceFreshRestart = true;
          continue;
        }

        await flushBatch(false);
        currentStage = "promote";

        await this.promoteRemoteStaging({
          activeInstance,
          listId,
          startedAtIso,
          summary: mutableStagingSummary,
          targetInstance,
          upstreamInfo,
        });

        if (resumedHeadLineNumber > 0 && storedRowCount === 0) {
          listLogger.info(
            "Verified and promoted completed staging without downloading new rows",
          );
        } else {
          listLogger.info(
            "Populated {storedRowCount} remote rows (batches: {storedBatchCount}, resumedFromLine: {resumedHeadLineNumber})",
            {
              resumedHeadLineNumber,
              storedBatchCount,
              storedRowCount,
            },
          );
        }

        return { success: true, data: "updated" };
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        if (
          await this.recordRemoteUpdateIssue({
            error,
            listId,
            stage: currentStage,
            upstreamInfo,
          })
        ) {
          listLogger.error(
            "Remote update is paused because storage quota was exceeded during {stage}: {error}",
            { error: errorMessage, stage: currentStage },
          );

          return { success: false, error: errorMessage };
        }

        listLogger.error("Unexpected error while populating: {error}", {
          error: errorMessage,
        });

        return { success: false, error: errorMessage };
      }
    }
  }

  private async runRemotePopulateWithDeduping(
    listId: StaticListId,
    toleranceInMinutes: number | undefined,
    options?: PopulateRemoteListOptions,
  ): Promise<PopulateFromUrlIfOutdatedResult> {
    const existingPromise = this.updatePromiseByListId.get(listId);
    if (existingPromise) {
      return await existingPromise;
    }

    const updatePromise = this.populateRemoteList(
      listId,
      toleranceInMinutes,
      options,
    ).finally(() => {
      this.updatePromiseByListId.delete(listId);
    });

    this.updatePromiseByListId.set(listId, updatePromise);
    return await updatePromise;
  }

  public async populateListIfOutdated(
    listId: StaticListId,
    toleranceInMinutes: number | undefined,
  ): Promise<PopulateFromUrlIfOutdatedResult> {
    return await this.runRemotePopulateWithDeduping(listId, toleranceInMinutes);
  }

  public updateIfNeeded(payload?: {
    listIds?: StaticListId[] | undefined;
    toleranceInMinutes?: number | undefined;
  }): void {
    for (const listId of payload?.listIds ?? staticListIds) {
      void this.runRemotePopulateWithDeduping(
        listId,
        payload?.toleranceInMinutes,
      ).catch((error: unknown) => {
        this.getListLogger(listId).error(
          "Unexpected error while updating static list: {error}",
          {
            error: getErrorMessage(error),
          },
        );
      });
    }
  }

  public async retryBlockedRemoteUpdates(payload?: {
    deleteActiveCache?: boolean;
  }): Promise<void> {
    await Promise.all(
      staticListIds.map(async (listId) => this.ensureListContext(listId)),
    );

    await Promise.all(
      staticListIds.map(async (listId) => {
        const metadata = this.getCurrentMetadata(listId);
        if (metadata.remoteUpdateIssue?.kind !== "quotaExceeded") {
          return;
        }

        await this.runRemotePopulateWithDeduping(listId, undefined, {
          allowBlockedRetry: true,
          deleteActiveCache:
            payload?.deleteActiveCache === true &&
            Boolean(metadata.remoteActive),
          forcePopulate: true,
        });
      }),
    );
  }

  private prepareLocalRow(
    listId: StaticListId,
    item: unknown,
    options?: StaticListPutLocalItemsOptions,
    existingRowId?: string,
  ): PreparedLocalRowResult {
    const updatedAt = Date.now();
    const validate = options?.validate ?? true;

    if (validate) {
      const result = prepareValidatedLocalRow({
        listId,
        item,
        existingRowId,
        updatedAt,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          details: result.details,
        };
      }

      return { success: true, row: result.row };
    }

    const result = prepareUnvalidatedLocalRow({
      listId,
      item,
      existingRowId,
      updatedAt,
    });

    if (!result.success) {
      return result;
    }

    return { success: true, row: result.row };
  }

  private checkPutLocalRowLimit(
    listId: StaticListId,
    existingRows: StoredLocalRow[],
    rows: StoredLocalRow[],
  ): LocalWriteResult {
    const limit = this.getLocalRowLimit(listId);
    const existingLogicalPrimaryKeys = new Set(
      existingRows.flatMap((row) => (row.p === undefined ? [] : [row.p])),
    );

    const distinctNewLogicalPrimaryKeys = new Set<IDBValidKey>();
    let rowsWithoutLogicalPrimaryKey = 0;

    for (const row of rows) {
      if (row.p === undefined) {
        rowsWithoutLogicalPrimaryKey += 1;
        continue;
      }

      distinctNewLogicalPrimaryKeys.add(row.p);
    }

    let finalCount = existingRows.length + rowsWithoutLogicalPrimaryKey;

    for (const logicalPrimaryKey of distinctNewLogicalPrimaryKeys) {
      if (!existingLogicalPrimaryKeys.has(logicalPrimaryKey)) {
        finalCount += 1;
      }
    }

    if (finalCount > limit) {
      return {
        success: false,
        error: "localRowLimitExceeded",
        limit,
        attempting: finalCount,
      };
    }

    return { success: true };
  }

  public async putLocalItem(
    listId: StaticListId,
    item: unknown,
    options?: StaticListPutLocalItemsOptions,
  ): Promise<LocalWriteResult> {
    return await this.putLocalItems(listId, [item], options);
  }

  public async putLocalItems(
    listId: StaticListId,
    items: unknown[],
    options?: StaticListPutLocalItemsOptions,
  ): Promise<LocalWriteResult> {
    return await this.withLocalMutationLock(listId, async () => {
      const existingLocalTable = await this.getLocalTable(listId, {
        createIfMissing: false,
      });
      const existingRows = existingLocalTable
        ? await existingLocalTable.toArray()
        : [];
      const exactTargetRow =
        options?.rowKey && items.length === 1
          ? existingRows.find((existingRow) => existingRow.i === options.rowKey)
          : undefined;
      const existingRowByLogicalPrimaryKey = new Map<
        IDBValidKey,
        StoredLocalRow
      >();

      for (const existingRow of existingRows) {
        if (
          existingRow.p !== undefined &&
          !existingRowByLogicalPrimaryKey.has(existingRow.p)
        ) {
          existingRowByLogicalPrimaryKey.set(existingRow.p, existingRow);
        }
      }

      if (options?.rowKey && items.length === 1) {
        if (!exactTargetRow) {
          return {
            success: false,
            error: "localRowNotFound",
          };
        }

        const preparedRowResult = this.prepareLocalRow(
          listId,
          items[0],
          options,
          exactTargetRow.i,
        );
        if (!preparedRowResult.success) {
          return preparedRowResult;
        }

        const existingRowsWithoutTarget = existingRows.filter(
          (existingRow) => existingRow.i !== exactTargetRow.i,
        );
        const limitCheckResult = this.checkPutLocalRowLimit(
          listId,
          existingRowsWithoutTarget,
          [preparedRowResult.row],
        );
        if (!limitCheckResult.success) {
          return limitCheckResult;
        }

        const localDatabase = await this.getWritableLocalDatabase(listId);
        const localTable = localDatabase.rows;
        await localDatabase.db.transaction("rw", localTable, async () => {
          // A concrete row edit should keep controlling that physical row even
          // if the user changes its logical key. If the new key collides with
          // another local row, we prefer one deterministic winner over silently
          // leaving duplicate local rows around.
          if (preparedRowResult.row.p !== undefined) {
            const conflictingRowIds = existingRowsWithoutTarget.flatMap(
              (existingRow) =>
                existingRow.p === preparedRowResult.row.p
                  ? [existingRow.i]
                  : [],
            );

            if (conflictingRowIds.length > 0) {
              await localTable.bulkDelete(conflictingRowIds);
            }
          }

          await localTable.put(preparedRowResult.row);
        });

        await this.afterLocalRowsChanged(listId, localTable);
        return { success: true };
      }

      const preparedRowsByLogicalPrimaryKey = new Map<
        IDBValidKey,
        StoredLocalRow
      >();
      const rowsWithoutLogicalPrimaryKey: StoredLocalRow[] = [];

      for (const item of items) {
        const preparedRowResult = this.prepareLocalRow(listId, item, options);
        if (!preparedRowResult.success) {
          return preparedRowResult;
        }

        if (preparedRowResult.row.p === undefined) {
          rowsWithoutLogicalPrimaryKey.push(preparedRowResult.row);
          continue;
        }

        const existingRow = existingRowByLogicalPrimaryKey.get(
          preparedRowResult.row.p,
        );
        preparedRowsByLogicalPrimaryKey.set(preparedRowResult.row.p, {
          ...preparedRowResult.row,
          i: existingRow?.i ?? preparedRowResult.row.i,
        });
      }

      const limitCheckResult = this.checkPutLocalRowLimit(
        listId,
        existingRows,
        [
          ...preparedRowsByLogicalPrimaryKey.values(),
          ...rowsWithoutLogicalPrimaryKey,
        ],
      );
      if (!limitCheckResult.success) {
        return limitCheckResult;
      }

      const localDatabase = await this.getWritableLocalDatabase(listId);
      const localTable = localDatabase.rows;
      await localDatabase.db.transaction("rw", localTable, async () => {
        for (const [
          logicalPrimaryKey,
          preparedRow,
        ] of preparedRowsByLogicalPrimaryKey) {
          const existingRow =
            existingRowByLogicalPrimaryKey.get(logicalPrimaryKey);
          if (existingRow) {
            await localTable.put({
              ...preparedRow,
              i: existingRow.i,
            });
            continue;
          }

          await localTable.add(preparedRow);
        }

        if (rowsWithoutLogicalPrimaryKey.length > 0) {
          await localTable.bulkPut(rowsWithoutLogicalPrimaryKey);
        }
      });

      await this.afterLocalRowsChanged(listId, localTable);
      return { success: true };
    });
  }

  public async setLocalItems(
    listId: StaticListId,
    items: unknown[],
    options?: { validate?: boolean },
  ): Promise<LocalWriteResult> {
    const limit = this.getLocalRowLimit(listId);
    if (items.length > limit) {
      return {
        success: false,
        error: "localRowLimitExceeded",
        limit,
        attempting: items.length,
      };
    }

    const preparedRows: StoredLocalRow[] = [];
    for (const item of items) {
      const preparedRowResult = this.prepareLocalRow(listId, item, options);
      if (!preparedRowResult.success) {
        return preparedRowResult;
      }

      preparedRows.push(preparedRowResult.row);
    }

    return await this.withLocalMutationLock(listId, async () => {
      if (preparedRows.length === 0) {
        await this.afterLocalRowsChanged(listId);
        return { success: true };
      }

      const localDatabase = await this.getWritableLocalDatabase(listId);
      const localTable = localDatabase.rows;
      await localDatabase.db.transaction("rw", localTable, async () => {
        await localTable.clear();
        if (preparedRows.length > 0) {
          await localTable.bulkAdd(preparedRows);
        }
      });

      await this.afterLocalRowsChanged(listId, localTable);
      return { success: true };
    });
  }

  public async removeLocalItem(
    listId: StaticListId,
    target: RemoveLocalItemTarget | string,
    value?: unknown,
  ): Promise<{ deletedCount: number }> {
    return await this.withLocalMutationLock(listId, async () => {
      const normalizedTarget = coerceLegacyRemoveLocalItemTarget(
        listId,
        target,
        value,
      );
      const localTable = await this.getLocalTable(listId, {
        createIfMissing: false,
      });
      if (!localTable) {
        return { deletedCount: 0 };
      }

      const deletedCount =
        "rowKey" in normalizedTarget
          ? await localTable.where("i").equals(normalizedTarget.rowKey).delete()
          : await localTable
              .where("p")
              .equals(toIndexableType(normalizedTarget.logicalPrimaryKey))
              .delete();

      if (deletedCount === 0) {
        return { deletedCount };
      }

      await this.afterLocalRowsChanged(listId, localTable);
      return { deletedCount };
    });
  }

  public async getEntriesPage(
    listId: StaticListId,
    params: { offset: number; limit: number },
  ): Promise<{
    items: StaticListPageEntry[];
    totalCount: number;
  }> {
    const metadata = await this.getListMetadata(listId);

    if (metadata.combiningMode === "localOnly") {
      const localTable = await this.getLocalTable(listId, {
        createIfMissing: false,
      });
      const sortedLocalRows = sortLocalRows(
        localTable ? await localTable.toArray() : [],
      );
      const pageRows = sortedLocalRows.slice(
        params.offset,
        params.offset + params.limit,
      );

      return {
        items: pageRows.map((row) =>
          createPageEntryFromStoredRow(listId, row, "local"),
        ),
        totalCount: sortedLocalRows.length,
      };
    }

    const activeRemoteTable = await this.getActiveRemoteTable(listId);
    const remoteStoredCount = activeRemoteTable
      ? await activeRemoteTable.count()
      : 0;

    if (metadata.combiningMode === "remoteOnly") {
      const pageRows = activeRemoteTable
        ? await activeRemoteTable
            .orderBy("r")
            .offset(params.offset)
            .limit(params.limit)
            .toArray()
        : [];

      return {
        items: pageRows.map((row) =>
          createPageEntryFromStoredRow(listId, row, "remote"),
        ),
        totalCount: remoteStoredCount,
      };
    }

    const localTable = await this.getLocalTable(listId, {
      createIfMissing: false,
    });
    const localRows = sortLocalRows(
      localTable ? await localTable.toArray() : [],
    );
    const localOverrideByLogicalPrimaryKey = new Map<
      IDBValidKey,
      StoredLocalRow
    >();

    for (const localRow of localRows) {
      if (
        localRow.p !== undefined &&
        !localOverrideByLogicalPrimaryKey.has(localRow.p)
      ) {
        localOverrideByLogicalPrimaryKey.set(localRow.p, localRow);
      }
    }

    const pureLocalRows = await this.getPureLocalRows(listId);
    const totalCount = remoteStoredCount + pureLocalRows.length;

    if (params.offset >= remoteStoredCount) {
      const localOffset = params.offset - remoteStoredCount;
      const pageRows = pureLocalRows.slice(
        localOffset,
        localOffset + params.limit,
      );

      return {
        items: pageRows.map((row) =>
          createPageEntryFromStoredRow(listId, row, "local"),
        ),
        totalCount,
      };
    }

    const remotePageRows = activeRemoteTable
      ? await activeRemoteTable
          .orderBy("r")
          .offset(params.offset)
          .limit(params.limit)
          .toArray()
      : [];

    // The merged sequence keeps the remote segment length stable, even when a
    // local row shadows one or more remote rows. That stability is the paging
    // contract for combined mode: offsets stay "remote segment first, pure
    // local tail second" without rebuilding the whole merged list in memory.
    const shadowedRemoteRowKeysByLogicalPrimaryKey = new Map<
      IDBValidKey,
      IDBValidKey[]
    >();

    for (const remoteRow of remotePageRows) {
      if (
        activeRemoteTable &&
        remoteRow.p !== undefined &&
        localOverrideByLogicalPrimaryKey.has(remoteRow.p) &&
        !shadowedRemoteRowKeysByLogicalPrimaryKey.has(remoteRow.p)
      ) {
        const shadowedRemotePrimaryKeys = await activeRemoteTable
          .where("p")
          .equals(toIndexableType(remoteRow.p))
          .primaryKeys();

        shadowedRemoteRowKeysByLogicalPrimaryKey.set(
          remoteRow.p,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dexie primaryKeys() is untyped to the queried index slot, but this query returns remote row primary keys
          shadowedRemotePrimaryKeys as IDBValidKey[],
        );
      }
    }

    const items = remotePageRows.map((remoteRow) => {
      if (
        remoteRow.p !== undefined &&
        localOverrideByLogicalPrimaryKey.has(remoteRow.p)
      ) {
        const localOverrideRow = localOverrideByLogicalPrimaryKey.get(
          remoteRow.p,
        );
        if (!localOverrideRow) {
          return createPageEntryFromStoredRow(listId, remoteRow, "remote");
        }

        return createPageEntryFromStoredRow(
          listId,
          localOverrideRow,
          "localOverride",
          shadowedRemoteRowKeysByLogicalPrimaryKey.get(remoteRow.p) ?? [],
        );
      }

      return createPageEntryFromStoredRow(listId, remoteRow, "remote");
    });

    const remaining = params.limit - items.length;
    if (remaining > 0) {
      for (const localRow of pureLocalRows.slice(0, remaining)) {
        items.push(createPageEntryFromStoredRow(listId, localRow, "local"));
      }
    }

    return { items, totalCount };
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
    const result = await this.getEntriesPage(listId, params);

    return {
      totalCount: result.totalCount,
      items: result.items.map((entry) => ({
        item: entry.interpretation.success
          ? entry.interpretation.item
          : {
              sourceText: entry.sourceText,
              sourceItem: entry.sourceItem,
            },
        origin: entry.origin,
        valid: entry.interpretation.success,
      })),
    };
  }

  async getItems<ListId extends StaticListId>(
    listId: ListId,
  ): Promise<Array<StaticListItem<ListId>>> {
    const totalCount = await this.getVisibleEntryCount(listId);
    if (totalCount > maxGetItemsCount) {
      this.getListLogger(listId).error(
        "getItems() is disabled for lists above {maxGetItemsCount} rows",
        { maxGetItemsCount },
      );
      return [];
    }

    const page = await this.getEntriesPage(listId, {
      offset: 0,
      limit: totalCount,
    });

    return page.items.flatMap((entry) =>
      entry.interpretation.success
        ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- getItems() filters to successful interpretations before projecting them to the list-specific item type
          [entry.interpretation.item as StaticListItem<ListId>]
        : [],
    );
  }

  async pollItems<ListId extends StaticListId>(
    lastPollVersion: PollVersion | undefined,
    listId: ListId,
  ): Promise<PollResult<Array<StaticListItem<ListId>>>> {
    const metadataResult = await this.pollListMetadata(lastPollVersion, listId);
    return {
      version: metadataResult.version,
      value: await this.getItems(listId),
    };
  }

  async findItem<
    ListId extends StaticListId,
    Index extends keyof z.infer<
      (typeof staticListDefinitionLookup)[ListId]["interpretedItemSchema"]
    >,
  >(
    listId: ListId,
    index: Index,
    value: z.infer<
      (typeof staticListDefinitionLookup)[ListId]["interpretedItemSchema"]
    >[Index],
  ): Promise<StaticListItem<ListId> | undefined> {
    // Business reads intentionally stay typed and lossy: once a local row
    // shadows a remote row, malformed local data makes the item behave as
    // absent rather than silently falling back to the remote snapshot.
    if (value === undefined) {
      return undefined;
    }

    const slotName = this.resolveSlotName(listId, String(index));
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- declared indexes are limited to IDB-valid key domains for this API
    const lookupValue = value as IDBValidKey;

    function interpretTypedItem(
      storedRow: StoredLocalRow | StoredRemoteRow | undefined,
      origin: StaticListItemOrigin,
    ): StaticListItem<ListId> | undefined {
      if (!storedRow) {
        return undefined;
      }

      const interpretedRow = interpretStoredRow(listId, storedRow, origin);
      if (!interpretedRow.interpretation.success) {
        return undefined;
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the interpreted item belongs to the same list id used to query and interpret the row
      return interpretedRow.interpretation.item as StaticListItem<ListId>;
    }

    const metadata = await this.getListMetadata(listId);
    if (metadata.combiningMode === "remoteOnly") {
      const activeRemoteTable = await this.getActiveRemoteTable(listId);

      return interpretTypedItem(
        activeRemoteTable
          ? await this.findRowInTable(activeRemoteTable, slotName, lookupValue)
          : undefined,
        "remote",
      );
    }

    const localTable = await this.getLocalTable(listId, {
      createIfMissing: false,
    });

    if (metadata.combiningMode === "localOnly") {
      return interpretTypedItem(
        localTable
          ? await this.findRowInTable(localTable, slotName, lookupValue)
          : undefined,
        "local",
      );
    }

    const activeRemoteTable = await this.getActiveRemoteTable(listId);

    const localMatch = localTable
      ? await this.findRowInTable(localTable, slotName, lookupValue)
      : undefined;
    if (localMatch) {
      return interpretTypedItem(localMatch, "local");
    }

    const remoteMatch = activeRemoteTable
      ? await this.findRowInTable(activeRemoteTable, slotName, lookupValue)
      : undefined;
    if (!remoteMatch) {
      return undefined;
    }

    if (remoteMatch.p !== undefined && localTable) {
      const overridingLocalRow = await localTable
        .where("p")
        .equals(toIndexableType(remoteMatch.p))
        .first();
      if (overridingLocalRow) {
        return undefined;
      }
    }

    return interpretTypedItem(remoteMatch, "remote");
  }
}
