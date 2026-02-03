import type { JsonValue } from "type-fest";

import { getBackgroundLogger } from "@/shared/logging";

import type { AliasToUse, UnavailableAliasReason } from "./alias-manager";

const logger = getBackgroundLogger(["fetch-from-alias"]);

export async function fetchFromAlias({
  alias,
  init,
  post,
  signalOrTimeout,
  urlSuffix,
}: {
  alias: AliasToUse;
  init?: RequestInit | undefined;
  post?: JsonValue | undefined;
  signalOrTimeout?: AbortSignal | number | undefined;
  urlSuffix: string;
}): Promise<
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
  } catch {
    return { success: false, reason: "connectionFailed" };
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 403) {
    return { success: false, reason: "blockedByFirewall" };
  }

  if (response.status === 429) {
    return { success: false, reason: "tooManyRequests" };
  }

  if (response.status >= 500) {
    logger.error("Server error {status} from {url}", {
      status: response.status,
      url,
    });

    return { success: false, reason: "serverError" };
  }

  return { success: true, response };
}
