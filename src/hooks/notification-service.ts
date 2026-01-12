import { useContentId } from "@/hooks/content-id-context";
import { createPollableValueHook } from "@/lib/create-pollable-value-hook";
import type { ContentId } from "@/lib/primitive-values";
import { notificationService } from "@/lib/proxy-services";
import type { TriggeredNotification } from "@/services/notification-service";

export const useGlobalNotificationsState = createPollableValueHook(
  (lastPollVersion) =>
    notificationService.pollGlobalNotificationsState(lastPollVersion),
  { hookNameForDebugging: "useGlobalNotificationsState" },
);

const useTriggeredNotificationInner = createPollableValueHook(
  (lastPollVersion, contentId: ContentId) =>
    notificationService.pollTriggeredNotification(lastPollVersion, contentId),
  { hookNameForDebugging: "useTriggeredNotification" },
);

export function useTriggeredNotification(): TriggeredNotification | undefined {
  const contentId = useContentId();
  return useTriggeredNotificationInner(contentId);
}
