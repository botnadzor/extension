import { createPollableValueHook } from "@/lib/create-pollable-value-hook";
import { frontendService } from "@/lib/proxy-services";

export const useFrontendBaseUrl = createPollableValueHook(
  (lastPollVersion) => frontendService.pollBaseUrl(lastPollVersion),
  { hookNameForDebugging: "useFrontendBaseUrl" },
);
