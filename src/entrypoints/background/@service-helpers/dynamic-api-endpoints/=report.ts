import { z } from "zod/mini";

import {
  legacyPermissionsSchema,
  mapLegacyPermissionsToPermissionLookup,
  permissionLookupSchema,
} from "@/shared/@model/auth";
import type { VkDomain, VkId } from "@/shared/@model/primitives";

import { normalizeLegacyError } from "./normalize-legacy-error";
import {
  dynamicApiBaseErrorKinds,
  type DynamicApiEndpointDefinition,
} from "./types";

const legacyResponseBodySchema = z.union([
  z.readonly(z.object({ error: z.string() })),
  z.readonly(
    z.object({
      response: z.readonly(
        z.object({
          msg: z.string(),
          points_left: z.exactOptional(z.number()),
          permission_left: z.exactOptional(legacyPermissionsSchema),
        }),
      ),
    }),
  ),
]);

export const reportErrorKindSchema = z.enum([
  ...dynamicApiBaseErrorKinds,
  "alreadyConfirmed",
  "invalidPayload",
  "invalidTagSuggestion",
  "invalidText",
  "methodQuotaExceeded",
  "missingPermission",
  "notFound",
  "recentlyChecked",
]);

export const responseBodySchema = z.union([
  z.readonly(
    z.object({
      data: z.readonly(
        z.object({
          message: z.string(),
          remainingPermissionLookup: z.exactOptional(permissionLookupSchema),
          remainingPoints: z.exactOptional(z.number()),
        }),
      ),
    }),
  ),
  z.readonly(
    z.object({
      errorKind: reportErrorKindSchema,
      errorMessage: z.string(),
    }),
  ),
]);

export const reportEndpointDefinition: DynamicApiEndpointDefinition<
  { vkDomainOrId: VkDomain | VkId; text: string; type: string; link: string },
  typeof responseBodySchema,
  typeof legacyResponseBodySchema
> = {
  generateUrlSuffix: ({ vkDomainOrId }) => `/report/${vkDomainOrId}`,
  generatePostBody: ({ text, type, link }) => ({ text, type, link }),
  responseBodySchema,

  legacyResponseBodySchema,
  convertLegacyResponseBodyToResponseBody: (legacyResponse) => {
    if ("error" in legacyResponse) {
      return normalizeLegacyError(legacyResponse.error, reportErrorKindSchema);
    }

    return {
      data: {
        message: legacyResponse.response.msg,

        ...(legacyResponse.response.permission_left
          ? {
              remainingPermissionLookup: mapLegacyPermissionsToPermissionLookup(
                legacyResponse.response.permission_left,
              ),
            }
          : {}),

        ...(legacyResponse.response.points_left
          ? { remainingPoints: legacyResponse.response.points_left }
          : {}),
      },
    };
  },
  generateLegacyUrlSuffix: ({ vkDomainOrId }) =>
    `/?t=report&id=${vkDomainOrId}`,
};
