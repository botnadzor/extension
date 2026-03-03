import { delay } from "es-toolkit";

import {
  type AuthCheck,
  type AuthInput,
  authInputSchema,
  type AuthStatus,
  type PermissionLookup,
} from "@/shared/@model/auth";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";
import { getBackgroundLogger } from "@/shared/logging";
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

const logger = getBackgroundLogger(["auth-service"]);

const authInputStore = defineStoreWithSchema(
  "sync:auth-input",
  authInputSchema,
);

const defaultAuthInput: AuthInput = {
  accessCode: "",
  accessCodeEnteredAt: isoDateTimeSchema.parse(new Date(0)),
};

export class AuthService {
  private aliasManagerForDynamicApi: AliasManager;
  private disposed = false;

  private pollableAuthInput: Pollable<AuthInput | undefined>;
  private pollableAuthStatus: Pollable<AuthStatus>;
  private pollableAuthCheck: Pollable<AuthCheck>;

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

    void this.checkAuth();
    void this.startSyncingAuthInputWithStore();
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

  async getAuthInput(): Promise<AuthInput> {
    const result = await this.pollAuthInput(undefined);
    return result.value;
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
    if (this.getAuthCheck().state === "ongoing") {
      return;
    }

    this.pollableAuthCheck.setValue({
      state: "ongoing",
      startedAt: isoDateTimeSchema.parse(new Date()),
    });

    const authInput = await this.getAuthInput();

    let newAuthStatus: AuthStatus;

    if (authInput.accessCode.length === 0) {
      newAuthStatus = {
        state: "empty",
        ...authInput,
      };
    } else {
      const [outcome] = await Promise.all([
        this.fetchFromDynamicApiWithAccessCode("getMe"),
        this.getAuthStatus().state === "valid" ? delay(500) : undefined, // Ensure check duration is visible to the user (if it's too fast, it's hard to notice that something is happening)
      ]);

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
    }

    this.pollableAuthStatus.setValue(newAuthStatus);
    this.pollableAuthCheck.setValue({ state: "idle" });
  }

  setAccessCode(accessCode: string): void {
    this.pollableAuthInput.setValue({
      accessCode: accessCode
        .slice(0, 1000) // mitigate accidental pastes of large strings
        .trim(),
      accessCodeEnteredAt: isoDateTimeSchema.parse(new Date()),
    });
    void this.checkAuth();
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

    // @ts-expect-error -- orpcClient returns a union of all methods, but the data belongs to a single method
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

    this.pollableAuthStatus.setValue({ ...authStatus, permissionLookup });

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

    this.pollableAuthStatus.setValue({ ...authStatus, pointCount });

    logger.debug("Patched point count to {pointCount}", { pointCount });
  }
}
