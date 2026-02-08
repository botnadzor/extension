import { delay } from "es-toolkit";

import {
  type RootConfig,
  rootConfigSchema,
  rootConfigSeed,
} from "@/shared/@model/root-config";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import { getBackgroundLogger } from "@/shared/logging";

import type { AliasManager } from "../@service-helpers/alias-manager";
import { fetchFromRemoteSystem } from "../@service-helpers/fetch-from-remote-system";

const logger = getBackgroundLogger(["root-config-service"]);

const maxGetTimeoutInMs = 2000;
const minRefetchIntervalAfterSuccessInMs = 30 * 60 * 1000;
const minRetryIntervalAfterFailureInMs = 10 * 1000;
const maxRetryCount = 3;

export class RootConfigService {
  private aliasManagerForStaticApi: AliasManager;

  private state: "idle" | "fetching";
  private lastFetchAttempt: { success: boolean; fetchedAt: number } | undefined;

  private pollableRootConfig: Pollable<RootConfig>;

  constructor({
    aliasManagerForStaticApi,
  }: {
    aliasManagerForStaticApi: AliasManager;
  }) {
    this.aliasManagerForStaticApi = aliasManagerForStaticApi;
    this.pollableRootConfig = new Pollable(rootConfigSeed);
    this.state = "idle";
  }

  async get(): Promise<RootConfig> {
    const result = await this.poll(undefined);
    return result.value;
  }

  async poll(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<RootConfig>> {
    await Promise.any([this.updateIfNeeded(), delay(maxGetTimeoutInMs)]);

    return this.pollableRootConfig.poll(lastPollVersion);
  }

  private async waitForIdle(): Promise<void> {
    while (this.state !== "idle") {
      await delay(100);
    }
  }

  private async updateIfNeeded(): Promise<void> {
    await this.waitForIdle();

    const now = Date.now();

    if (
      this.lastFetchAttempt &&
      now - this.lastFetchAttempt.fetchedAt < minRefetchIntervalAfterSuccessInMs
    ) {
      logger.debug(
        "Root config update is not needed (it was fetched {elapsedTime} seconds ago)",
        {
          elapsedTime: Math.floor(
            (now - this.lastFetchAttempt.fetchedAt) / 1000,
          ),
        },
      );
      return;
    }

    // Prevent multiple parallel fetches on startup
    this.lastFetchAttempt ??= { success: false, fetchedAt: now };

    this.state = "fetching";

    for (let attempt = 0; attempt < maxRetryCount; attempt++) {
      if (attempt > 0) {
        await delay(minRetryIntervalAfterFailureInMs);
        this.aliasManagerForStaticApi.resetStatuses();
      }

      const fetchResult = await fetchFromRemoteSystem({
        aliasManager: this.aliasManagerForStaticApi,
        urlSuffix: "/root-config.json",
      });

      if (!fetchResult.success) {
        logger.error(
          "Failed to fetch root config (attempt {attempt}): {error}",
          {
            attempt,
            error: fetchResult.reason,
          },
        );

        if (attempt < maxRetryCount - 1) {
          continue;
        }

        this.lastFetchAttempt = { success: false, fetchedAt: Date.now() };
        this.state = "idle";
        return;
      }

      const parseResult = rootConfigSchema.safeParse(
        await fetchResult.response.json(),
      );

      if (!parseResult.success) {
        logger.error(
          "Failed to parse root config (attempt {attempt}): {error}",
          {
            attempt,
            error: parseResult.error,
          },
        );

        if (attempt < maxRetryCount - 1) {
          continue;
        }

        this.lastFetchAttempt = { success: false, fetchedAt: Date.now() };
        this.state = "idle";
        return;
      }

      this.pollableRootConfig.setValue(parseResult.data);
      this.lastFetchAttempt = { success: true, fetchedAt: Date.now() };
      this.state = "idle";

      logger.debug("Root config updated: {rootConfig}", {
        rootConfig: parseResult.data,
      });
      return;
    }
  }
}
