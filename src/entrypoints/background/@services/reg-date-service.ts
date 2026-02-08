import { delay } from "es-toolkit";
import { LRUCache } from "lru-cache";

import {
  type IsoDate,
  type IsoDateTime,
  isoDateTimeSchema,
  isPositiveVkId,
  type PositiveVkId,
} from "@/shared/@model/primitives";

import type { DynamicApiEndpointOutcome } from "../@service-helpers/dynamic-api-endpoints";
import type { VkDomainResolver } from "../@service-helpers/vk-domain-resolver";
import type { AuthService } from "./auth-service";

const symbolForPending = Symbol("pending");

type RegDateInfo = DynamicApiEndpointOutcome<"getRegDate"> & {
  checkedAt: IsoDateTime;
};

type CachedRegDateInfo =
  | {
      value: IsoDate | IsoDateTime;
      checkedAt: IsoDateTime;
    }
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
        checkedAt: isoDateTimeSchema.parse(undefined),

        problem: true,
        type: "bn:ext:invalid-payload",
        description: "Аккаунт с таким никнеймом не найден",
        fields: ["vkDomain"],
      };
    }

    if (!isPositiveVkId(vkId)) {
      return {
        checkedAt: isoDateTimeSchema.parse(undefined),

        problem: true,
        type: "bn:ext:invalid-payload",
        description: "Невозможно узнать дату регистрации у сообществ ВК",
        fields: ["vkDomain"],
      };
    }

    const authStatus = this.authService.getAuthStatus();
    if (authStatus.state !== "valid") {
      return {
        checkedAt: isoDateTimeSchema.parse(undefined),

        problem: true,
        type: "bn:ext:invalid-access-code",
        description: "Чтобы получить дату регистрации, настройте доступ",
      };
    }

    if (!authStatus.permissionLookup.getRegDate) {
      return {
        checkedAt: isoDateTimeSchema.parse(undefined),

        problem: true,
        type: "bn:ext:missing-permission",
        description:
          "Чтобы получить дату регистрации, ваш код должен иметь очки или дополнительные уровни",
      };
    }

    const cachedValue = await this.getFromCache(vkId);
    if (cachedValue) {
      return cachedValue;
    }

    this.regDateCache.set(vkId, symbolForPending);

    const outcome = await this.authService.fetchFromDynamicApiWithAccessCode(
      "getRegDate",
      { vkId },
    );

    const checkedAt = isoDateTimeSchema.parse(undefined);

    if (!outcome.problem) {
      const info = {
        value: outcome.value,
        checkedAt,
      } satisfies RegDateInfo;

      this.regDateCache.set(vkId, info);

      return info;
    }

    this.regDateCache.delete(vkId);

    if (outcome.type === "bn:ext:missing-permission") {
      void this.authService.checkAuth();
    }

    return {
      checkedAt,
      ...outcome,
    };
  }
}
