import { delay } from "es-toolkit";
import { LRUCache } from "lru-cache";

import type { VkDomainResolver } from "@/entrypoints/background/vk-domain-resolver";
import {
  type IsoDate,
  type IsoTime,
  isoTimeSchema,
  isPositiveVkId,
  type PositiveVkId,
} from "@/lib/primitive-values";

import type { UserService } from "./user-service";

export type SucceededRegDateInfo = {
  success: true;
  checkedAt: IsoTime;
  value: IsoDate | IsoTime;
};

export type FailedRegDateInfo = {
  success: false;
  checkedAt: IsoTime;
  reason:
    | "methodQuotaExceeded"
    | "missingPermission"
    | "noAliasToUse"
    | "notFound"
    | "notYetKnown"
    | "tooManyRequests"
    | "unauthorized"
    | "unexpectedError";
};
export type RegDateInfo = SucceededRegDateInfo | FailedRegDateInfo;

const symbolForPending = Symbol("pending");

type CachedRegDateInfo = SucceededRegDateInfo | typeof symbolForPending;

export class RegDateService {
  private readonly userService: UserService;

  private readonly vkDomainResolver: VkDomainResolver;

  private readonly regDateCache: LRUCache<PositiveVkId, CachedRegDateInfo>;

  constructor({
    userService,
    vkDomainResolver,
  }: {
    userService: UserService;
    vkDomainResolver: VkDomainResolver;
  }) {
    this.userService = userService;
    this.vkDomainResolver = vkDomainResolver;
    this.regDateCache = new LRUCache({ max: 1000 });
  }

  private async getFromCache(
    vkId: PositiveVkId,
  ): Promise<RegDateInfo | undefined> {
    let cachedValue: CachedRegDateInfo | undefined;
    while ((cachedValue = this.regDateCache.get(vkId)) === symbolForPending) {
      await delay(50);
    }
    return cachedValue;
  }

  async obtain(vkDomain: string): Promise<RegDateInfo> {
    const vkId = await this.vkDomainResolver.resolve(vkDomain);

    if (!vkId) {
      return {
        success: false,
        checkedAt: isoTimeSchema.parse(new Date()),
        reason: "notFound",
      };
    }

    if (!isPositiveVkId(vkId)) {
      return {
        success: false,
        checkedAt: isoTimeSchema.parse(new Date()),
        reason: "notFound",
      };
    }

    const authStatus = this.userService.getAuthStatus();
    if (authStatus.state !== "valid") {
      return {
        success: false,
        checkedAt: isoTimeSchema.parse(new Date()),
        reason: "unauthorized",
      };
    }

    if (!authStatus.permissionLookup.canGetRegDate) {
      return {
        success: false,
        checkedAt: isoTimeSchema.parse(new Date()),
        reason: "missingPermission",
      };
    }

    const cachedValue = await this.getFromCache(vkId);
    if (cachedValue) {
      return cachedValue;
    }

    this.regDateCache.set(vkId, symbolForPending);

    const fetchResult = await this.userService.robustlyFetchFromDynamicApi(
      "regDate",
      { vkId },
    );

    const checkedAt = isoTimeSchema.parse(new Date());

    if (fetchResult.success && fetchResult.data !== "notYetKnown") {
      const info: SucceededRegDateInfo = {
        success: true,
        checkedAt,
        value: fetchResult.data,
      };
      this.regDateCache.set(vkId, info);
      return info;
    }

    this.regDateCache.delete(vkId);

    if (
      !fetchResult.success &&
      (fetchResult.reason === "missingPermission" ||
        fetchResult.reason === "notFound")
    ) {
      void this.userService.checkAuth();
    }

    const info: FailedRegDateInfo = {
      success: false,
      checkedAt,
      reason: fetchResult.success ? "notYetKnown" : fetchResult.reason,
    };

    return info;
  }
}
