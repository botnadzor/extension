import { delay } from "es-toolkit";
import { LRUCache } from "lru-cache";

import {
  type IsoTime,
  isoTimeSchema,
  isPositiveVkId,
  type PositiveVkId,
} from "@/shared/@model/primitives";

import type { DynamicApiEndpointResponse } from "../@service-helpers/dynamic-api-endpoints";
import type { VkDomainResolver } from "../@service-helpers/vk-domain-resolver";
import type { AuthService } from "./auth-service";

const symbolForPending = Symbol("pending");

type RegDateInfo = DynamicApiEndpointResponse<"regDate"> & {
  checkedAt: IsoTime;
};

type CachedRegDateInfo =
  | (DynamicApiEndpointResponse<"regDate"> & {
      checkedAt: IsoTime;
      errorKind?: never;
    })
  | typeof symbolForPending;

export class RegDateService {
  private readonly authService: AuthService;

  private readonly vkDomainResolver: VkDomainResolver;

  private readonly regDateCache: LRUCache<PositiveVkId, CachedRegDateInfo>;

  constructor({
    authService,
    vkDomainResolver,
  }: {
    authService: AuthService;
    vkDomainResolver: VkDomainResolver;
  }) {
    this.authService = authService;
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
        checkedAt: isoTimeSchema.parse(undefined),
        errorKind: "notFound",
        errorMessage: "Аккаунт с таким никнеймом не найден",
      };
    }

    if (!isPositiveVkId(vkId)) {
      return {
        checkedAt: isoTimeSchema.parse(undefined),
        errorKind: "notApplicableToNegativeVkIds",
        errorMessage: "Невозможно узнать дату регистрации у сообществ ВК",
      };
    }

    const authStatus = this.authService.getAuthStatus();
    if (authStatus.state !== "valid") {
      return {
        checkedAt: isoTimeSchema.parse(undefined),
        errorKind: "unauthorized",
        errorMessage: "Чтобы получить дату регистрации, настройте доступ",
      };
    }

    if (!authStatus.permissionLookup.canGetRegDate) {
      return {
        checkedAt: isoTimeSchema.parse(undefined),
        errorKind: "missingPermission",
        errorMessage:
          "Чтобы получить дату регистрации, ваш код должен иметь очки или дополнительные уровни",
      };
    }

    const cachedValue = await this.getFromCache(vkId);
    if (cachedValue) {
      return cachedValue;
    }

    this.regDateCache.set(vkId, symbolForPending);

    const responseBody =
      await this.authService.fetchFromDynamicApiWithAccessCode("regDate", {
        vkId,
      });

    const checkedAt = isoTimeSchema.parse(undefined);

    if ("data" in responseBody) {
      const info = {
        data: responseBody.data,
        checkedAt,
      } satisfies RegDateInfo;

      this.regDateCache.set(vkId, info);

      return info;
    }

    this.regDateCache.delete(vkId);

    if (
      responseBody.errorKind === "missingPermission" ||
      responseBody.errorKind === "notFound"
    ) {
      void this.authService.checkAuth();
    }

    return {
      checkedAt,
      errorKind: responseBody.errorKind,
      errorMessage: responseBody.errorMessage,
    };
  }
}
