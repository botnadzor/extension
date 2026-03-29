import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AuthInput, authInputSchema } from "@/shared/@model/auth";
import { rootConfigSeed } from "@/shared/@model/root-config";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

import { AliasManager } from "../@service-helpers/alias-manager";

const authInputStorageKey = "sync:auth-input";
const authStateStorageKey = "local:auth-state-cache";

const { loggerMock, orpcState, storageState } = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const getValueImplementationByName = new Map<
    string,
    () => Promise<unknown>
  >();
  const watchers = new Map<string, Set<(value: unknown) => void>>();

  class MockOrpcErrorRemoteSystemUnavailable extends Error {
    reason: string;

    constructor(message: string, reason: string) {
      super(message);
      this.reason = reason;
    }
  }

  return {
    loggerMock: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    orpcState: {
      OrpcErrorRemoteSystemUnavailable: MockOrpcErrorRemoteSystemUnavailable,
      getMe: vi.fn(),
    },
    storageState: { getValueImplementationByName, values, watchers },
  };
});

vi.mock("@/shared/@logging/categories", () => ({
  getBackgroundLogger: () => loggerMock,
}));

vi.mock("../@service-helpers/orpc", () => ({
  orpcClient: {
    getMe: orpcState.getMe,
  },
  OrpcErrorRemoteSystemUnavailable: orpcState.OrpcErrorRemoteSystemUnavailable,
}));

