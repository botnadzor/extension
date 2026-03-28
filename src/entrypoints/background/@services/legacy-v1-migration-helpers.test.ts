import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthInput } from "@/shared/@model/auth";
import { defaultUserConfig } from "@/shared/@model/user-config";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";
import { browser } from "#imports";

import {
  cleanupLegacyV1State,
  legacyLocalStorageKeys,
  migrateAuthInputFromLegacyTokenState,
  migrateUserConfigFromLegacyState,
  parseLegacyUserSettings,
} from "./legacy-v1-migration-helpers";

const { indexedDbMock, loggerMock, testState } = vi.hoisted(() => {
  const hoistedState = {
    indexedDbNames: new Set<string>(),
  };

  const hoistedLoggerMock = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };

  class MockOpenDbRequest extends EventTarget implements IDBOpenDBRequest {
    // eslint-disable-next-line unicorn/no-null -- IndexedDB request handler fields use null when absent in DOM typings.
    error: DOMException | null = null;
    onblocked:
      | ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown)
      // eslint-disable-next-line unicorn/no-null -- IndexedDB request handler fields use null when absent in DOM typings.
      | null = null;
    onerror: ((this: IDBRequest<IDBDatabase>, ev: Event) => unknown) | null =
      // eslint-disable-next-line unicorn/no-null -- IndexedDB request handler fields use null when absent in DOM typings.
      null;
    onsuccess: ((this: IDBRequest<IDBDatabase>, ev: Event) => unknown) | null =
      // eslint-disable-next-line unicorn/no-null -- IndexedDB request handler fields use null when absent in DOM typings.
      null;
    onupgradeneeded:
      | ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown)
      // eslint-disable-next-line unicorn/no-null -- IndexedDB request handler fields use null when absent in DOM typings.
      | null = null;
    readyState: IDBRequestReadyState = "done";

    get result(): IDBDatabase {
      throw new Error("MockOpenDbRequest.result should not be accessed");
    }

    get source(): IDBObjectStore | IDBIndex | IDBCursor {
      throw new Error("MockOpenDbRequest.source should not be accessed");
    }

    get transaction(): IDBTransaction {
      throw new Error("MockOpenDbRequest.transaction should not be accessed");
    }
  }

  const hoistedIndexedDbMock = {
    databases: vi.fn(() =>
      Promise.resolve(
        [...hoistedState.indexedDbNames].map((name) => ({
          name,
        })),
      ),
    ),
    deleteDatabase: vi.fn((databaseName: string) => {
      const request = new MockOpenDbRequest();

      queueMicrotask(() => {
        hoistedState.indexedDbNames.delete(databaseName);

        request.dispatchEvent(new Event("success"));
      });

      return request;
    }),
  };

  return {
    indexedDbMock: hoistedIndexedDbMock,
    loggerMock: hoistedLoggerMock,
    testState: hoistedState,
  };
});

vi.mock("@/shared/@logging/categories", () => ({
  getBackgroundLogger: () => loggerMock,
}));

// cspell:ignore gosvon

beforeEach(async () => {
  testState.indexedDbNames.clear();

  loggerMock.debug.mockReset();
  loggerMock.info.mockReset();
  loggerMock.warn.mockReset();
  indexedDbMock.databases.mockClear();
  indexedDbMock.deleteDatabase.mockClear();

  await browser.alarms.clear("10 minutes");
  await browser.alarms.clear("weekly");
  await browser.storage.local.remove([...legacyLocalStorageKeys]);

  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: indexedDbMock,
    writable: true,
  });
});

function authInput(accessCode: string): AuthInput {
  return {
    accessCode,
    accessCodeEnteredAt: isoDateTimeSchema.parse("2024-01-01T00:00:00Z"),
  };
}

describe("migrateAuthInputFromLegacyTokenState", () => {
  it("should migrate legacy access code into v2 auth input", () => {
    const result = migrateAuthInputFromLegacyTokenState({
      legacyTokenState: {
        userToken: "  legacy-access-code  ",
      },
      migratedAt: isoDateTimeSchema.parse("2024-02-01T00:00:00Z"),
    });

    expect(result).toEqual({
      accessCode: "legacy-access-code",
      accessCodeEnteredAt: isoDateTimeSchema.parse("2024-02-01T00:00:00Z"),
    });
  });

  it("should skip empty legacy access code", () => {
    const result = migrateAuthInputFromLegacyTokenState({
      legacyTokenState: {
        userToken: "   ",
      },
      migratedAt: authInput("").accessCodeEnteredAt,
    });

    expect(result).toBeUndefined();
  });
});

