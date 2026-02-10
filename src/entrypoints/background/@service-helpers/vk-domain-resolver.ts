import { delay } from "es-toolkit";
import { LRUCache } from "lru-cache";

import {
  parseVkDomain,
  type VkId,
  vkIdSchema,
  type VkNickname,
} from "@/shared/@primitives/vk";
import { getBackgroundLogger } from "@/shared/logging";

import type { StaticListsService } from "../@services/static-lists-service";

const logger = getBackgroundLogger(["vk-domain-resolver"]);

const symbolForUndefined = Symbol("undefined");
const symbolForPending = Symbol("pending");
const symbolForFailedFetch = Symbol("failedFetch");

type CacheValue = VkId | typeof symbolForUndefined | typeof symbolForPending;

export class VkDomainResolver {
  private readonly staticListsService: StaticListsService;

  // TODO: Persist cache to IndexedDB instead of using in-memory caching
  private readonly idByNicknameCache = new LRUCache<VkNickname, CacheValue>({
    max: 1000,
  });

  private readonly fetchTimeout = 5000;

  constructor({
    staticListsService,
  }: {
    staticListsService: StaticListsService;
  }) {
    this.staticListsService = staticListsService;
  }

  private async doResolve(
    vkNickname: VkNickname,
  ): Promise<VkId | undefined | typeof symbolForFailedFetch> {
    const account = await this.staticListsService.findItem(
      "accounts",
      "vkNickname",
      vkNickname,
    );

    if (account) {
      logger.debug(
        "Resolved vkId for {vkNickname} as {vkId} from static list",
        {
          vkNickname,
          vkId: account.vkId,
        },
      );

      return account.vkId;
    }

    let pageText: string | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    const urlToFetch = `https://vk.com/${vkNickname}`;

    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort();
      }, this.fetchTimeout);

      const userIdResponse = await fetch(urlToFetch, {
        signal: controller.signal,
      });

      pageText = await userIdResponse.text();
    } catch (error) {
      logger.warn("Failed to fetch user id for {vkNickname}: {error}", {
        vkNickname,
        error,
      });
      return symbolForFailedFetch;
    } finally {
      clearTimeout(timeoutId);
    }

    const idMatch = /"owner_id":(-?\d+)/.exec(pageText);

    const vkIdResult = vkIdSchema.safeParse(
      Number.parseInt(idMatch?.[1] ?? ""),
    );

    if (vkIdResult.success) {
      logger.debug("Resolved vkId for {vkNickname} as {vkId}", {
        vkNickname,
        vkId: vkIdResult.data,
      });
      return vkIdResult.data;
    }

    logger.warn("Can't parse id match on {urlToFetch} - got {idMatch}", {
      idMatch,
      urlToFetch,
    });
    return undefined;
  }

  async resolve(vkDomain: string): Promise<VkId | undefined> {
    const result = parseVkDomain(vkDomain);
    if (result.kind === "vkId") {
      logger.debug(
        "Resolved vkId for {vkDomain} as {vkId} (vkId was provided)",
        {
          vkDomain,
          vkId: result.value,
        },
      );
      return result.value;
    }

    if (result.kind === "undetermined") {
      logger.warn("Unable to determine kind of VK domain: {vkDomain}", {
        vkDomain,
      });
      return undefined;
    }

    let cachedValue: CacheValue | undefined;

    while (
      (cachedValue = this.idByNicknameCache.get(result.value)) ===
      symbolForPending
    ) {
      await delay(50);
    }

    if (cachedValue) {
      logger.debug("Resolved vkId for {vkDomain} as {vkId} (cached)", {
        vkDomain,
        vkId: cachedValue === symbolForUndefined ? undefined : cachedValue,
      });
      return cachedValue === symbolForUndefined ? undefined : cachedValue;
    }

    this.idByNicknameCache.set(result.value, symbolForPending);

    const value = await this.doResolve(result.value);

    if (value === symbolForFailedFetch) {
      this.idByNicknameCache.delete(result.value);
      return undefined;
    }

    this.idByNicknameCache.set(result.value, value ?? symbolForUndefined);

    return value;
  }
}
