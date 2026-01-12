import { z } from "zod/mini";

import { isoTimeSchema } from "@/lib/primitive-values";

import {
  legacyPermissionsSchema,
  mapLegacyPermissionsToPermissionLookup,
  permissionLookupSchema,
} from "../../../lib/permissions";
import { convertLegacyErrorToDynamicApiError } from "./helpers";
import type { DynamicApiEndpointDefinition } from "./types";

const responseSchema = z.readonly(
  z.object({
    accessLevel: z.number().check(z.nonnegative()),
    expiresAt: z.exactOptional(isoTimeSchema),
    pointCount: z.number().check(z.nonnegative()),
    permissionLookup: permissionLookupSchema,
  }),
);

const legacyResponseSchema = z.xor([
  z.readonly(
    z.object({
      error: z.string(),
    }),
  ),
  z.readonly(
    z.object({
      response: z.object({
        access: z.string(),
        points: z.string(),
        permissions: legacyPermissionsSchema,
      }),
    }),
  ),
]);

export const accessEndpointDefinition: DynamicApiEndpointDefinition<
  Record<string, never>,
  typeof responseSchema,
  typeof legacyResponseSchema
> = {
  generateUrlSuffix: () => "/access",
  responseBodySchema: responseSchema,

  legacyResponseBodySchema: legacyResponseSchema,
  convertLegacyResponseBodyToResponseBody: (legacyResponse) => {
    if ("error" in legacyResponse) {
      return convertLegacyErrorToDynamicApiError(legacyResponse.error);
    }

    const { access, points, permissions } = legacyResponse.response;

    return {
      success: true,
      data: {
        accessLevel: Number(access),
        pointCount: Number(points),
        permissionLookup: mapLegacyPermissionsToPermissionLookup(permissions),
      },
    };
  },
  generateLegacyUrlSuffix: () => "/?t=getMe",
};
