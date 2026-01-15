import { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/logging";
import {
  isoDateSchema,
  isoTimeSchema,
  type PositiveVkId,
} from "@/shared/primitive-values";

import { parseLegacyRegisteredAt } from "./=reg-date/parse-legacy-registered-at";
import type { DynamicApiEndpointDefinition } from "./types";

const logger = getBackgroundLogger(["dynamic-api-endpoints", "reg-date"]);

export const responseSchema = z.xor([
  isoDateSchema,
  isoTimeSchema,
  z.literal("notYetKnown"),
]);

export const legacyResponseSchema = z.xor([
  z.readonly(z.object({ registeredAt: z.string() })), // e.g. "10:02:10 20.8.2024" or "18.10.2025"
  z.readonly(z.object({ error: z.string() })),
]);

export const regDateEndpointDefinition: DynamicApiEndpointDefinition<
  { vkId: PositiveVkId },
  typeof responseSchema,
  typeof legacyResponseSchema
> = {
  generateUrlSuffix: ({ vkId }) => `/reg-date/${vkId}`,
  responseBodySchema: responseSchema,

  legacyResponseBodySchema: legacyResponseSchema,
  convertLegacyResponseBodyToResponseBody: (legacyResponse) => {
    if ("registeredAt" in legacyResponse) {
      const isoTimeOrDate = parseLegacyRegisteredAt(
        legacyResponse.registeredAt,
      );

      if (!isoTimeOrDate) {
        logger.error(
          "Unexpected error while parsing legacy registered at: {registeredAt}",
          { registeredAt: legacyResponse.registeredAt },
        );
        return {
          success: false,
          reason: "unexpectedError",
        };
      }

      return {
        success: true,
        data: isoTimeOrDate,
      };
    }

    logger.warn("Unexpected error in response: {error}", {
      error: legacyResponse.error,
    });

    return {
      success: false,
      reason: "unexpectedError",
    };
  },
  generateLegacyUrlSuffix: ({ vkId }) => `/?t=reg_date&id=${vkId}`,
};
