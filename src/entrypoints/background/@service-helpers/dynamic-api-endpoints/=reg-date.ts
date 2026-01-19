import { z } from "zod/mini";

import {
  isoDateSchema,
  isoTimeSchema,
  type PositiveVkId,
} from "@/shared/@model/primitives";
import { getBackgroundLogger } from "@/shared/logging";

import { parseLegacyRegisteredAt } from "./=reg-date/parse-legacy-registered-at";
import { normalizeLegacyError } from "./normalize-legacy-error";
import {
  dynamicApiBaseErrorKinds,
  type DynamicApiEndpointDefinition,
} from "./types";

const logger = getBackgroundLogger(["dynamic-api-endpoints", "reg-date"]);

export const legacyResponseBodySchema = z.xor([
  z.readonly(z.object({ registeredAt: z.string() })), // e.g. "10:02:10 20.8.2024" or "18.10.2025"
  z.readonly(z.object({ error: z.string() })),
]);

export const regDateErrorKindSchema = z.enum([
  ...dynamicApiBaseErrorKinds,
  "methodQuotaExceeded",
  "missingPermission",
  "notApplicableToNegativeVkIds",
  "notFound",
  "notYetKnown",
]);

export const responseBodySchema = z.union([
  z.readonly(
    z.object({
      data: z.union([isoDateSchema, isoTimeSchema]),
    }),
  ),
  z.readonly(
    z.object({
      errorKind: regDateErrorKindSchema,
      errorMessage: z.string(),
    }),
  ),
]);

export const regDateEndpointDefinition: DynamicApiEndpointDefinition<
  { vkId: PositiveVkId },
  typeof responseBodySchema,
  typeof legacyResponseBodySchema
> = {
  generateUrlSuffix: ({ vkId }) => `/reg-date/${vkId}`,
  responseBodySchema,

  legacyResponseBodySchema,
  convertLegacyResponseBodyToResponseBody: (legacyResponse) => {
    if ("error" in legacyResponse) {
      return normalizeLegacyError(legacyResponse.error, regDateErrorKindSchema);
    }

    if ("registeredAt" in legacyResponse) {
      const isoTimeOrDate = parseLegacyRegisteredAt(
        legacyResponse.registeredAt,
      );

      if (isoTimeOrDate) {
        return { data: isoTimeOrDate };
      }
    }

    logger.error("Unexpected error while parsing legacy response body", {
      legacyResponse,
    });

    return {
      errorKind: "unexpectedError",
      errorMessage: "Ошибка при получении даты регистрации",
    };
  },
  generateLegacyUrlSuffix: ({ vkId }) => `/?t=reg_date&id=${vkId}`,
};
