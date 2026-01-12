import { delay } from "es-toolkit";
import type { z } from "zod/mini";

import type { AliasManager } from "@/entrypoints/background/alias-manager";
import {
  type DynamicApiEndpointDefinitionLookup,
  dynamicApiEndpointDefinitionLookup,
  type DynamicEndpointKey,
} from "@/entrypoints/background/dynamic-api-endpoints";
import type {
  DynamicApiEndpointDefinition,
  ResponseConversionResult,
} from "@/entrypoints/background/dynamic-api-endpoints/types";
import { fetchFromRemoteSystem } from "@/entrypoints/background/fetch-from-remote-system";
import { getBackgroundLogger } from "@/lib/logging";
import type { PermissionLookup } from "@/lib/permissions";
import { isoTimeSchema } from "@/lib/primitive-values";

import { Pollable, type PollResult, type PollVersion } from "./shared/pollable";
import {
  type AuthCheck,
  type AuthInput,
  authInputStore,
  type AuthStatus,
  defaultAuthInput,
} from "./user-service/auth";
import {
  defaultUserConfig,
  type UserConfig,
  userConfigStore,
} from "./user-service/user-config";

export { type UserConfig } from "./user-service/user-config";
export { defaultUserConfig } from "./user-service/user-config";

const logger = getBackgroundLogger(["user-service"]);

export class UserService {
  private aliasManagerForDynamicApi: AliasManager;
  private disposed = false;

  private pollableAuthInput: Pollable<AuthInput | undefined>;
  private pollableUserConfig: Pollable<UserConfig | undefined>;

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
    this.pollableUserConfig = new Pollable<UserConfig | undefined>(undefined);

    this.pollableAuthStatus = new Pollable<AuthStatus>({ state: "unknown" });
    this.pollableAuthCheck = new Pollable<AuthCheck>({ state: "idle" });

    void this.checkAuth();

    void this.startSyncingAuthInputWithStore();
    void this.startSyncingUserConfigWithStore();
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

  private async startSyncingUserConfigWithStore() {
    this.pollableUserConfig.setValue(
      (await userConfigStore.getValue()) ?? defaultUserConfig,
    );

    let result = await this.pollConfig(undefined);

    while (!this.disposed) {
      await delay(this.storeWriteThrottleInMs);
      result = await this.pollConfig(result.version);
      await userConfigStore.setValue(result.value);
      logger.debug("Wrote user config to store");
    }
  }

  async pollConfig(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<UserConfig>> {
    let result: PollResult<UserConfig> | PollResult<undefined> | undefined;

    do {
      result = await this.pollableUserConfig.poll(
        lastPollVersion ?? result?.version,
      );
    } while (!result?.value);

    return result;
  }

  async getConfig(): Promise<UserConfig> {
    const result = await this.pollConfig(undefined);
    return result.value;
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

  setConfig(newValue: UserConfig): void {
    this.pollableUserConfig.setValue(newValue);
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
      startedAt: isoTimeSchema.parse(new Date()),
    });

    const authInput = await this.getAuthInput();

    let newAuthStatus: AuthStatus;

    if (authInput.accessCode.length === 0) {
      newAuthStatus = {
        state: "empty",
        ...authInput,
      };
    } else {
      const [fetchResult] = await Promise.all([
        this.robustlyFetchFromDynamicApi("access", {}),
        this.getAuthStatus().state === "valid" ? delay(500) : undefined, // Ensure check duration is visible to the user (if it's too fast, it's hard to notice that something is happening)
      ]);

      if (fetchResult.success) {
        newAuthStatus = {
          state: "valid",
          expiresAt: isoTimeSchema.parse(
            new Date(Date.now() + 1000 * 60 * 60 * 24),
          ),
          accessLevel: fetchResult.data.accessLevel,
          pointCount: fetchResult.data.pointCount,
          permissionLookup: fetchResult.data.permissionLookup,
        };
      } else if (fetchResult.reason === "unauthorized") {
        newAuthStatus = {
          state: "invalid",
          ...authInput,
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
      accessCodeEnteredAt: isoTimeSchema.parse(new Date()),
    });
    void this.checkAuth();
  }

  public async robustlyFetchFromDynamicApi<Key extends DynamicEndpointKey>(
    key: Key,
    payload: Parameters<
      DynamicApiEndpointDefinitionLookup[Key]["generateUrlSuffix"]
    >[0],
  ): Promise<
    | {
        success: true;
        data: z.infer<
          DynamicApiEndpointDefinitionLookup[Key]["responseBodySchema"]
        >;
      }
    | {
        success: false;
        reason:
          | "methodQuotaExceeded"
          | "missingPermission"
          | "noAliasToUse"
          | "notFound"
          | "tooManyRequests"
          | "unauthorized"
          | "unexpectedError";
      }
  > {
    const authInput = await this.getAuthInput();

    if (!authInput.accessCode) {
      return { success: false, reason: "unauthorized" };
    }

    const definition: DynamicApiEndpointDefinition =
      dynamicApiEndpointDefinitionLookup[key];

    const fetchResult = await fetchFromRemoteSystem({
      aliasManager: this.aliasManagerForDynamicApi,
      urlSuffix: definition.generateLegacyUrlSuffix(payload),
      post: {
        accessCode: authInput.accessCode,
        ...(definition.generatePostBody
          ? definition.generatePostBody(payload)
          : {}),
      },
    });

    if (!fetchResult.success) {
      return fetchResult;
    }

    try {
      const parsedBody = definition.legacyResponseBodySchema.parse(
        await fetchResult.response.json(),
      );

      const parsedBodyResult =
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mapping generic definition to a specific one
        definition.convertLegacyResponseBodyToResponseBody(
          parsedBody,
        ) as ResponseConversionResult<
          DynamicApiEndpointDefinitionLookup[Key]["responseBodySchema"]
        >;

      if (!parsedBodyResult.success) {
        return parsedBodyResult;
      }

      return { success: true, data: parsedBodyResult.data };
    } catch (error) {
      logger.error(
        "Unexpected error while parsing data from dynamic API: {error}",
        { error },
      );

      return { success: false, reason: "unexpectedError" };
    }
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

export type { AuthCheck, AuthStatus } from "./user-service/auth";
