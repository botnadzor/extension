import * as React from "react";

import { notificationService } from "@/lib/proxy-services";

import { Toast } from "./toast";

export function ToastWithWelcomeMessage() {
  const handleClose = React.useCallback(() => {
    void notificationService.markWelcomeAnnouncementAsRead();
  }, []);

  React.useEffect(() => {
    void notificationService.markWelcomeAnnouncementAsShown();
  }, []);

  return <Toast onClose={handleClose}>Спасибо за установку расширения!</Toast>;
}
