import * as React from "react";

import { notificationService } from "@/shared/proxy-services";

import { Toast } from "./toast";

export function ToastWithWelcomeMessage() {
  React.useEffect(() => {
    void notificationService.markWelcomeAnnouncementAsShown();
  }, []);

  return (
    <Toast
      onClose={() => {
        void notificationService.markWelcomeAnnouncementAsRead();
      }}
    >
      Спасибо за установку расширения!
    </Toast>
  );
}
