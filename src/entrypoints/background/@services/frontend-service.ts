import type { PollResult, PollVersion } from "@/shared/@pollable/core";

import type { AliasManager } from "../@service-helpers/alias-manager";

const fallbackBaseUrl = "https://botnadzor.org";

export class FrontendService {
  private aliasManagerForFrontend: AliasManager;

  constructor({
    aliasManagerForFrontend,
  }: {
    aliasManagerForFrontend: AliasManager;
  }) {
    this.aliasManagerForFrontend = aliasManagerForFrontend;
  }

  getBaseUrl(): string {
    return (
      this.aliasManagerForFrontend.findAliasToUse()?.baseUrl ?? fallbackBaseUrl
    );
  }

  async pollBaseUrl(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<string>> {
    const result =
      await this.aliasManagerForFrontend.pollAliasToUse(lastPollVersion);

    return {
      value: result.value?.baseUrl ?? fallbackBaseUrl,
      version: result.version,
    };
  }
}
