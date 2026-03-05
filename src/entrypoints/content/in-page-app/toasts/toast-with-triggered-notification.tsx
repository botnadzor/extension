import * as React from "react";

import type { TriggeredNotification } from "@/shared/@model/notifications";
import { useFrontendBaseUrl } from "@/shared/@ui-helpers/data-hooks";
import { notificationService } from "@/shared/proxy-services";
import { detectVkBaseUrl } from "@/shared/url-helpers";

import { useContentId } from "../../content-id-context";
import { ExtensionPopupLink } from "./shared/extension-popup-link";
import { Toast } from "./toast";

const closeAfterInMilliseconds = 60_000;

export function ToastWithTriggeredNotification({
  message,
  type,
  triggeredAt,
}: NonNullable<TriggeredNotification> & {}) {
  let extensionName: "short" | "default" = "default";
  let header: React.ReactNode;
  let children: React.ReactNode;

  const frontendBaseUrl = useFrontendBaseUrl();
  const contentId = useContentId();
  const vkBaseUrl = detectVkBaseUrl(window.location.href);

  function handleClose() {
    void notificationService.trigger(contentId, undefined);
  }

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      void notificationService.trigger(contentId, undefined);
    }, closeAfterInMilliseconds);
    return () => {
      clearTimeout(timeout);
    };
  }, [contentId]);

  const messageSuffixWithMentionOfMenu = (
    <>
      {" "}
      <span className="whitespace-nowrap">
        <ExtensionPopupLink tab="access" onClick={handleClose} />.
      </span>
    </>
  );

  switch (type) {
    case "dataWarmupComplete": {
      extensionName = "short";
      children = (
        <>
          Подсветка ботов активирована. Попробуйте открыть VK-паблик, где часто
          бывают боты:{" "}
          {[
            // cspell:ignore rt_russian vesti
            "ria",
            "rt_russian",
            "vesti",
            "mash",
          ].map((page, index) => (
            <React.Fragment key={page}>
              {index > 0 && ", "}
              <a
                className="u-link"
                href={`${vkBaseUrl}/${page}`}
                onClick={handleClose}
              >
                {page}
              </a>
            </React.Fragment>
          ))}
          .
        </>
      );
      break;
    }

    case "inspectorMissingPermission": {
      children = (
        <>
          Для доступа к{" "}
          <a
            href={`${frontendBaseUrl}/docs/extension#inspector`}
            rel="noopener noreferrer"
            target="_blank"
          >
            инспектору
          </a>
          , ваш код должен иметь дополнительные уровни. Подробности&nbsp;—
          {messageSuffixWithMentionOfMenu}
        </>
      );
      break;
    }

    case "inspectorUnauthorized": {
      children = (
        <>
          Чтобы открыть{" "}
          <a
            href={`${frontendBaseUrl}/docs/extension#inspector`}
            rel="noopener noreferrer"
            target="_blank"
          >
            инспектор
          </a>
          , настройте доступ{messageSuffixWithMentionOfMenu}
        </>
      );
      break;
    }

    case "regDateMissingPermission": {
      children = (
        <>
          Чтобы получить дату регистрации, ваш&nbsp;код должен иметь очки или
          дополнительные уровни. Подробности&nbsp;—
          {messageSuffixWithMentionOfMenu}
        </>
      );

      break;
    }

    case "regDateUnauthorized": {
      children = (
        <>
          Чтобы получить дату регистрации, настройте доступ
          {messageSuffixWithMentionOfMenu}
        </>
      );
      break;
    }

    case "regDateUnavailable": {
      children = message ?? (
        <>
          Произошла ошибка при получении даты регистрации. Попробуйте ещё раз
          позже.
        </>
      );
      break;
    }
  }

  return (
    <Toast
      extensionName={extensionName}
      header={header}
      key={type}
      onClose={handleClose}
      triggeredAt={triggeredAt}
    >
      {children}
    </Toast>
  );
}
