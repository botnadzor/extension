import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RootConfig,
  rootConfigSchema,
  rootConfigSeed,
} from "@/shared/@model/root-config";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

import { AliasManager } from "../@service-helpers/alias-manager";

const rootConfigStorageKey = "local:root-config-cache";

const { fetchFromRemoteSystemMock, loggerMock, storageState } = vi.hoisted(
  () => {
    const values = new Map<string, unknown>();
    const watchers = new Map<string, Set<(value: unknown) => void>>();

    return {
      fetchFromRemoteSystemMock: vi.fn(),
      loggerMock: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      storageState: { values, watchers },
    };
  },
);

vi.mock("@/shared/@logging/categories", () => ({
  getBackgroundLogger: () => loggerMock,
}));

vi.mock("../@service-helpers/fetch-from-remote-system", () => ({
  fetchFromRemoteSystem: fetchFromRemoteSystemMock,
}));

vi.mock("../@service-helpers/store-with-schema", () => ({
  defineStoreWithSchema: (name: string) => ({
    getValue: () => Promise.resolve(storageState.values.get(name)),
    setValue: (value: unknown) => {
      storageState.values.set(name, value);

      for (const callback of storageState.watchers.get(name) ?? []) {
        callback(value);
      }

      return Promise.resolve();
    },
    clearValue: () => {
      storageState.values.delete(name);

      for (const callback of storageState.watchers.get(name) ?? []) {
        callback(undefined);
      }

      return Promise.resolve();
    },
    watch: (callback: (value: unknown) => void) => {
      const callbacks = storageState.watchers.get(name) ?? new Set();
      callbacks.add(callback);
      storageState.watchers.set(name, callbacks);

      return () => {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          storageState.watchers.delete(name);
        }
      };
    },
  }),
}));

const { RootConfigService } = await import("./root-config-service");

function createRootConfig({
  extensionVersionRange = "*",
  generatedAt = "2026-03-28T12:00:00Z",
}: {
  extensionVersionRange?: string;
  generatedAt?: string;
} = {}): RootConfig {
  const rootConfigSeedClone = structuredClone(rootConfigSeed);

  return rootConfigSchema.parse({
    ...rootConfigSeedClone,
    extensionVersionRange,
    generatedAt,
    remoteSystemLookup: {
      ...rootConfigSeedClone.remoteSystemLookup,
      staticApi: {
        ...rootConfigSeedClone.remoteSystemLookup.staticApi,
        listLookup: Object.fromEntries(
          Object.entries(
            rootConfigSeedClone.remoteSystemLookup.staticApi.listLookup,
          ).map(([listId, listInfo]) => [
            listId,
            {
              ...listInfo,
              generatedAt,
            },
          ]),
        ),
      },
    },
  });
}

function createPersistedRootConfigState(
  rootConfig: RootConfig,
  fetchedAt: string,
) {
  return {
    rootConfig,
    fetchedAt: isoDateTimeSchema.parse(fetchedAt),
  };
}

function createSuccessfulFetchResult(json: unknown) {
  return {
    success: true as const,
    response: Response.json(json),
  };
}

function createService() {
  return new RootConfigService({
    aliasManagerForStaticApi: new AliasManager(
      "staticApi",
      rootConfigSeed.remoteSystemLookup.staticApi.aliasLookup,
    ),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));

  fetchFromRemoteSystemMock.mockReset();
  loggerMock.debug.mockReset();
  loggerMock.error.mockReset();
  loggerMock.info.mockReset();
  loggerMock.warn.mockReset();

  storageState.values.clear();
  storageState.watchers.clear();
});

afterEach(async () => {
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
});

