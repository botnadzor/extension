import { delay } from "es-toolkit";
import { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/@logging/categories";
import {
  type AuthCheck,
  type AuthInput,
  authInputSchema,
  type AuthStatus,
  type PermissionLookup,
  permissionLookupSchema,
} from "@/shared/@model/auth";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";
import { omitUndefined } from "@/shared/omit-undefined";

import type { AliasManager } from "../@service-helpers/alias-manager";
import type {
  ContractProblem,
  DynamicApiEndpointInput,
  DynamicApiEndpointKey,
  DynamicApiEndpointOutcome,
  DynamicApiEndpointOutput,
  RemoteSystemUnavailableProblem,
} from "../@service-helpers/dynamic-api-endpoints";
import {
  orpcClient,
  OrpcErrorRemoteSystemUnavailable,
} from "../@service-helpers/orpc";
import { defineStoreWithSchema } from "../@service-helpers/store-with-schema";
import { migrateAuthInputFromV1 } from "./legacy-v1-migration-helpers";

const logger = getBackgroundLogger(["auth-service"]);

// TODO: Remove `migrateDataFromV1` after the v1 -> v2 upgrade window closes.
const authInputStore = defineStoreWithSchema(
  "sync:auth-input",
  authInputSchema,
  { migrateDataFromV1: migrateAuthInputFromV1 },
);

const minRefetchIntervalAfterAuthCheckInMs = 5 * 60 * 1000;

const defaultAuthInput: AuthInput = {
  accessCode: "",
  accessCodeEnteredAt: isoDateTimeSchema.parse(new Date(0)),
};

const persistedValidAuthStatusSchema = z.readonly(
  z.object({
    state: z.literal("valid"),
    accessLevel: z.number(),
    expiresAt: z.exactOptional(isoDateTimeSchema),
    pointCount: z.number(),
    permissionLookup: permissionLookupSchema,
  }),
);

const persistedInvalidAuthStatusSchema = z.readonly(
  z.object({
    state: z.literal("invalid"),
    accessCode: z.string(),
    accessCodeEnteredAt: isoDateTimeSchema,
    accessCodeRecognized: z.boolean(),
    errorMessage: z.string(),
  }),
);

const persistedAuthStatusSchema = z.union([
  persistedInvalidAuthStatusSchema,
  persistedValidAuthStatusSchema,
]);

const persistedAuthStateSchema = z.readonly(
  z.object({
    authInput: authInputSchema,
    authStatus: persistedAuthStatusSchema,
    checkedAt: isoDateTimeSchema,
  }),
);

type PersistedAuthStatus = z.infer<typeof persistedAuthStatusSchema>;
type PersistedAuthState = z.infer<typeof persistedAuthStateSchema>;

const authStateStore = defineStoreWithSchema(
  "local:auth-state-cache",
  persistedAuthStateSchema,
);

function isSameAuthInput(left: AuthInput, right: AuthInput): boolean {
  return (
    left.accessCode === right.accessCode &&
    left.accessCodeEnteredAt === right.accessCodeEnteredAt
  );
}

function isProblemOutcome(
  value: unknown,
): value is { problem: true; type: string; description: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "problem" in value &&
    value.problem === true &&
    "type" in value &&
    typeof value.type === "string" &&
    "description" in value &&
    typeof value.description === "string"
  );
}

function hasBody(value: unknown): value is { body: unknown } {
  return typeof value === "object" && value !== null && "body" in value;
}

export class AuthService {
  private readonly aliasManagerForDynamicApi: AliasManager;
  private disposed = false;
  private initialized = false;

  private pollableAuthInput: Pollable<AuthInput | undefined>;
  private pollableAuthStatus: Pollable<AuthStatus>;
  private pollableAuthCheck: Pollable<AuthCheck>;
  private persistedAuthState: PersistedAuthState | undefined;

  private readonly initializePromise: Promise<void>;
  private readonly storeWriteThrottleInMs = 1000;