vi.mock("../@service-helpers/store-with-schema", () => ({
  defineStoreWithSchema: (name: string) => ({
    getValue: () =>
      storageState.getValueImplementationByName.get(name)?.() ??
      Promise.resolve(storageState.values.get(name)),
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

const { AuthService } = await import("./auth-service");

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}

function createAuthInput({
  accessCode = "demo-code",
  accessCodeEnteredAt = "2026-03-28T12:00:00Z",
}: {
  accessCode?: string;
  accessCodeEnteredAt?: string;
} = {}): AuthInput {
  return authInputSchema.parse({
    accessCode,
    accessCodeEnteredAt,
  });
}

function createValidAuthStatus({
  accessLevel = 2,
  expiresAt,
  permissionLookup = { inspectAccount: true },
  pointCount = 123,
}: {
  accessLevel?: number;
  expiresAt?: string;
  permissionLookup?: Record<string, true>;
  pointCount?: number;
} = {}) {
  return {
    state: "valid" as const,
    accessLevel,
    ...(expiresAt ? { expiresAt: isoDateTimeSchema.parse(expiresAt) } : {}),
    permissionLookup,
    pointCount,
  };
}

function createInvalidAuthStatus(
  authInput: AuthInput,
  {
    accessCodeRecognized = false,
    errorMessage = "Invalid access code",
  }: {
    accessCodeRecognized?: boolean;
    errorMessage?: string;
  } = {},
) {
  return {
    state: "invalid" as const,
    accessCode: authInput.accessCode,
    accessCodeEnteredAt: authInput.accessCodeEnteredAt,
    accessCodeRecognized,
    errorMessage,
  };
}

function createPersistedAuthState({
  authInput,
  authStatus,
  checkedAt,
}: {
  authInput: AuthInput;
  authStatus:
    | ReturnType<typeof createValidAuthStatus>
    | ReturnType<typeof createInvalidAuthStatus>;
  checkedAt: string;
}) {
  return {
    authInput,
    authStatus,
    checkedAt: isoDateTimeSchema.parse(checkedAt),
  };
}

function queueGetMeSuccess(
  body: ReturnType<typeof createValidAuthStatus> | Record<string, unknown>,
) {
  orpcState.getMe.mockResolvedValueOnce([undefined, { body }]);
}

function queueDeferredGetMeSuccess(
  body: ReturnType<typeof createValidAuthStatus> | Record<string, unknown>,
) {
  const deferred = createDeferred<
    [
      undefined,
      {
        body:
          | ReturnType<typeof createValidAuthStatus>
          | Record<string, unknown>;
      },
    ]
  >();

  orpcState.getMe.mockReturnValueOnce(deferred.promise);

  return {
    resolve: () => {
      deferred.resolve([undefined, { body }]);
    },
  };
}

function queueGetMeUnknown() {
  orpcState.getMe.mockResolvedValueOnce([
    new orpcState.OrpcErrorRemoteSystemUnavailable(
      "Unavailable",
      "connectionFailed",
    ),
    undefined,
  ]);
}

const createdServices: Array<InstanceType<typeof AuthService>> = [];

function createService() {
  const service = new AuthService({
    aliasManagerForDynamicApi: new AliasManager(
      "dynamicApi",
      rootConfigSeed.remoteSystemLookup.dynamicApi.aliasLookup,
    ),
  });

  createdServices.push(service);
  return service;
}

async function settleInitialization(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));

  loggerMock.debug.mockReset();
  loggerMock.error.mockReset();
  loggerMock.info.mockReset();
  loggerMock.warn.mockReset();
  orpcState.getMe.mockReset();
  storageState.values.clear();
  storageState.getValueImplementationByName.clear();
  storageState.watchers.clear();
  createdServices.length = 0;
});

afterEach(async () => {
  for (const service of createdServices) {
    service[Symbol.dispose]();
  }

  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
});

describe("AuthService", () => {
  it("hydrates a fresh cached valid auth state and skips automatic get-me", async () => {
    const authInput = createAuthInput();
    const authStatus = createValidAuthStatus({
      expiresAt: "2026-03-28T12:30:00Z",
    });

    storageState.values.set(authInputStorageKey, authInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput,
        authStatus,
        checkedAt: "2026-03-28T11:58:00Z",
      }),
    );

    const service = createService();
    await settleInitialization();

    expect(service.getAuthStatus()).toEqual(authStatus);
    expect(orpcState.getMe).not.toHaveBeenCalled();
  });

  it("hydrates a fresh cached invalid auth state and skips automatic get-me", async () => {
    const authInput = createAuthInput();
    const authStatus = createInvalidAuthStatus(authInput, {
      accessCodeRecognized: true,
    });

    storageState.values.set(authInputStorageKey, authInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput,
        authStatus,
        checkedAt: "2026-03-28T11:58:00Z",
      }),
    );

    const service = createService();
    await settleInitialization();

    expect(service.getAuthStatus()).toEqual(authStatus);
    expect(orpcState.getMe).not.toHaveBeenCalled();
  });

  it("ignores cached auth state when access code text differs", async () => {
    const currentAuthInput = createAuthInput({ accessCode: "new-code" });
    const cachedAuthInput = createAuthInput({ accessCode: "old-code" });
    const fetchedAuthStatus = createValidAuthStatus();

    storageState.values.set(authInputStorageKey, currentAuthInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput: cachedAuthInput,
        authStatus: createValidAuthStatus(),
        checkedAt: "2026-03-28T11:58:00Z",
      }),
    );
    queueGetMeSuccess(fetchedAuthStatus);

    const service = createService();
    await settleInitialization();

    expect(orpcState.getMe).toHaveBeenCalledTimes(1);
    expect(service.getAuthStatus()).toEqual(fetchedAuthStatus);
  });

  it("ignores cached auth state when accessCodeEnteredAt differs", async () => {
    const currentAuthInput = createAuthInput({
      accessCodeEnteredAt: "2026-03-28T12:00:00Z",
    });
    const cachedAuthInput = createAuthInput({
      accessCodeEnteredAt: "2026-03-28T11:59:00Z",
    });
    const fetchedAuthStatus = createValidAuthStatus();

    storageState.values.set(authInputStorageKey, currentAuthInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput: cachedAuthInput,
        authStatus: createValidAuthStatus(),
        checkedAt: "2026-03-28T11:58:00Z",
      }),
    );
    queueGetMeSuccess(fetchedAuthStatus);

    const service = createService();
    await settleInitialization();

    expect(orpcState.getMe).toHaveBeenCalledTimes(1);
    expect(service.getAuthStatus()).toEqual(fetchedAuthStatus);
  });

  it("ignores cached valid auth state when expiresAt has passed", async () => {
    const authInput = createAuthInput();
    const fetchedAuthStatus = createValidAuthStatus({
      expiresAt: "2026-03-28T13:00:00Z",
    });

    storageState.values.set(authInputStorageKey, authInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput,
        authStatus: createValidAuthStatus({
          expiresAt: "2026-03-28T11:59:00Z",
        }),
        checkedAt: "2026-03-28T11:58:00Z",
      }),
    );
    queueGetMeSuccess(fetchedAuthStatus);

    const service = createService();
    await settleInitialization();

    expect(orpcState.getMe).toHaveBeenCalledTimes(1);
    expect(service.getAuthStatus()).toEqual(fetchedAuthStatus);
  });

  it("rechecks automatically when the cached auth state is stale", async () => {
    const authInput = createAuthInput();
    const fetchedAuthStatus = createValidAuthStatus();

    storageState.values.set(authInputStorageKey, authInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput,
        authStatus: createValidAuthStatus(),
        checkedAt: "2026-03-28T11:54:59Z",
      }),
    );
    queueGetMeSuccess(fetchedAuthStatus);

    const service = createService();
    await settleInitialization();

    expect(orpcState.getMe).toHaveBeenCalledTimes(1);
    expect(service.getAuthStatus()).toEqual(fetchedAuthStatus);
  });

  it("always bypasses the cache for manual refresh", async () => {
    const authInput = createAuthInput();
    const cachedAuthStatus = createValidAuthStatus({
      pointCount: 1,
      expiresAt: "2026-03-28T13:00:00Z",
    });
    const refreshedAuthStatus = createValidAuthStatus({
      pointCount: 2,
      expiresAt: "2026-03-28T13:00:00Z",
    });

    storageState.values.set(authInputStorageKey, authInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput,
        authStatus: cachedAuthStatus,
        checkedAt: "2026-03-28T11:58:00Z",
      }),
    );

    const service = createService();
    await settleInitialization();
    expect(orpcState.getMe).not.toHaveBeenCalled();

    queueGetMeSuccess(refreshedAuthStatus);

    const checkPromise = service.checkAuth();
    await vi.advanceTimersByTimeAsync(0);
    expect(orpcState.getMe).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    await checkPromise;

    expect(service.getAuthStatus()).toEqual(refreshedAuthStatus);
  });

  it("does not persist unknown auth state", async () => {
    const authInput = createAuthInput();

    storageState.values.set(authInputStorageKey, authInput);
    queueGetMeUnknown();

    const service = createService();
    await settleInitialization();

    expect(service.getAuthStatus()).toEqual({
      state: "unknown",
      ...authInput,
    });
    expect(storageState.values.has(authStateStorageKey)).toBe(false);
  });

  it("does not persist empty auth state", async () => {
    storageState.values.set(
      authInputStorageKey,
      createAuthInput({ accessCode: "" }),
    );

    const service = createService();
    await settleInitialization();

    expect(service.getAuthStatus()).toEqual({
      state: "empty",
      accessCode: "",
      accessCodeEnteredAt: "2026-03-28T12:00:00Z",
    });
    expect(storageState.values.has(authStateStorageKey)).toBe(false);
  });

  it("keeps the last persisted auth state when refresh returns unknown", async () => {
    const authInput = createAuthInput();
    const persistedAuthState = createPersistedAuthState({
      authInput,
      authStatus: createValidAuthStatus({
        expiresAt: "2026-03-28T13:00:00Z",
        pointCount: 10,
      }),
      checkedAt: "2026-03-28T11:58:00Z",
    });

    storageState.values.set(authInputStorageKey, authInput);
    storageState.values.set(authStateStorageKey, persistedAuthState);

    const service = createService();
    await settleInitialization();

    queueGetMeUnknown();
    const checkPromise = service.checkAuth();
    await vi.advanceTimersByTimeAsync(500);
    await checkPromise;

    expect(service.getAuthStatus()).toEqual({
      state: "unknown",
      ...authInput,
    });
    expect(storageState.values.get(authStateStorageKey)).toEqual(
      persistedAuthState,
    );
  });

  it("does not recheck twice when access code changes before initialization completes", async () => {
    const authInput = createAuthInput();
    const authStateLoadDeferred = createDeferred<unknown>();
    const fetchedAuthStatus = createValidAuthStatus({
      expiresAt: "2026-03-28T13:00:00Z",
      pointCount: 999,
    });

    storageState.values.set(authInputStorageKey, authInput);
    storageState.getValueImplementationByName.set(
      authStateStorageKey,
      () => authStateLoadDeferred.promise,
    );

    const service = createService();
    await vi.advanceTimersByTimeAsync(0);

    service.setAccessCode(authInput.accessCode);
    queueGetMeSuccess(fetchedAuthStatus);

    authStateLoadDeferred.resolve(undefined);
    storageState.getValueImplementationByName.delete(authStateStorageKey);

    await settleInitialization();
    await settleInitialization();

    expect(orpcState.getMe).toHaveBeenCalledTimes(1);
    expect(service.getAuthStatus()).toEqual(fetchedAuthStatus);
  });

  it("rechecks changed auth input without waiting for the visible-duration delay", async () => {
    const initialAuthInput = createAuthInput();
    const refreshedAuthStatus = createValidAuthStatus({
      expiresAt: "2026-03-28T13:00:00Z",
      pointCount: 111,
    });
    const oldRequest = queueDeferredGetMeSuccess(
      createValidAuthStatus({
        expiresAt: "2026-03-28T13:00:00Z",
        pointCount: 10,
      }),
    );

    storageState.values.set(authInputStorageKey, initialAuthInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput: initialAuthInput,
        authStatus: createValidAuthStatus({
          expiresAt: "2026-03-28T13:00:00Z",
          pointCount: 10,
        }),
        checkedAt: "2026-03-28T11:54:59Z",
      }),
    );

    const service = createService();
    await vi.advanceTimersByTimeAsync(0);

    service.setAccessCode("new-code");
    queueGetMeSuccess(refreshedAuthStatus);

    oldRequest.resolve();
    await settleInitialization();

    expect(orpcState.getMe).toHaveBeenCalledTimes(2);

    await settleInitialization();

    expect(service.getAuthStatus()).toEqual(refreshedAuthStatus);
  });

  it("clears the persisted auth cache when access code changes", async () => {
    const initialAuthInput = createAuthInput();
    const newCheckedAt = "2026-03-28T12:00:00Z";

    storageState.values.set(authInputStorageKey, initialAuthInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput: initialAuthInput,
        authStatus: createValidAuthStatus({
          expiresAt: "2026-03-28T13:00:00Z",
        }),
        checkedAt: "2026-03-28T11:58:00Z",
      }),
    );

    const service = createService();
    await settleInitialization();

    queueGetMeSuccess(createValidAuthStatus({ pointCount: 999 }));

    service.setAccessCode("new-code");
    await settleInitialization();
    await vi.advanceTimersByTimeAsync(1000);

    expect(orpcState.getMe).toHaveBeenCalledTimes(1);
    expect(storageState.values.get(authInputStorageKey)).toEqual(
      createAuthInput({
        accessCode: "new-code",
        accessCodeEnteredAt: newCheckedAt,
      }),
    );

    expect(storageState.values.get(authStateStorageKey)).toEqual(
      createPersistedAuthState({
        authInput: createAuthInput({
          accessCode: "new-code",
          accessCodeEnteredAt: newCheckedAt,
        }),
        authStatus: createValidAuthStatus({ pointCount: 999 }),
        checkedAt: newCheckedAt,
      }),
    );
  });

  it("persists valid auth patches without refreshing checkedAt", async () => {
    const authInput = createAuthInput();
    const checkedAt = "2026-03-28T11:58:00Z";

    storageState.values.set(authInputStorageKey, authInput);
    storageState.values.set(
      authStateStorageKey,
      createPersistedAuthState({
        authInput,
        authStatus: createValidAuthStatus({
          pointCount: 10,
          expiresAt: "2026-03-28T13:00:00Z",
          permissionLookup: { inspectAccount: true },
        }),
        checkedAt,
      }),
    );

    const service = createService();
    await settleInitialization();

    service.patchPointCount(20);
    service.patchPermissionLookup({
      inspectAccount: true,
      reportAccount: true,
    });
    await settleInitialization();

    expect(storageState.values.get(authStateStorageKey)).toEqual(
      createPersistedAuthState({
        authInput,
        authStatus: createValidAuthStatus({
          pointCount: 20,
          expiresAt: "2026-03-28T13:00:00Z",
          permissionLookup: {
            inspectAccount: true,
            reportAccount: true,
          },
        }),
        checkedAt,
      }),
    );
  });
});
