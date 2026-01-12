import { createPollableValueHook } from "@/lib/create-pollable-value-hook";
import type { ContentId, VkDomain } from "@/lib/primitive-values";
import { inspectorService } from "@/lib/proxy-services";

export const useInspectorInstanceConfig = createPollableValueHook(
  (lastPollVersion, contentId: ContentId) =>
    inspectorService.pollInstanceConfig(lastPollVersion, contentId),
  { hookNameForDebugging: "useInspectorInstanceConfig" },
);

export const useAccountInspection = createPollableValueHook(
  (lastPollVersion, vkDomain: VkDomain) =>
    inspectorService.pollAccountInspection(lastPollVersion, vkDomain),
  { hookNameForDebugging: "useAccountInspection" },
);
