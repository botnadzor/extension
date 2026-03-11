import { getBackgroundLogger } from "@/shared/@logging/core";
import type { PollResult, PollVersion } from "@/shared/@pollable/core";

import type {
  AliasManager,
  AliasToUse,
} from "../@service-helpers/alias-manager";
import { fetchFromAlias } from "../@service-helpers/fetch-from-alias";

const logger = getBackgroundLogger(["frontend-service"]);

const frontendAvailabilityCheckInterval = 1000 * 60 * 60; // 1 hour
const frontendFallbackBaseUrl = "https://botnadzor.org";

export class FrontendService {
  private aliasManagerForFrontend: AliasManager;

  private availabilityCheckTimestamp: number | undefined;

  constructor({
    aliasManagerForFrontend,
  }: {
    aliasManagerForFrontend: AliasManager;
  }) {
    this.aliasManagerForFrontend = aliasManagerForFrontend;

    self.addEventListener("online", () => {
      this.availabilityCheckTimestamp = undefined;
    });
  }

  private isAliasAvailabilityCheckNeeded(): boolean {
    if (this.aliasManagerForFrontend.getAliasCount() <= 1) {
      return false;
    }

    return (
      this.availabilityCheckTimestamp === undefined ||
      this.availabilityCheckTimestamp + frontendAvailabilityCheckInterval <
        Date.now()
    );
  }

  private async checkAliasAvailabilityIfNeeded(): Promise<void> {
    if (!this.isAliasAvailabilityCheckNeeded()) {
      return;
    }

    this.availabilityCheckTimestamp = Date.now();

    let aliasToUse: AliasToUse | undefined;
    while ((aliasToUse = this.aliasManagerForFrontend.findAliasToUse())) {
      const fetchResult = await fetchFromAlias({
        alias: aliasToUse,
        urlSuffix: "/ping",
      });

      if (fetchResult.success || fetchResult.reason === "blockedByFirewall") {
        this.aliasManagerForFrontend.markAliasAsAvailable(aliasToUse.baseUrl);
        break;
      } else {
        this.aliasManagerForFrontend.markAliasAsUnavailable(
          aliasToUse.baseUrl,
          fetchResult.reason,
        );
      }
    }

    logger.debug("Alias availability checked. Available alias: {baseUrl}", {
      baseUrl: aliasToUse?.baseUrl ?? "none",
    });
  }

  async getBaseUrl(): Promise<string> {
    const result = await this.pollBaseUrl(undefined);
    return result.value;
  }

  async pollBaseUrl(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<string>> {
    void this.checkAliasAvailabilityIfNeeded();

    const result =
      await this.aliasManagerForFrontend.pollAliasToUse(lastPollVersion);

    return {
      value: result.value?.baseUrl ?? frontendFallbackBaseUrl,
      version: result.version,
    };
  }
}
