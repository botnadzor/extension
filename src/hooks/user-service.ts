import { createPollableValueHook } from "@/lib/create-pollable-value-hook";
import { userService } from "@/lib/proxy-services";

export const useUserConfig = createPollableValueHook(
  (lastPollVersion) => userService.pollConfig(lastPollVersion),
  { hookNameForDebugging: "useUserConfig" },
);

export const useAuthStatus = createPollableValueHook(
  (lastPollVersion) => userService.pollAuthStatus(lastPollVersion),
  { hookNameForDebugging: "useAuthStatus" },
);

export const useAuthCheck = createPollableValueHook(
  (lastPollVersion) => userService.pollAuthCheck(lastPollVersion),
  { hookNameForDebugging: "useAuthCheck" },
);
