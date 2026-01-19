import { z } from "zod/mini";

import {
  legacyPermissionsSchema,
  mapLegacyPermissionsToPermissionLookup,
  permissionLookupSchema,
} from "@/shared/@model/auth";
import { isoTimeSchema } from "@/shared/@model/primitives";

import { normalizeLegacyError } from "./normalize-legacy-error";
import {
  dynamicApiBaseErrorKinds,
  type DynamicApiEndpointDefinition,
} from "./types";

const legacyResponseBodySchema = z.union([
  z.readonly(z.object({ error: z.string() })),
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

export const accessErrorKindSchema = z.enum(dynamicApiBaseErrorKinds);

const responseBodySchema = z.union([
  z.readonly(
    z.object({
      data: z.readonly(
        z.object({
          accessLevel: z.number().check(z.nonnegative()),
          expiresAt: z.exactOptional(isoTimeSchema),
          pointCount: z.number().check(z.nonnegative()),
          permissionLookup: permissionLookupSchema,
        }),
      ),
    }),
  ),
  z.readonly(
    z.object({
      errorKind: accessErrorKindSchema,
      errorMessage: z.string(),
    }),
  ),
]);

export const accessEndpointDefinition: DynamicApiEndpointDefinition<
  Record<string, never>,
  typeof responseBodySchema,
  typeof legacyResponseBodySchema
> = {
  generateUrlSuffix: () => "/access",
  responseBodySchema,

  legacyResponseBodySchema,
  convertLegacyResponseBodyToResponseBody: (legacyResponse) => {
    if ("error" in legacyResponse) {
      return normalizeLegacyError(legacyResponse.error, accessErrorKindSchema);
    }

    const { access, points, permissions } = legacyResponse.response;

    return {
      data: {
        accessLevel: Number(access),
        pointCount: Number(points),
        permissionLookup: mapLegacyPermissionsToPermissionLookup(permissions),
      },
    };
  },
  generateLegacyUrlSuffix: () => "/?t=getMe",
};
