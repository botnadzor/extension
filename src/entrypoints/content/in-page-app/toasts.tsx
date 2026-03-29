import * as React from "react";

import { createPollableValueHook } from "@/shared/@pollable/react";
import type { ContentId } from "@/shared/@primitives/misc";
import {
  useExtensionVersionInfo,
  useFilteredAnnouncements,
  useGlobalNotificationsState,
  useStaticListsDataIssueState,
} from "@/shared/@ui-helpers/data-hooks";
import {
  notificationService,
  staticListsService,
} from "@/shared/proxy-services";

import { useContentId } from "../content-id-context";
import { ToastWithAnnouncement } from "./toasts/toast-with-announcement";
import { ToastWithDataWarmup } from "./toasts/toast-with-data-warmup";
import { ToastWithDeprecatedExtensionVersion } from "./toasts/toast-with-deprecated-extension-version";
import { ToastWithStaticDataIssue } from "./toasts/toast-with-static-data-issue";
import { ToastWithTriggeredNotification } from "./toasts/toast-with-triggered-notification";
import { ToastWithWelcomeMessage } from "./toasts/toast-with-welcome-message";

export async function checkIfDataWarmupToastNeeded(): Promise<boolean> {
  const [accountsUpdatedAt, insertionsUpdatedAt, tagsUpdatedAt] =
    await Promise.all([
      staticListsService.getListUpdatedAt("accounts"),
      staticListsService.getListUpdatedAt("insertions"),
      staticListsService.getListUpdatedAt("tags"),
    ]);

  return !accountsUpdatedAt || !insertionsUpdatedAt || !tagsUpdatedAt;
}

const useTriggeredNotification = createPollableValueHook(
  (lastPollVersion, contentId: ContentId) =>
    notificationService.pollTriggeredNotification(lastPollVersion, contentId),
  { hookNameForDebugging: "useTriggeredNotification" },
);

function ToastsAfterTriggeredNotification({
  announcements,
  announcementReadAtByCreatedAt,
  dataWarmupToastNeeded,
  extensionVersionInfo,
  onDataWarmupDone,
  welcomeMessageReadAt,
}: {
  announcements: ReturnType<typeof useFilteredAnnouncements>;
  announcementReadAtByCreatedAt: Record<string, string | undefined>;
  dataWarmupToastNeeded: boolean;
  extensionVersionInfo: ReturnType<typeof useExtensionVersionInfo>;
  onDataWarmupDone: () => void;
  welcomeMessageReadAt: string | undefined;
}) {
  const dataIssueState = useStaticListsDataIssueState();

  if (dataIssueState.kind === "initialDataUnavailable") {
    return <ToastWithStaticDataIssue />;
  }

  if (!welcomeMessageReadAt) {
    return <ToastWithWelcomeMessage />;
  }

  if (dataWarmupToastNeeded) {
    return (
      <ToastWithDataWarmup
        onDone={() => {
          onDataWarmupDone();
        }}
      />
    );
  }

  const announcementToShow = announcements
    // Show older announcements first
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
    .find(
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
      <ToastWithDeprecatedExtensionVersion
        {...extensionVersionInfo}
        deprecation={extensionVersionInfo.deprecation}
      />
    );
  }

  return;
}

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

  return (
    <React.Suspense>
      <ToastsAfterTriggeredNotification
        announcements={announcements}
        announcementReadAtByCreatedAt={announcementReadAtByCreatedAt}
        dataWarmupToastNeeded={dataWarmupToastNeeded}
        extensionVersionInfo={extensionVersionInfo}
        onDataWarmupDone={() => {
          setDataWarmupToastNeeded(false);
        }}
        welcomeMessageReadAt={welcomeMessageReadAt}
      />
    </React.Suspense>
  );
}