  constructor({
    aliasManagerForDynamicApi,
  }: {
    aliasManagerForDynamicApi: AliasManager;
  }) {
    this.aliasManagerForDynamicApi = aliasManagerForDynamicApi;

    this.pollableAuthInput = new Pollable<AuthInput | undefined>(undefined);
    this.pollableAuthStatus = new Pollable<AuthStatus>({ state: "unknown" });
    this.pollableAuthCheck = new Pollable<AuthCheck>({ state: "idle" });

    void this.startSyncingAuthInputWithStore();
    this.initializePromise = this.initialize();
  }

  [Symbol.dispose](): void {
    this.disposed = true;
  }

  private async startSyncingAuthInputWithStore() {
    this.pollableAuthInput.setValue(
      (await authInputStore.getValue()) ?? defaultAuthInput,
    );

    let result = await this.pollAuthInput(undefined);

    while (!this.disposed) {
      await delay(this.storeWriteThrottleInMs);
      result = await this.pollAuthInput(result.version);
      await authInputStore.setValue(result.value);
      logger.debug("Wrote auth input to store");
    }
  }

  async pollAuthInput(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<AuthInput>> {
    let result: PollResult<AuthInput> | PollResult<undefined> | undefined;
    do {
      result = await this.pollableAuthInput.poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);
    return result;
  }

  private async getAuthInput(): Promise<AuthInput> {
    const result = await this.pollAuthInput(undefined);
    return result.value;
  }

  private async initialize(): Promise<void> {
    await this.waitUntilAuthInputReady();

    const authInput = await this.getAuthInput();
    await this.hydratePersistedAuthState(authInput);

    if (this.shouldReusePersistedAuthState(authInput)) {
      const persistedAuthState = this.persistedAuthState;
      if (persistedAuthState) {
        this.pollableAuthStatus.setValue(persistedAuthState.authStatus);
        logger.debug("Hydrated auth state from cache: {authStatus}", {
          authStatus: persistedAuthState.authStatus,
        });
      }
      this.initialized = true;
      return;
    }

    await this.checkAuthAfterInitialization({ force: false });
    this.initialized = true;
  }

  // TODO: Remove this method after the v1 -> v2 upgrade window closes.
  async waitUntilAuthInputReady(): Promise<void> {
    await this.pollAuthInput(undefined);
  }

  pollAuthStatus(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<AuthStatus>> {
    return this.pollableAuthStatus.poll(lastPollVersion);
  }

  getAuthStatus(): AuthStatus {
    return this.pollableAuthStatus.getValue();
  }

  getAuthCheck(): AuthCheck {
    return this.pollableAuthCheck.getValue();
  }

  pollAuthCheck(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<AuthCheck>> {
    return this.pollableAuthCheck.poll(lastPollVersion);
  }

  async checkAuth(): Promise<void> {
    await this.initializePromise;
    await this.checkAuthAfterInitialization({ force: true });
  }

  private shouldReusePersistedAuthState(authInput: AuthInput): boolean {
    if (!this.persistedAuthState) {
      return false;
    }

    if (!isSameAuthInput(this.persistedAuthState.authInput, authInput)) {
      return false;
    }

    const now = Date.now();

    if (
      now - new Date(this.persistedAuthState.checkedAt).getTime() >=
      minRefetchIntervalAfterAuthCheckInMs
    ) {
      return false;
    }

    if (
      this.persistedAuthState.authStatus.state === "valid" &&
      this.persistedAuthState.authStatus.expiresAt &&
      new Date(this.persistedAuthState.authStatus.expiresAt).getTime() <= now
    ) {
      return false;
    }

    return true;
  }

  private async hydratePersistedAuthState(authInput: AuthInput): Promise<void> {
    try {
      this.persistedAuthState = await authStateStore.getValue();
    } catch (error) {
      logger.error("Failed to hydrate auth state cache: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.persistedAuthState = undefined;
      return;
    }

    if (!this.shouldReusePersistedAuthState(authInput)) {
      return;
    }
  }

  private async persistAuthState(state: PersistedAuthState): Promise<void> {
    this.persistedAuthState = state;

    try {
      await authStateStore.setValue(state);
    } catch (error) {
      logger.error("Failed to persist auth state cache: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async clearPersistedAuthState(): Promise<void> {
    this.persistedAuthState = undefined;

    try {
      await authStateStore.clearValue();
    } catch (error) {
      logger.error("Failed to clear auth state cache: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async persistAuthStatusAfterCheck(
    authInput: AuthInput,
    authStatus: PersistedAuthStatus,
  ): Promise<void> {
    await this.persistAuthState({
      authInput,
      authStatus,
      checkedAt: isoDateTimeSchema.parse(Date.now()),
    });
  }

  private async applyAuthStatusAfterCheck(
    authInput: AuthInput,
    authStatus: AuthStatus,
  ): Promise<void> {
    this.pollableAuthStatus.setValue(authStatus);

    if (authStatus.state === "empty" || authStatus.state === "unknown") {
      if (authStatus.state === "empty") {
        await this.clearPersistedAuthState();
      }
      return;
    }

    await this.persistAuthStatusAfterCheck(authInput, authStatus);
  }

  private async checkAuthAfterInitialization({
    force,
  }: {
    force: boolean;
  }): Promise<void> {
    if (this.getAuthCheck().state === "ongoing") {
      return;
    }

    const authInput = await this.getAuthInput();

    if (!force && this.shouldReusePersistedAuthState(authInput)) {
      const persistedAuthState = this.persistedAuthState;
      if (persistedAuthState) {
        this.pollableAuthStatus.setValue(persistedAuthState.authStatus);
      }
      return;
    }

    if (authInput.accessCode.length === 0) {
      await this.applyAuthStatusAfterCheck(authInput, {
        state: "empty",
        ...authInput,
      });
      return;
    }

    this.pollableAuthCheck.setValue({
      state: "ongoing",
      startedAt: isoDateTimeSchema.parse(new Date()),
    });

    const checkStartedAt = Date.now();
    const shouldEnsureCheckDurationIsVisible =
      this.getAuthStatus().state === "valid";

    const outcome = await this.fetchFromDynamicApiWithAccessCode("getMe");

    let currentAuthInput = await this.getAuthInput();

    if (!isSameAuthInput(currentAuthInput, authInput)) {
      logger.info(
        "Discarding auth check result because auth input changed during the request",
      );

      this.pollableAuthCheck.setValue({ state: "idle" });
      void this.checkAuth();
      return;
    }

    const remainingVisibleDurationInMs = checkStartedAt + 500 - Date.now();

    if (
      shouldEnsureCheckDurationIsVisible &&
      remainingVisibleDurationInMs > 0
    ) {
      await delay(remainingVisibleDurationInMs);
      currentAuthInput = await this.getAuthInput();
    }

    let newAuthStatus: AuthStatus;

    if (!outcome.problem) {
      newAuthStatus = omitUndefined({
        state: "valid" as const,
        accessLevel: outcome.accessLevel,
        expiresAt: outcome.expiresAt,
        pointCount: outcome.pointCount,
        permissionLookup: outcome.permissionLookup,
      });
    } else if (outcome.type === "bn:ext:invalid-access-code") {
      newAuthStatus = {
        state: "invalid",
        accessCode: authInput.accessCode,
        accessCodeEnteredAt: authInput.accessCodeEnteredAt,
        accessCodeRecognized: outcome.accessCodeRecognized ?? false,
        errorMessage: outcome.description,
      };
    } else {
      newAuthStatus = {
        state: "unknown",
        ...authInput,
      };
    }

    if (!isSameAuthInput(currentAuthInput, authInput)) {
      logger.info(
        "Discarding auth check result because auth input changed during the request",
      );

      this.pollableAuthCheck.setValue({ state: "idle" });
      void this.checkAuth();
      return;
    }

    this.pollableAuthCheck.setValue({ state: "idle" });
    await this.applyAuthStatusAfterCheck(authInput, newAuthStatus);
  }

  setAccessCode(accessCode: string): void {
    void this.setAccessCodeAndRecheck(accessCode);
  }

  private async setAccessCodeAndRecheck(accessCode: string): Promise<void> {
    const wasInitialized = this.initialized;

    this.pollableAuthInput.setValue({
      accessCode: accessCode
        .slice(0, 1000) // mitigate accidental pastes of large strings
        .trim(),
      accessCodeEnteredAt: isoDateTimeSchema.parse(new Date()),
    });

    await this.clearPersistedAuthState();

    if (!wasInitialized) {
      return;
    }

    await this.initializePromise;
    await this.checkAuthAfterInitialization({ force: true });
  }

  public async fetchFromDynamicApiWithAccessCode<
    Method extends DynamicApiEndpointKey,
  >(
    method: Method,
    ...rest: DynamicApiEndpointInput<Method> extends Record<string, never>
      ? []
      : [payload: DynamicApiEndpointInput<Method>]
  ): Promise<DynamicApiEndpointOutcome<Method>> {
    const [error, data] = await orpcClient[method](
      // @ts-expect-error -- orpcClient is a union of all methods, but the payload belongs to a single method
      rest[0],
      {
        context: {
          aliasManager: this.aliasManagerForDynamicApi,
          authInput: await this.getAuthInput(),
        },
      },
    );

    if (error instanceof OrpcErrorRemoteSystemUnavailable) {
      return {
        problem: true,
        type: "bn:ext:local:remote-system-unavailable",
        description: error.message,
        reason: error.reason,
      } satisfies RemoteSystemUnavailableProblem;
    }

    if (error) {
      logger.error(
        "Failed to fetch from dynamic API: {error}\nIssues: {issues}",
        {
          error,
          issues: "issues" in error ? error.issues : undefined,
        },
      );

      return {
        problem: true,
        type: "bn:ext:local:contract-error",
        description: error instanceof Error ? error.message : "Unknown error",
      } satisfies ContractProblem;
    }

    if (!hasBody(data)) {
      logger.error(
        "Failed to fetch from dynamic API: missing body in ORPC response for {method}",
        { data, method },
      );

      return {
        problem: true,
        type: "bn:ext:local:contract-error",
        description: "Missing response body",
      } satisfies ContractProblem;
    }

    const body: unknown = data.body;

    if (isProblemOutcome(body)) {
      logger.warn(
        "Dynamic API returned problem for {method}: {type} {description}",
        {
          description: body.description,
          method,
          outcome: body,
          type: body.type,
        },
      );
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- orpcClient returns a union of all methods, but the data belongs to a single method
    return data.body as DynamicApiEndpointOutput<Method>;
  }

  public patchPermissionLookup(permissionLookup: PermissionLookup): void {
    const authStatus = this.getAuthStatus();

    if (authStatus.state !== "valid") {
      logger.error(
        "Attempted to patch permission lookup for non-valid auth status: {authStatus}",
        { authStatus },
      );
      return;
    }

    const newAuthStatus = { ...authStatus, permissionLookup };

    this.pollableAuthStatus.setValue(newAuthStatus);
    void this.persistPatchedValidAuthStatus(newAuthStatus);

    logger.debug("Patched permission lookup to {permissionLookup}", {
      permissionLookup,
    });
  }

  public patchPointCount(pointCount: number): void {
    const authStatus = this.getAuthStatus();
    if (authStatus.state !== "valid") {
      logger.error(
        "Attempted to patch point count for non-valid auth status: {authStatus}",
        { authStatus },
      );
      return;
    }

    const newAuthStatus = { ...authStatus, pointCount };

    this.pollableAuthStatus.setValue(newAuthStatus);
    void this.persistPatchedValidAuthStatus(newAuthStatus);

    logger.debug("Patched point count to {pointCount}", { pointCount });
  }

  private async persistPatchedValidAuthStatus(
    authStatus: PersistedAuthStatus & { state: "valid" },
  ): Promise<void> {
    const authInput = await this.getAuthInput();
    const persistedAuthState = this.persistedAuthState;

    if (
      persistedAuthState?.authStatus.state !== "valid" ||
      !isSameAuthInput(persistedAuthState.authInput, authInput)
    ) {
      return;
    }

    await this.persistAuthState({
      ...persistedAuthState,
      authStatus,
    });
  }
}
