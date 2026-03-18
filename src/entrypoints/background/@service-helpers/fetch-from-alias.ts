import type { JsonValue } from "type-fest";

import { getBackgroundLogger } from "@/shared/@logging/categories";

import type { AliasToUse, UnavailableAliasReason } from "./alias-manager";

const logger = getBackgroundLogger(["fetch-from-alias"]);

type FetchFromAliasPayload = {
  alias: AliasToUse;
  init?: RequestInit | undefined;
  post?: JsonValue | undefined;
  signalOrTimeout?: AbortSignal | number | undefined;
  urlSuffix: string;
};

type FetchFromAliasResult =
  | {
      success: true;
      response: Response;
    }
  | {
      success: false;
      reason: UnavailableAliasReason;
      error?: unknown;
      status?: number;
    };

async function doFetchFromAlias({
  alias,
  init,
  post,
  signalOrTimeout,
  urlSuffix,
}: FetchFromAliasPayload): Promise<FetchFromAliasResult> {
  const url = alias.baseUrl + urlSuffix;

  const controller = new AbortController();
  const timeoutId =
    typeof signalOrTimeout === "number"
      ? setTimeout(() => {
          controller.abort();
        }, signalOrTimeout)
      : undefined;

  const signal =
    typeof signalOrTimeout === "number" ? controller.signal : signalOrTimeout;

  let response: Response;
  try {
    response = await fetch(url, {
      method: post ? "POST" : "GET",
      ...(post ? { body: JSON.stringify(post) } : {}),
      ...(signal ? { signal } : {}),
      ...init,
    });
  } catch (error) {
    return { success: false, reason: "connectionFailed", error };
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 403) {
    return {
      success: false,
      reason: "blockedByFirewall",
      status: response.status,
    };
  }

  if (response.status === 429) {
    return {
      success: false,
      reason: "tooManyRequests",
      status: response.status,
    };
  }

  if (response.status >= 500) {
    return {
      success: false,
      reason: "serverError",
      status: response.status,
    };
  }

  return { success: true, response };
}

export async function fetchFromAlias({
  alias,
  init,
  post,
  signalOrTimeout,
  urlSuffix,
}: FetchFromAliasPayload): Promise<
  | {
      success: true;
      response: Response;
    }
  | {
      success: false;
      reason: UnavailableAliasReason;
    }
> {
  const url = alias.baseUrl + urlSuffix;
  const result = await doFetchFromAlias({
    alias,
    init,
    post,
    signalOrTimeout,
    urlSuffix,
  });

  if (result.success) {
    logger.debug("Request to {url} succeeded", { url });

    return result;
  }

  logger.warn("Request to {url} failed: {reason}", {
    ...(result.error ? { error: result.error } : {}),
    reason: result.reason,
    ...(result.status ? { status: result.status } : {}),
    url,
  });

  return {
    success: false,
    reason: result.reason,
  };
}
