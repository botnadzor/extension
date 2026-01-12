import * as React from "react";
import semverSatisfies from "semver/functions/satisfies";

import { Button } from "@/components/ui/button";
import { useContentId } from "@/hooks/content-id-context";
import {
  useGlobalNotificationsState,
  useTriggeredNotification,
} from "@/hooks/notification-service";
import {
  useStaticListItems,
  useStaticListMetadata,
} from "@/hooks/static-lists-service";
import { getAppConfig } from "@/lib/app-config";
import { notificationService } from "@/lib/proxy-services";

import { ToastWithAnnouncement } from "./toasts/toast-with-announcement";
import { ToastWithDataWarmup } from "./toasts/toast-with-data-warmup";
import { ToastWithTriggeredNotification } from "./toasts/toast-with-triggered-notification";
import { ToastWithWelcomeMessage } from "./toasts/toast-with-welcome-message";

export function Toasts() {
  const announcements = useStaticListItems("announcements");
  const contentId = useContentId();
  const triggeredNotification = useTriggeredNotification();
  const globalNotificationsState = useGlobalNotificationsState();
  const accountsMetadata = useStaticListMetadata("accounts");
  const tagsMetadata = useStaticListMetadata("tags");

  const [dataWarmupToastNeeded, setDataWarmupToastNeeded] =
    React.useState(false);

  if (
    (!accountsMetadata.active || !tagsMetadata.active) &&
    !dataWarmupToastNeeded
  ) {
    setDataWarmupToastNeeded(true);
    return;
  }

  if (triggeredNotification) {
    return (
      <React.Suspense>
        <ToastWithTriggeredNotification {...triggeredNotification} />
      </React.Suspense>
    );
  }

  const { welcomeMessageReadAt, announcementReadAtByCreatedAt } =
    globalNotificationsState;

  if (!welcomeMessageReadAt) {
    return <ToastWithWelcomeMessage />;
  }

  if (dataWarmupToastNeeded) {
    return (
      <ToastWithDataWarmup
        accountsMetadata={accountsMetadata}
        tagsMetadata={tagsMetadata}
        onClose={() => {
          setDataWarmupToastNeeded(false);
        }}
      />
    );
  }

  const announcementToShow = announcements.find(
    ({ createdAt, extensionVersionRangeForToast, extensionVersionRange }) =>
      !announcementReadAtByCreatedAt[createdAt] &&
      createdAt > welcomeMessageReadAt &&
      semverSatisfies(
        getAppConfig().extensionVersion,
        extensionVersionRangeForToast ?? extensionVersionRange,
        { includePrerelease: true },
      ),
  );

  if (announcementToShow) {
    return (
      <ToastWithAnnouncement
        key={announcementToShow.createdAt}
        {...announcementToShow}
      />
    );
  }

  if (!import.meta.env.DEV) {
    return;
  }

  return (
    <Button
      type="button"
      className={`
        fixed right-[10px] bottom-[10px] left-[10px] z-999999
        sm:right-auto
      `}
      onClick={() => {
        void notificationService.trigger(contentId, { type: "test" });
      }}
    >
      Показать тестовое уведомление
    </Button>
  );
}
