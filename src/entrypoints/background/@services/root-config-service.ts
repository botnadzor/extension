import { delay } from "es-toolkit";
import { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/@logging/categories";
import {
  fallbackRootConfigSchema,
  type RootConfig,
  rootConfigSchema,
  rootConfigSeed,
} from "@/shared/@model/root-config";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";
import type { SemverRange } from "@/shared/@primitives/semver";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";

import type { AliasManager } from "../@service-helpers/alias-manager";
import { fetchFromRemoteSystem } from "../@service-helpers/fetch-from-remote-system";
import { defineStoreWithSchema } from "../@service-helpers/store-with-schema";

const logger = getBackgroundLogger(["root-config-service"]);

const maxGetTimeoutInMs = 2000;
const minRefetchIntervalAfterSuccessInMs = 30 * 60 * 1000;
const minRetryIntervalAfterFailureInMs = 10 * 1000;
const maxRetryCount = 3;

const persistedRootConfigStateSchema = z.readonly(
  z.object({
    rootConfig: rootConfigSchema,
    fetchedAt: isoDateTimeSchema,
  }),
);

const rootConfigStore = defineStoreWithSchema(
  "local:root-config-cache",
  persistedRootConfigStateSchema,
);

export class RootConfigService {
  private readonly aliasManagerForStaticApi: AliasManager;

  private lastSuccessfulFetchAt: number | undefined;

  private readonly hydrateFromStorePromise: Promise<void>;
  private pollableRootConfig: Pollable<RootConfig>;
  private pollableExtensionVersionRange: Pollable<SemverRange>;
  private updateIfNeededPromise: Promise<void> | undefined;

  constructor({
    aliasManagerForStaticApi,
  }: {
    aliasManagerForStaticApi: AliasManager;
  }) {
    this.aliasManagerForStaticApi = aliasManagerForStaticApi;
    this.pollableRootConfig = new Pollable(rootConfigSeed);
    this.pollableExtensionVersionRange = new Pollable(
      rootConfigSeed.extensionVersionRange,
    );
    this.hydrateFromStorePromise = this.hydrateFromStore();
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

  async getExtensionVersionRange(): Promise<SemverRange> {
    const result = await this.pollExtensionVersionRange(undefined);
    return result.value;
  }

  async pollExtensionVersionRange(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<SemverRange>> {
    await this.hydrateFromStorePromise;
    return this.pollableExtensionVersionRange.poll(lastPollVersion);
  }

  private async updateIfNeeded(): Promise<void> {
    await this.hydrateFromStorePromise;

    this.updateIfNeededPromise ??= this.doUpdateIfNeeded().finally(() => {
      this.updateIfNeededPromise = undefined;
    });

    await this.updateIfNeededPromise;
  }

  private applyPersistedRootConfigState(
    persistedState: z.infer<typeof persistedRootConfigStateSchema>,
  ): void {
    this.pollableRootConfig.setValue(persistedState.rootConfig);
    this.pollableExtensionVersionRange.setValue(
      persistedState.rootConfig.extensionVersionRange,
    );
    this.lastSuccessfulFetchAt = new Date(persistedState.fetchedAt).getTime();
  }

  private async hydrateFromStore(): Promise<void> {
    try {
      const persistedState = await rootConfigStore.getValue();
      if (!persistedState) {
        return;
      }

      this.applyPersistedRootConfigState(persistedState);

      logger.debug("Hydrated root config from store: {rootConfig}", {
        rootConfig: persistedState.rootConfig,
      });
    } catch (error) {
      logger.error("Failed to hydrate root config from store: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async persistRootConfig(rootConfig: RootConfig): Promise<void> {
    const persistedState = {
      rootConfig,
      fetchedAt: isoDateTimeSchema.parse(Date.now()),
    };

    this.applyPersistedRootConfigState(persistedState);

    try {
      await rootConfigStore.setValue(persistedState);
    } catch (error) {
      logger.error("Failed to persist root config: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async doUpdateIfNeeded(): Promise<void> {
    const now = Date.now();

    if (
      this.lastSuccessfulFetchAt !== undefined &&
      now - this.lastSuccessfulFetchAt < minRefetchIntervalAfterSuccessInMs
    ) {
      logger.debug(
        "Root config update is not needed (it was fetched {elapsedTime} seconds ago)",
        {
          elapsedTime: Math.floor((now - this.lastSuccessfulFetchAt) / 1000),
        },
      );
      return;
    }

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

        return;
      }

      const json: unknown = await fetchResult.response.json();

      const parseResult = rootConfigSchema.safeParse(json);

      if (!parseResult.success) {
        logger.error(
          "Failed to parse root config (attempt {attempt}): {error}",
          {
            attempt,
            error: parseResult.error,
          },
        );

        const fallbackParseResult = fallbackRootConfigSchema.safeParse(json);

        if (fallbackParseResult.success) {
          this.pollableExtensionVersionRange.setValue(
            fallbackParseResult.data.extensionVersionRange,
          );

          logger.info(
            "Extracted extension version range from incompatible root config: {extensionVersionRange}",
            {
              extensionVersionRange:
                fallbackParseResult.data.extensionVersionRange,
            },
          );

          return;
        }

        if (attempt < maxRetryCount - 1) {
          continue;
        }

        return;
      }

      await this.persistRootConfig(parseResult.data);

      logger.debug("Root config updated: {rootConfig}", {
        rootConfig: parseResult.data,
      });
      return;
    }
  }
}
