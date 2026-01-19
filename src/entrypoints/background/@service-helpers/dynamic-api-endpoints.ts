import type { z } from "zod/mini";

import { accessEndpointDefinition } from "./dynamic-api-endpoints/=access";
import { inspectorEndpointDefinition } from "./dynamic-api-endpoints/=inspector";
import { regDateEndpointDefinition } from "./dynamic-api-endpoints/=reg-date";
import { reportEndpointDefinition } from "./dynamic-api-endpoints/=report";
import type { DynamicApiEndpointDefinition } from "./dynamic-api-endpoints/types";

export const dynamicApiEndpointDefinitionLookup = {
  access: accessEndpointDefinition,
  inspector: inspectorEndpointDefinition,
  regDate: regDateEndpointDefinition,
  report: reportEndpointDefinition,
} satisfies Record<string, DynamicApiEndpointDefinition>;

export type DynamicApiEndpointDefinitionLookup =
  typeof dynamicApiEndpointDefinitionLookup;

export type DynamicEndpointKey =
  keyof typeof dynamicApiEndpointDefinitionLookup;

export type DynamicApiEndpointResponse<Key extends DynamicEndpointKey> =
  z.infer<DynamicApiEndpointDefinitionLookup[Key]["responseBodySchema"]>;

export {
  type DynamicApiEndpointDefinition,
  type DynamicApiResponse,
} from "./dynamic-api-endpoints/types";
