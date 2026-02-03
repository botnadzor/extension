import type {
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from "@orpc/contract";

import { contractForCollect } from "./dynamic-api-endpoints/=collect";
import { contractForGetMe } from "./dynamic-api-endpoints/=get-me";
import { contractForGetRegDate } from "./dynamic-api-endpoints/=get-reg-date";
import { contractForInspectAccount } from "./dynamic-api-endpoints/=inspect-account";
import { contractForReportAccount } from "./dynamic-api-endpoints/=report-account";
import type { UnavailableRemoteSystemReason } from "./fetch-from-remote-system";

export * as problemLookup from "./dynamic-api-endpoints/problems";

export const orpcContractLookup = {
  collect: contractForCollect,
  getMe: contractForGetMe,
  getRegDate: contractForGetRegDate,
  inspectAccount: contractForInspectAccount,
  reportAccount: contractForReportAccount,
};

export type DynamicApiEndpointKey = keyof typeof orpcContractLookup;

type GetBody<T> = T extends { body: infer B } ? B : never;

export type DynamicApiEndpointInput<
  Method extends keyof typeof orpcContractLookup,
> = Omit<
  GetBody<InferContractRouterInputs<(typeof orpcContractLookup)[Method]>>,
  "accessCode"
>;

export type DynamicApiEndpointOutput<
  Method extends keyof typeof orpcContractLookup,
> = GetBody<InferContractRouterOutputs<(typeof orpcContractLookup)[Method]>>;

export type ContractProblem = {
  problem: true;
  type: "bn:ext:local:contract-error";
  description: string;
};

export type RemoteSystemUnavailableProblem = {
  problem: true;
  type: "bn:ext:local:remote-system-unavailable";
  description: string;
  reason: UnavailableRemoteSystemReason;
};

export type DynamicApiEndpointOutcome<
  Method extends keyof typeof orpcContractLookup,
> =
  | DynamicApiEndpointOutput<Method>
  | RemoteSystemUnavailableProblem
  | ContractProblem;
