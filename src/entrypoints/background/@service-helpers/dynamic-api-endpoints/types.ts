import type { JsonObject } from "type-fest";
import type { z } from "zod/mini";

export type ResponseConversionResult<ResponseBodySchema extends z.ZodMiniType> =
  | {
      success: true;
      data: z.infer<ResponseBodySchema>;
    }
  | {
      success: false;
      reason:
        | "methodQuotaExceeded"
        | "missingPermission"
        | "notFound"
        | "tooManyRequests"
        | "unauthorized"
        | "unexpectedError";
    };

export type DynamicApiEndpointDefinition<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- allow usage of definitions interchangeably
  Payload extends object = any,
  ResponseBodySchema extends z.ZodMiniType = z.ZodMiniType,
  LegacyResponseBodySchema extends z.ZodMiniType = z.ZodMiniType,
> = {
  generatePostBody?: (payload: Payload) => JsonObject;
  generateUrlSuffix: (payload: Payload) => string;
  responseBodySchema: ResponseBodySchema;

  // TODO: Remove these fields after updating API endpoints on the server
  legacyResponseBodySchema: LegacyResponseBodySchema;
  convertLegacyResponseBodyToResponseBody: (
    legacyResponse: z.infer<LegacyResponseBodySchema>,
  ) => ResponseConversionResult<ResponseBodySchema>;
  generateLegacyUrlSuffix: (payload: Payload) => string;
};