describe("RootConfigService", () => {
  it("hydrates a fresh cached root config and skips refetching", async () => {
    const cachedRootConfig = createRootConfig({
      extensionVersionRange: ">=2.0.0",
      generatedAt: "2026-03-28T11:55:00Z",
    });

    storageState.values.set(
      rootConfigStorageKey,
      createPersistedRootConfigState(cachedRootConfig, "2026-03-28T11:58:00Z"),
    );

    const service = createService();

    await expect(service.get()).resolves.toEqual(cachedRootConfig);
    await expect(service.getExtensionVersionRange()).resolves.toBe(">=2.0.0");
    expect(fetchFromRemoteSystemMock).not.toHaveBeenCalled();
  });

  it("fetches and persists the root config when no cache exists", async () => {
    const fetchedRootConfig = createRootConfig({
      extensionVersionRange: "<3.0.0",
    });

    fetchFromRemoteSystemMock.mockResolvedValue(
      createSuccessfulFetchResult(fetchedRootConfig),
    );

    const service = createService();

    await expect(service.get()).resolves.toEqual(fetchedRootConfig);
    await expect(service.getExtensionVersionRange()).resolves.toBe("<3.0.0");

    expect(fetchFromRemoteSystemMock).toHaveBeenCalledTimes(1);
    expect(storageState.values.get(rootConfigStorageKey)).toEqual(
      createPersistedRootConfigState(fetchedRootConfig, "2026-03-28T12:00:00Z"),
    );
  });

  it("serves stale cached config while a refresh is still in flight", async () => {
    const cachedRootConfig = createRootConfig({
      extensionVersionRange: ">=1.0.0",
      generatedAt: "2026-03-28T10:30:00Z",
    });
    const refreshedRootConfig = createRootConfig({
      extensionVersionRange: ">=4.0.0",
      generatedAt: "2026-03-28T12:00:00Z",
    });

    storageState.values.set(
      rootConfigStorageKey,
      createPersistedRootConfigState(cachedRootConfig, "2026-03-28T10:30:00Z"),
    );

    const deferredFetch =
      Promise.withResolvers<ReturnType<typeof createSuccessfulFetchResult>>();

    fetchFromRemoteSystemMock.mockReturnValue(deferredFetch.promise);

    const service = createService();
    const pollPromise = service.poll(undefined);

    await vi.advanceTimersByTimeAsync(2000);

    await expect(pollPromise).resolves.toMatchObject({
      value: cachedRootConfig,
    });
    expect(fetchFromRemoteSystemMock).toHaveBeenCalledTimes(1);

    deferredFetch.resolve(createSuccessfulFetchResult(refreshedRootConfig));
    await Promise.resolve();

    await expect(service.get()).resolves.toEqual(refreshedRootConfig);
  });

  it("keeps stale cached state after failed refreshes and retries again after reload", async () => {
    const cachedRootConfig = createRootConfig({
      extensionVersionRange: ">=1.0.0",
      generatedAt: "2026-03-28T10:30:00Z",
    });
    const persistedState = createPersistedRootConfigState(
      cachedRootConfig,
      "2026-03-28T10:30:00Z",
    );

    storageState.values.set(rootConfigStorageKey, persistedState);

    fetchFromRemoteSystemMock.mockResolvedValue({
      success: false as const,
      reason: "connectionFailed" as const,
    });

    const service = createService();
    const firstPollPromise = service.poll(undefined);

    await vi.advanceTimersByTimeAsync(2000);

    await expect(firstPollPromise).resolves.toMatchObject({
      value: cachedRootConfig,
    });

    await vi.advanceTimersByTimeAsync(20_000);

    expect(fetchFromRemoteSystemMock).toHaveBeenCalledTimes(3);
    expect(storageState.values.get(rootConfigStorageKey)).toEqual(
      persistedState,
    );

    const reloadedService = createService();
    const secondPollPromise = reloadedService.poll(undefined);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFromRemoteSystemMock).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(2000);

    await expect(secondPollPromise).resolves.toMatchObject({
      value: cachedRootConfig,
    });

    // Flush the remaining retry delays (10s × 2) from the still-running
    // doUpdateIfNeeded loop so they don't leak into the next test.
    await vi.advanceTimersByTimeAsync(20_000);
  });

  it("updates only extension version range for incompatible refreshes", async () => {
    const cachedRootConfig = createRootConfig({
      extensionVersionRange: ">=1.0.0",
      generatedAt: "2026-03-28T10:30:00Z",
    });
    const persistedState = createPersistedRootConfigState(
      cachedRootConfig,
      "2026-03-28T10:30:00Z",
    );

    storageState.values.set(rootConfigStorageKey, persistedState);

    fetchFromRemoteSystemMock.mockResolvedValue(
      createSuccessfulFetchResult({
        extensionVersionRange: "<5.0.0",
      }),
    );

    const service = createService();

    await expect(service.get()).resolves.toEqual(cachedRootConfig);
    await expect(service.getExtensionVersionRange()).resolves.toBe("<5.0.0");

    expect(storageState.values.get(rootConfigStorageKey)).toEqual(
      persistedState,
    );
  });
});