describe("migrateUserConfigFromLegacyState", () => {
  it("should migrate hidden tags, colors and flags", () => {
    const result = migrateUserConfigFromLegacyState({
      legacyConfig: {
        types: [{ id: 1 }, { id: 2 }],
      },
      legacyUserSettings: {
        disabledTypesIds: [1, 999],
        customTypesColors: {
          1: "not-a-color",
          2: " #ABCDEF ",
          3: "#123456",
          abc: "#654321",
        },
        isRepliesCollectingEnabled: true,
        isFansTableView: true,
      },
    });

    expect(result).toEqual({
      tagOverrideLookup: {
        1: {
          hidden: true,
        },
        2: {
          colorForHighlight: "#abcdef",
        },
      },
      fansDisplay: "table",
      collectingComments: true,
    });
  });

  it("should return undefined for legacy state equal to v2 defaults", () => {
    const result = migrateUserConfigFromLegacyState({
      legacyConfig: undefined,
      legacyUserSettings: {
        isFansTableView: false,
        isRepliesCollectingEnabled: false,
      },
    });

    expect(result).toEqual(undefined);
    expect(defaultUserConfig).toEqual({
      tagOverrideLookup: {},
      fansDisplay: "default",
    });
  });

  it("should tolerate string ids in disabledTypesIds", () => {
    const legacyUserSettings = parseLegacyUserSettings({
      disabledTypesIds: ["1", 2, "oops"],
      customTypesColors: {
        1: "#123456",
      },
      isRepliesCollectingEnabled: true,
    });

    const result = migrateUserConfigFromLegacyState({
      legacyConfig: {
        types: [{ id: 1 }, { id: 2 }],
      },
      legacyUserSettings,
    });

    expect(result).toEqual({
      tagOverrideLookup: {
        1: {
          colorForHighlight: "#123456",
          hidden: true,
        },
        2: {
          hidden: true,
        },
      },
      fansDisplay: "default",
      collectingComments: true,
    });
  });
});

describe("cleanupLegacyV1State", () => {
  it("should log info when at least one legacy artifact was removed", async () => {
    await browser.storage.local.set({
      config: { legacy: true },
    });
    await browser.alarms.create("weekly", {
      delayInMinutes: 1,
    });
    testState.indexedDbNames.add("gosvon");

    await cleanupLegacyV1State();

    expect(loggerMock.info).toHaveBeenCalledWith("Legacy v1 cleanup completed");
    expect(loggerMock.debug).not.toHaveBeenCalled();
    expect(loggerMock.warn).not.toHaveBeenCalled();

    const remainingLegacyState = await browser.storage.local.get("config");
    expect(remainingLegacyState["config"]).toBeUndefined();
    expect(await browser.alarms.get("weekly")).toBeUndefined();
    expect(testState.indexedDbNames.has("gosvon")).toBe(false);
  });

  it("should log debug when no legacy cleanup was needed", async () => {
    await cleanupLegacyV1State();

    expect(loggerMock.debug).toHaveBeenCalledWith(
      "Legacy v1 cleanup was not needed",
    );
    expect(loggerMock.info).not.toHaveBeenCalled();
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });

  it("should warn when cleanup leaves legacy artifacts behind", async () => {
    await browser.storage.local.set({
      config: { legacy: true },
    });

    const removeLocalStorageValuesSpy = vi
      .spyOn(browser.storage.local, "remove")
      .mockImplementation(() => undefined);

    await cleanupLegacyV1State();
    removeLocalStorageValuesSpy.mockRestore();

    expect(loggerMock.warn).toHaveBeenCalledWith(
      "Legacy v1 cleanup remains incomplete (localStorageRemoved={localStorageRemoved}, alarmsCleared={alarmsCleared}, indexedDbDeleted={indexedDbDeleted})",
      {
        alarmsCleared: true,
        indexedDbDeleted: true,
        localStorageRemoved: false,
      },
    );
    expect(loggerMock.debug).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalled();
  });
});
