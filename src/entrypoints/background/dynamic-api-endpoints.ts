import { accessEndpointDefinition } from "./dynamic-api-endpoints/=access";
import { inspectorEndpointDefinition } from "./dynamic-api-endpoints/=inspector";
import { regDateEndpointDefinition } from "./dynamic-api-endpoints/=reg-date";
import type { DynamicApiEndpointDefinition } from "./dynamic-api-endpoints/types";

export const dynamicApiEndpointDefinitionLookup = {
  access: accessEndpointDefinition,
  inspector: inspectorEndpointDefinition,
  regDate: regDateEndpointDefinition,
} satisfies Record<string, DynamicApiEndpointDefinition>;

export type DynamicApiEndpointDefinitionLookup =
  typeof dynamicApiEndpointDefinitionLookup;

export type DynamicEndpointKey =
  keyof typeof dynamicApiEndpointDefinitionLookup;
