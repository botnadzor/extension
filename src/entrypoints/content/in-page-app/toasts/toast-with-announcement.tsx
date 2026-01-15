import Markdown from "marked-react";
import * as React from "react";

import { formatDate } from "@/shared/formatting";
import { useFrontendBaseUrl } from "@/shared/pollable-value-hooks";
import { notificationService } from "@/shared/proxy-services";
import type { StaticListItem } from "@/shared/static-lists";

import { Toast } from "./toast";

export function ToastWithAnnouncement({
  createdAt,
  header,
  content,
}: StaticListItem<"announcements">) {
  const frontendBaseUrl = useFrontendBaseUrl();

  const handleClose = React.useCallback(() => {
    void notificationService.markAnnouncementAsRead(createdAt);
  }, [createdAt]);

  return (
    <Toast header={header} onClose={handleClose}>
      <div className="-mt-1 pb-1 font-play text-xs text-muted-foreground">
        {formatDate(createdAt)}
      </div>
      <Markdown baseURL={frontendBaseUrl} value={content} />
    </Toast>
  );
}
