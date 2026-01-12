import { createPollableValueHook } from "@/lib/create-pollable-value-hook";
import { popupService } from "@/lib/proxy-services";

export const useActivePopupTab = createPollableValueHook(
  (lastPollVersion) => popupService.pollActiveTab(lastPollVersion),
  { hookNameForDebugging: "useActivePopupTab" },
);
