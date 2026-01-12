import { produce } from "immer";

import { getBackgroundLogger } from "@/lib/logging";
import { type IsoTime, isoTimeSchema } from "@/lib/primitive-values";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/services/shared/pollable";

type RemoteSystem = "dynamicApi" | "frontend" | "staticApi";

type AliasConfig = Readonly<{ role?: "primary" }>;

type AliasConfigLookup = Readonly<Record<string, AliasConfig>>;

export type UnavailableAliasReason =
  | "blockedByFirewall"
  | "connectionFailed"
  | "tooManyRequests"
  | "unexpectedError";

const expiryTimeoutLookup: Record<UnavailableAliasReason, number> = {
  blockedByFirewall: 60_000,
  connectionFailed: 10_000,
  tooManyRequests: 30_000,
  unexpectedError: 5000,
};

type AliasStatus = Readonly<
  | {
      state: "unknown";
    }
  | {
      state: "available";
      confirmedAt: IsoTime;
    }
  | {
      state: "unavailable";
      confirmedAt: IsoTime;
      confirmedUntil: IsoTime;
      reason: UnavailableAliasReason;
    }
>;

type AliasStatusLookup = Readonly<
  Record<string, Exclude<AliasStatus, { state: "unknown" }>>
>;

export type AliasToUse = Readonly<{
  baseUrl: string;
  config: AliasConfig;
  status: Exclude<AliasStatus, { state: "unavailable" }>;
}>;

const logger = getBackgroundLogger(["alias-manager"]);

// Re-using the same object to allow for reference equality checks
const unknownAliasStatus = { state: "unknown" } satisfies AliasStatus;

export class AliasManager {
  private remoteSystem: RemoteSystem;
  private aliasConfigLookup: AliasConfigLookup;
  private aliasStatusLookup: AliasStatusLookup;

  private pollableAliasToUse: Pollable<AliasToUse | undefined>;

  public constructor(
    remoteSystem: RemoteSystem,
    initialAliasConfigLookup: AliasConfigLookup,
  ) {
    this.remoteSystem = remoteSystem;
    this.aliasConfigLookup = initialAliasConfigLookup;
    this.aliasStatusLookup = {};
    this.pollableAliasToUse = new Pollable<AliasToUse | undefined>(
      this.doFindAliasToUse(),
    );
  }

  public configure(aliasConfigLookup: AliasConfigLookup): void {
    this.aliasConfigLookup = aliasConfigLookup;

    this.aliasStatusLookup = produce(this.aliasStatusLookup, (draft) => {
      for (const baseUrl of Object.keys(draft)) {
        if (!Object.hasOwn(aliasConfigLookup, baseUrl)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- baseUrl originates from iteration over Object.keys (should be safe)
          delete draft[baseUrl];
        }
      }
    });

    logger.debug("Aliases configured for {remoteSystem}: {aliasConfigLookup}", {
      aliasConfigLookup,
      remoteSystem: this.remoteSystem,
    });
  }

  private doFindAliasToUse(): AliasToUse | undefined {
    for (const [baseUrl, config] of Object.entries(this.aliasConfigLookup)) {
      const status = this.aliasStatusLookup[baseUrl];

      if (status?.state === "available") {
        return { baseUrl, config, status };
      }
    }

    for (const [baseUrl, config] of Object.entries(this.aliasConfigLookup)) {
      const status = this.aliasStatusLookup[baseUrl];

      if (status?.state !== "unavailable") {
        return { baseUrl, config, status: unknownAliasStatus };
      }
    }

    return undefined;
  }

  /**
   * Returns the first alias that's marked as available,
   * otherwise the first alias whose status is unknown.
   *
   * Returns undefined if all aliases are marked as unavailable.
   */
  public findAliasToUse(): AliasToUse | undefined {
    const aliasToUse = this.doFindAliasToUse();
    this.pollableAliasToUse.setValue(aliasToUse);
    return aliasToUse;
  }

  public pollAliasToUse(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<AliasToUse | undefined>> {
    return this.pollableAliasToUse.poll(lastPollVersion);
  }

  private isValidBaseUrl(baseUrl: string): boolean {
    return Object.hasOwn(this.aliasConfigLookup, baseUrl);
  }

  public markAliasAsAvailable(baseUrl: string): void {
    if (!this.isValidBaseUrl(baseUrl)) {
      logger.warn(
        "Unable to mark base URL {baseUrl} as available for remote system {remoteSystem} (not a valid alias - could have been removed)",
        { baseUrl, remoteSystem: this.remoteSystem },
      );
      return;
    }

    const now = Date.now();

    this.aliasStatusLookup = produce(this.aliasStatusLookup, (draft) => {
      draft[baseUrl] = {
        state: "available",
        confirmedAt: isoTimeSchema.parse(now),
      };
    });

    logger.debug(
      "Marked base URL {baseUrl} as available for remote system {remoteSystem}",
      { baseUrl, remoteSystem: this.remoteSystem },
    );
  }

  public markAliasAsUnavailable(
    baseUrl: string,
    reason: UnavailableAliasReason,
  ): void {
    if (!this.isValidBaseUrl(baseUrl)) {
      logger.warn(
        "Unable to mark base URL {baseUrl} as unavailable for remote system {remoteSystem} (not a valid alias - could have been removed)",
        { baseUrl, remoteSystem: this.remoteSystem },
      );
      return;
    }

    const expiryTimeout = expiryTimeoutLookup[reason];

    const now = Date.now();

    this.aliasStatusLookup = produce(this.aliasStatusLookup, (draft) => {
      draft[baseUrl] = {
        state: "unavailable",
        confirmedAt: isoTimeSchema.parse(now),
        confirmedUntil: isoTimeSchema.parse(now + expiryTimeout),
        reason,
      };
    });

    logger.debug(
      "Marked base URL {baseUrl} as unavailable for remote system {remoteSystem} with reason {reason}",
      { baseUrl, reason, remoteSystem: this.remoteSystem },
    );

    setTimeout(() => {
      this.resetExpiredStatuses();
    }, expiryTimeout + 1);
  }

  private resetExpiredStatuses(): void {
    const isoTime = isoTimeSchema.parse(Date.now());
    let resetCount = 0;

    this.aliasStatusLookup = produce(this.aliasStatusLookup, (draft) => {
      for (const [url, status] of Object.entries(draft)) {
        if ("confirmedUntil" in status && status.confirmedUntil < isoTime) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete --  baseUrl originates from iteration over Object.entries (should be safe)
          delete draft[url];
          resetCount += 1;
        }
      }
    });

    logger.debug(
      `{resetCount} expired alias ${resetCount === 1 ? "status was" : "statuses were"} reset for remote system {remoteSystem}`,
      { remoteSystem: this.remoteSystem, resetCount },
    );
  }

  public resetStatuses(): void {
    this.aliasStatusLookup = {};

    logger.debug(
      "All alias statuses were reset for remote system {remoteSystem}",
      { remoteSystem: this.remoteSystem },
    );
  }
}
