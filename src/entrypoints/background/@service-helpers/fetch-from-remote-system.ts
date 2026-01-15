import type { JsonValue } from "type-fest";

import { getAppConfig } from "@/shared/app-config";
import { getBackgroundLogger } from "@/shared/logging";

import type {
  AliasManager,
  AliasToUse,
  UnavailableAliasReason,
} from "./alias-manager";

const logger = getBackgroundLogger(["fetch-from-remote-system"]);

type RequestFailedReason =
  | "methodQuotaExceeded"
  | "notFound"
  | "unauthorized"
  | "unexpectedError";

type RemoteSystemUnavailableReason =
  | RequestFailedReason
  | "noAliasToUse"
  | "tooManyRequests";

async function fetchFromAlias({
  urlSuffix,
  alias,
  post,
  timeout = 5000,
}: {
  alias: AliasToUse;
  post?: JsonValue | undefined;
  timeout?: number | undefined;
  urlSuffix: string;
}): Promise<
  | {
      success: true;
      response: Response;
    }
  | {
      success: false;
      reason: RequestFailedReason | UnavailableAliasReason;
    }
> {
  const url =
    alias.baseUrl +
    urlSuffix +
    (urlSuffix.includes("?") ? "&" : "?") +
    `ev=${getAppConfig().extensionVersion}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  let response: Response;
  try {
    response = await fetch(url, {
      method: post ? "POST" : "GET",
      ...(post ? { body: JSON.stringify(post) } : {}),
      signal: controller.signal,
    });
  } catch {
    return { success: false, reason: "connectionFailed" };
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 200) {
    return { success: true, response };
  }

  if (response.status === 401) {
    return { success: false, reason: "unauthorized" };
  }

  if (response.status === 403) {
    return { success: false, reason: "blockedByFirewall" };
  }

  if (response.status === 404) {
    return { success: false, reason: "notFound" };
  }

  if (response.status === 429) {
    return { success: false, reason: "tooManyRequests" };
  }

  logger.error("Unexpected response status {status} from {url}", {
    status: response.status,
    url,
  });

  return { success: false, reason: "unexpectedError" };
}

export async function fetchFromRemoteSystem({
  aliasManager,
  post,
  timeout,
  urlSuffix,
}: {
  aliasManager: AliasManager;
  post?: JsonValue | undefined;
  timeout?: number | undefined;
  urlSuffix: string;
}): Promise<
  | {
      success: true;
      response: Response;
    }
  | {
      success: false;
      reason: RemoteSystemUnavailableReason;
    }
> {
  let aliasToUse: AliasToUse | undefined;

  let lastReason: RequestFailedReason | UnavailableAliasReason | undefined;

  while ((aliasToUse = aliasManager.findAliasToUse())) {
    const fetchResult = await fetchFromAlias({
      alias: aliasToUse,
      urlSuffix,
      post,
      timeout,
    });

    if (fetchResult.success) {
      aliasManager.markAliasAsAvailable(aliasToUse.baseUrl);
      return fetchResult;
    }

    if (
      fetchResult.reason === "methodQuotaExceeded" ||
      fetchResult.reason === "notFound" ||
      fetchResult.reason === "unauthorized"
    ) {
      aliasManager.markAliasAsAvailable(aliasToUse.baseUrl);
      return { success: false, reason: fetchResult.reason };
    }

    aliasManager.markAliasAsUnavailable(aliasToUse.baseUrl, fetchResult.reason);
    lastReason = fetchResult.reason;
  }

  if (lastReason === "tooManyRequests") {
    return { success: false, reason: lastReason };
  }

  return { success: false, reason: "noAliasToUse" };
}
