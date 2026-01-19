import Markdown from "marked-react";

import type { StaticListItem } from "@/shared/@model/static-lists";
import { useFrontendBaseUrl } from "@/shared/@ui-helpers/data-hooks";
import { formatDate } from "@/shared/formatting";
import { notificationService } from "@/shared/proxy-services";

import { Toast } from "./toast";

export function ToastWithAnnouncement({
  createdAt,
  header,
  content,
}: StaticListItem<"announcements">) {
  const frontendBaseUrl = useFrontendBaseUrl();

  return (
    <Toast
      header={header}
      onClose={() => {
        void notificationService.markAnnouncementAsRead(createdAt);
      }}
    >
      <div className="-mt-1 pb-1 font-play text-xs text-muted-foreground">
        {formatDate(createdAt)}
      </div>
      <Markdown baseURL={frontendBaseUrl} value={content} />
    </Toast>
  );
}
