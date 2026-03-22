import { Dexie, type Table } from "dexie";

import type { StaticListRemoteInstance } from "@/shared/@model/static-list-helpers";
import type { StaticListId } from "@/shared/@model/static-lists";

import {
  buildRowStoreSchema,
  getStaticListDefinitionInfo,
} from "./definition-helpers";
import type { StoredLocalRow, StoredRemoteRow } from "./types";

const remoteDatabaseRoleByInstance = {
  a: "remote_a",
  b: "remote_b",
} as const satisfies Record<StaticListRemoteInstance, `remote_${string}`>;

const rowsStoreName = "rows";

function getRowsDatabaseName({
  listId,
  databaseRole,
}: {
  listId: StaticListId;
  databaseRole: "local" | `remote_${string}`;
}): string {
  return `static-lists:${listId}:${databaseRole}`;
}

export type StaticListRowsDatabase<Row, Key> = {
  db: Dexie;
  rows: Table<Row, Key>;
};

/**
 * Each list gets physically separate `remote_a`, `remote_b`, and lazy `local`
 * databases.
 *
 * The goal is operational simplicity rather than raw database cleverness:
 * promoting a download becomes a metadata flip, stale remote snapshots can be
 * deleted wholesale, and production users never create a local DB unless they
 * actually touch dev-only features.
 */
function createRowsDatabase<Row, Key>({
  listId,
  databaseRole,
  physicalKey,
}: {
  listId: StaticListId;
  databaseRole: "local" | `remote_${string}`;
  physicalKey: "r" | "i";
}): StaticListRowsDatabase<Row, Key> {
  const definitionInfo = getStaticListDefinitionInfo(listId);
  const db = new Dexie(getRowsDatabaseName({ listId, databaseRole }));

  db.version(definitionInfo.definition.physicalStorageVersion).stores({
    [rowsStoreName]: buildRowStoreSchema({
      physicalKey,
      secondaryIndexCount: definitionInfo.secondaryIndexSlots.length,
    }),
  });

  return {
    db,
    rows: db.table<Row, Key>(rowsStoreName),
  };
}

function createRemoteRowsDatabase(
  listId: StaticListId,
  instance: StaticListRemoteInstance,
): StaticListRowsDatabase<StoredRemoteRow, number> {
  return createRowsDatabase({
    listId,
    databaseRole: remoteDatabaseRoleByInstance[instance],
    physicalKey: "r",
  });
}

function createLocalRowsDatabase(
  listId: StaticListId,
): StaticListRowsDatabase<StoredLocalRow, string> {
  return createRowsDatabase({
    listId,
    databaseRole: "local",
    physicalKey: "i",
  });
}

export class StaticListDatabases {
  private readonly listId: StaticListId;
  private readonly remoteDatabaseByInstance: Record<
    StaticListRemoteInstance,
    StaticListRowsDatabase<StoredRemoteRow, number> | undefined
  > = {
    a: undefined,
    b: undefined,
  };
  private readonly remoteDatabaseStateByInstance: Record<
    StaticListRemoteInstance,
    "unknown" | "present" | "absent"
  > = {
    a: "unknown",
    b: "unknown",
  };
  private localDatabase:
    | StaticListRowsDatabase<StoredLocalRow, string>
    | undefined;
  private localDatabaseState: "unknown" | "present" | "absent" = "unknown";

  constructor(listId: StaticListId) {
    this.listId = listId;
  }

  private async openRowsDatabase<Row, Key>(
    database: StaticListRowsDatabase<Row, Key>,
  ): Promise<StaticListRowsDatabase<Row, Key>> {
    if (!database.db.isOpen()) {
      await database.db.open();
    }

    return database;
  }

  private ensureRemoteDatabase(
    instance: StaticListRemoteInstance,
  ): StaticListRowsDatabase<StoredRemoteRow, number> {
    this.remoteDatabaseByInstance[instance] ??= createRemoteRowsDatabase(
      this.listId,
      instance,
    );
    this.remoteDatabaseStateByInstance[instance] = "present";

    return this.remoteDatabaseByInstance[instance];
  }

