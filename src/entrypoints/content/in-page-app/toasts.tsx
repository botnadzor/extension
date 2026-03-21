import * as React from "react";

import { createPollableValueHook } from "@/shared/@pollable/react";
import type { ContentId } from "@/shared/@primitives/misc";
import {
  useExtensionVersionInfo,
  useFilteredAnnouncements,
  useGlobalNotificationsState,
} from "@/shared/@ui-helpers/data-hooks";
import {
  notificationService,
  staticListsService,
} from "@/shared/proxy-services";

import { useContentId } from "../content-id-context";
import { ToastWithAnnouncement } from "./toasts/toast-with-announcement";
import { ToastWithDataWarmup } from "./toasts/toast-with-data-warmup";
import { ToastWithDeprecatedExtensionVersion } from "./toasts/toast-with-deprecated-extension-version";
import { ToastWithTriggeredNotification } from "./toasts/toast-with-triggered-notification";
import { ToastWithWelcomeMessage } from "./toasts/toast-with-welcome-message";

export async function checkIfDataWarmupToastNeeded(): Promise<boolean> {
  const [accountsMetadata, insertionsMetadata, tagsMetadata] =
    await Promise.all([
      staticListsService.getListMetadata("accounts"),
      staticListsService.getListMetadata("insertions"),
      staticListsService.getListMetadata("tags"),
    ]);

  return (
    !accountsMetadata.remoteActive ||
    !insertionsMetadata.remoteActive ||
    !tagsMetadata.remoteActive
  );
}

const useTriggeredNotification = createPollableValueHook(
  (lastPollVersion, contentId: ContentId) =>
    notificationService.pollTriggeredNotification(lastPollVersion, contentId),
  { hookNameForDebugging: "useTriggeredNotification" },
);

export function Toasts() {
  const announcements = useFilteredAnnouncements("toast");
  const contentId = useContentId();
  const triggeredNotification = useTriggeredNotification(contentId);
  const extensionVersionInfo = useExtensionVersionInfo();

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
          onDone={() => {
            setDataWarmupToastNeeded(false);
          }}
        />
      </React.Suspense>
    );
  }

  const announcementToShow = announcements.find(
    ({ createdAt }) =>
      !announcementReadAtByCreatedAt[createdAt] &&
      createdAt > welcomeMessageReadAt,
  );

  if (announcementToShow) {
    return (
      <ToastWithAnnouncement
        key={announcementToShow.createdAt}
        {...announcementToShow}
      />
    );
  }

  if (extensionVersionInfo.deprecation) {
    return (
      <React.Suspense>
        <ToastWithDeprecatedExtensionVersion
          {...extensionVersionInfo}
          deprecation={extensionVersionInfo.deprecation}
        />
      </React.Suspense>
    );
  }

  return;
}
