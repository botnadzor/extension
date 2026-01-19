import type { JsonObject, JsonValue } from "type-fest";
import type { z } from "zod/mini";

import { unavailableRemoteSystemReasons } from "../fetch-from-remote-system";

export const dynamicApiBaseErrorKinds = [
  ...unavailableRemoteSystemReasons,
  "unauthorized",
  "unexpectedError",
] as const;
export type DynamicApiBaseErrorKind = (typeof dynamicApiBaseErrorKinds)[number];

export type DynamicApiResponse<
  Data extends JsonValue = JsonValue,
  ErrorKind extends string = DynamicApiBaseErrorKind,
> = { data: Data } | { errorKind: ErrorKind; errorMessage: string };

export type DynamicApiEndpointDefinition<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- allow usage of definitions interchangeably
  Payload extends object = any,
  ResponseBodySchema extends z.ZodMiniType<
    DynamicApiResponse<JsonValue, string>
  > = z.ZodMiniType<DynamicApiResponse<JsonValue, string>>,
  LegacyResponseBodySchema extends z.ZodMiniType = z.ZodMiniType,
> = {
  generatePostBody?: (payload: Payload) => JsonObject;
  generateUrlSuffix: (payload: Payload) => string;
  responseBodySchema: ResponseBodySchema;

  // TODO: Remove these fields after updating API endpoints on the server
  legacyResponseBodySchema: LegacyResponseBodySchema;
  convertLegacyResponseBodyToResponseBody: (
    legacyResponse: z.infer<LegacyResponseBodySchema>,
  ) => z.infer<ResponseBodySchema>;
  generateLegacyUrlSuffix: (payload: Payload) => string;
};