  public async getRemoteDatabase(
    instance: StaticListRemoteInstance,
    options?: { createIfMissing?: boolean },
  ): Promise<StaticListRowsDatabase<StoredRemoteRow, number> | undefined> {
    if (options?.createIfMissing === false) {
      if (this.remoteDatabaseStateByInstance[instance] === "absent") {
        return undefined;
      }

      if (
        this.remoteDatabaseStateByInstance[instance] === "unknown" &&
        !this.remoteDatabaseByInstance[instance] &&
        !(await Dexie.exists(
          getRowsDatabaseName({
            listId: this.listId,
            databaseRole: remoteDatabaseRoleByInstance[instance],
          }),
        ))
      ) {
        this.remoteDatabaseStateByInstance[instance] = "absent";
        return undefined;
      }
    }

    return await this.openRowsDatabase(this.ensureRemoteDatabase(instance));
  }

  public async getRemoteRows(
    instance: StaticListRemoteInstance,
    options?: { createIfMissing?: boolean },
  ): Promise<Table<StoredRemoteRow, number> | undefined> {
    const database = await this.getRemoteDatabase(instance, options);
    return database?.rows;
  }

  public async resetRemoteDatabase(
    instance: StaticListRemoteInstance,
  ): Promise<StaticListRowsDatabase<StoredRemoteRow, number>> {
    await this.deleteRemoteDatabase(instance);
    const database = await this.getRemoteDatabase(instance);
    if (!database) {
      // eslint-disable-next-line no-restricted-syntax -- resetting a remote database must recreate it
      throw new Error(`Failed to recreate remote database ${instance}`);
    }

    return database;
  }

  public async deleteRemoteDatabase(
    instance: StaticListRemoteInstance,
  ): Promise<void> {
    const database =
      this.remoteDatabaseByInstance[instance] ??
      createRemoteRowsDatabase(this.listId, instance);

    this.remoteDatabaseByInstance[instance] = undefined;
    this.remoteDatabaseStateByInstance[instance] = "absent";
    database.db.close();
    await database.db.delete();
  }

  /**
   * Remote-only resets are intentionally cheaper than full resets because
   * remote data is reproducible while local rows may contain developer work.
   */
  public async deleteRemoteDatabases(): Promise<void> {
    await Promise.all([
      this.deleteRemoteDatabase("a"),
      this.deleteRemoteDatabase("b"),
    ]);
  }

  private ensureLocalDatabase(): StaticListRowsDatabase<
    StoredLocalRow,
    string
  > {
    this.localDatabase ??= createLocalRowsDatabase(this.listId);
    this.localDatabaseState = "present";
    return this.localDatabase;
  }

  public async getLocalDatabase(options?: {
    createIfMissing?: boolean;
  }): Promise<StaticListRowsDatabase<StoredLocalRow, string> | undefined> {
    if (options?.createIfMissing === false) {
      if (this.localDatabaseState === "absent") {
        return undefined;
      }

      if (
        this.localDatabaseState === "unknown" &&
        !this.localDatabase &&
        !(await Dexie.exists(
          getRowsDatabaseName({
            listId: this.listId,
            databaseRole: "local",
          }),
        ))
      ) {
        this.localDatabaseState = "absent";
        return undefined;
      }
    }

    return await this.openRowsDatabase(this.ensureLocalDatabase());
  }

  public async getLocalRows(options?: {
    createIfMissing?: boolean;
  }): Promise<Table<StoredLocalRow, string> | undefined> {
    const database = await this.getLocalDatabase(options);
    return database?.rows;
  }

  public async deleteLocalDatabase(): Promise<void> {
    if (!this.localDatabase && this.localDatabaseState === "absent") {
      return;
    }

    const database = this.localDatabase ?? createLocalRowsDatabase(this.listId);

    this.localDatabase = undefined;
    this.localDatabaseState = "absent";
    database.db.close();
    await database.db.delete();
  }

  public async deleteAllDatabases(): Promise<void> {
    await Promise.all([
      this.deleteRemoteDatabases(),
      this.deleteLocalDatabase(),
    ]);
  }

  public closeAll(): void {
    for (const database of Object.values(this.remoteDatabaseByInstance)) {
      if (database) {
        database.db.close();
      }
    }

    this.localDatabase?.db.close();
  }
}
