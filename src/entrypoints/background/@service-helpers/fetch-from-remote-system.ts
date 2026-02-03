import type { JsonValue } from "type-fest";

import {
  type AliasManager,
  type AliasToUse,
  unavailableAliasReasons,
} from "./alias-manager";
import { fetchFromAlias } from "./fetch-from-alias";

export const unavailableRemoteSystemReasons = [
  ...unavailableAliasReasons,
  "noAliasToUse",
] as const;

export const errorMessageByUnavailableRemoteSystemReason = {
  blockedByFirewall: "Ваш IP-адрес заблокирован",
  connectionFailed: "Не удалось подключиться к серверу",
  noAliasToUse: "Сервис временно недоступен",
  serverError: "Произошла ошибка на сервере, попробуйте позже",
  tooManyRequests: "Слишком много запросов, попробуйте позже",
} satisfies Record<UnavailableRemoteSystemReason, string>;

export type UnavailableRemoteSystemReason =
  (typeof unavailableRemoteSystemReasons)[number];

export async function fetchFromRemoteSystem({
  aliasManager,
  init,
  post,
  signalOrTimeout,
  urlSuffix,
}: {
  aliasManager: AliasManager;
  init?: RequestInit | undefined;
  post?: JsonValue | undefined;
  signal?: AbortSignal | undefined;
  signalOrTimeout?: number | undefined;
  urlSuffix: string;
}): Promise<
  | {
      success: true;
      response: Response;
    }
  | {
      success: false;
      reason: UnavailableRemoteSystemReason;
    }
> {
  let aliasToUse: AliasToUse | undefined;

  while ((aliasToUse = aliasManager.findAliasToUse())) {
    const fetchResult = await fetchFromAlias({
      alias: aliasToUse,
      init,
      urlSuffix,
      post,
      signalOrTimeout,
    });

    if (fetchResult.success) {
      aliasManager.markAliasAsAvailable(aliasToUse.baseUrl);
      return fetchResult;
    }

    aliasManager.markAliasAsUnavailable(aliasToUse.baseUrl, fetchResult.reason);
  }

  return { success: false, reason: "noAliasToUse" };
}
