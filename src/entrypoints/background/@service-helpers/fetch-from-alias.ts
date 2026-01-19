import type { JsonValue } from "type-fest";

import { getAppConfig } from "@/shared/app-config";
import { getBackgroundLogger } from "@/shared/logging";

import type { AliasToUse, UnavailableAliasReason } from "./alias-manager";

const logger = getBackgroundLogger(["fetch-from-alias"]);

export async function fetchFromAlias({
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
      reason: UnavailableAliasReason;
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

  if (response.status === 403) {
    return { success: false, reason: "blockedByFirewall" };
  }

  if (
    response.status === 429 &&
    response.headers.get("x-vercel-mitigated") === "challenge"
  ) {
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
