import { createORPCClient, createSafeClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { ResponseValidationPlugin } from "@orpc/contract/plugins";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { kebabCase } from "es-toolkit";
import type { JsonObject } from "type-fest";

import type { AuthInput } from "@/shared/@model/auth";

import type { AliasManager } from "./alias-manager";
import { orpcContractLookup } from "./dynamic-api-endpoints";
import {
  errorMessageByUnavailableRemoteSystemReason,
  fetchFromRemoteSystem,
  type UnavailableRemoteSystemReason,
} from "./fetch-from-remote-system";

type OrpcContext = {
  authInput: AuthInput;
  aliasManager: AliasManager;
};

export class OrpcErrorRemoteSystemUnavailable extends Error {
  readonly reason: UnavailableRemoteSystemReason;

  constructor(message: string, reason: UnavailableRemoteSystemReason) {
    super(message);
    this.name = "OrpcErrorRemoteSystemUnavailable";
    this.message = message;
    this.reason = reason;
  }
}

const orpcLink = new OpenAPILink<OrpcContext>(orpcContractLookup, {
  fetch: async (
    request,
    init,
    { context: { authInput, aliasManager }, signal },
    path,
    input,
  ) => {
    const fetchResult = await fetchFromRemoteSystem({
      aliasManager,
      init,
      post: {
        ...(authInput.accessCode.length > 0
          ? { accessCode: authInput.accessCode }
          : {}),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- input schemas in contract use z.object() or z.undefined(), so the input can be safely spread
        ...(input as JsonObject | undefined),
      },
      signal,
      urlSuffix: `/${path.map((segment) => kebabCase(segment)).join("/")}`,
    });

    if (fetchResult.success) {
      return fetchResult.response;
    }

    // eslint-disable-next-line no-restricted-syntax -- third-party requirement (converted to data | error by SafeClient)
    throw new OrpcErrorRemoteSystemUnavailable(
      errorMessageByUnavailableRemoteSystemReason[fetchResult.reason],
      fetchResult.reason,
    );
  },
  plugins: [new ResponseValidationPlugin(orpcContractLookup)],
  url: "https://example.com", // added for compliance with TS signature but not used; see custom fetch function above for details
});

export const orpcClient = createSafeClient<
  ContractRouterClient<typeof orpcContractLookup, OrpcContext>
>(createORPCClient(orpcLink));
