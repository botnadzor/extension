import * as React from "react";
import semverSatisfies from "semver/functions/satisfies";

import type { ContentId } from "@/shared/@model/primitives";
import { createPollableValueHook } from "@/shared/@pollable/react";
import {
  useGlobalNotificationsState,
  useStaticListItems,
} from "@/shared/@ui-helpers/data-hooks";
import { Button } from "@/shared/@ui-primitives/button";
import { getAppConfig } from "@/shared/app-config";
import {
  notificationService,
  staticListsService,
} from "@/shared/proxy-services";

import { useContentId } from "../content-id-context";
import { ToastWithAnnouncement } from "./toasts/toast-with-announcement";
import { ToastWithDataWarmup } from "./toasts/toast-with-data-warmup";
import { ToastWithTriggeredNotification } from "./toasts/toast-with-triggered-notification";
import { ToastWithWelcomeMessage } from "./toasts/toast-with-welcome-message";

export async function checkIfDataWarmupToastNeeded(): Promise<boolean> {
  const [accountsMetadata, tagsMetadata] = await Promise.all([
    staticListsService.getListMetadata("accounts"),
    staticListsService.getListMetadata("tags"),
  ]);

  return !accountsMetadata.active || !tagsMetadata.active;
}

const useTriggeredNotification = createPollableValueHook(
  (lastPollVersion, contentId: ContentId) =>
    notificationService.pollTriggeredNotification(lastPollVersion, contentId),
  { hookNameForDebugging: "useTriggeredNotification" },
);

export function Toasts() {
  const announcements = useStaticListItems("announcements");
  const contentId = useContentId();
  const triggeredNotification = useTriggeredNotification(contentId);

  const { welcomeMessageReadAt, announcementReadAtByCreatedAt } =
    useGlobalNotificationsState();
  const [welcomeMessageWasNeededAtMount] =
    React.useState(!welcomeMessageReadAt);
  const dataWarmupToastWasNeededPreviouslyRef = React.useRef(false);

  const [dataWarmupToastNeeded, setDataWarmupToastNeeded] =
    React.useState(false);

  React.useEffect(() => {
    void checkIfDataWarmupToastNeeded().then((needed) => {
      setDataWarmupToastNeeded(needed);
      if (needed) {
        dataWarmupToastWasNeededPreviouslyRef.current = true;
      }
    });
  }, [contentId, welcomeMessageReadAt]);

  React.useEffect(() => {
    if (
      dataWarmupToastNeeded ||
      !welcomeMessageReadAt ||
      (!welcomeMessageWasNeededAtMount &&
        !dataWarmupToastWasNeededPreviouslyRef.current)
    ) {
      return;
    }

    void notificationService.trigger(contentId, {
      type: "dataWarmupComplete",
    });
  }, [
    contentId,
    welcomeMessageWasNeededAtMount,
    dataWarmupToastWasNeededPreviouslyRef,
    dataWarmupToastNeeded,
    welcomeMessageReadAt,
  ]);

  if (triggeredNotification) {
    return (
      <React.Suspense>
        <ToastWithTriggeredNotification {...triggeredNotification} />
      </React.Suspense>
    );
  }

  if (!welcomeMessageReadAt) {
    return (
      <React.Suspense>
        <ToastWithWelcomeMessage />
      </React.Suspense>
    );
  }

  if (dataWarmupToastNeeded) {
    return (
      <React.Suspense>
        <ToastWithDataWarmup
          onClose={() => {
            setDataWarmupToastNeeded(false);
          }}
        />
      </React.Suspense>
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
