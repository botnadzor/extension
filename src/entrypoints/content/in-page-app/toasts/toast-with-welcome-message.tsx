import * as React from "react";

import { notificationService } from "@/shared/proxy-services";

import { Toast } from "./toast";

export function ToastWithWelcomeMessage({ onClose }: { onClose: () => void }) {
  const handleClose = React.useCallback(() => {
    void notificationService.markWelcomeAnnouncementAsRead();
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    void notificationService.markWelcomeAnnouncementAsShown();
  }, []);

  return <Toast onClose={handleClose}>Спасибо за установку расширения!</Toast>;
}
