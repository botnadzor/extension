import * as React from "react";

import type { TriggeredNotification } from "@/shared/@model/notifications";
import { useFrontendBaseUrl } from "@/shared/@ui-helpers/data-hooks";
import { notificationService, popupService } from "@/shared/proxy-services";
import { detectVkBaseUrl } from "@/shared/url-helpers";

import { useContentId } from "../../content-id-context";
import { Toast } from "./toast";

const closeAfterInMilliseconds = 60_000;

// Unable to call action "openPopup" in Firefox. When sending message to background, getting
// `Uncaught (in promise) Error: openPopup requires a user gesture`
// Context: https://bugzilla.mozilla.org/show_bug.cgi?id=1799344#c4
// TODO: Review this in future versions of Firefox when the above issue is fixed
const popupCanBeOpened = !import.meta.env.FIREFOX;

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

  function handleToggleMenuClick(event: React.MouseEvent) {
    event.preventDefault();

    void popupService.open({ tab: "access" });

    setTimeout(() => {
      handleClose();
    }, 1000);
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
      {popupCanBeOpened ? (
        <span className="whitespace-nowrap">
          <a href="#botnadzor-extension-popup" onClick={handleToggleMenuClick}>
            в меню расширения
          </a>
          .
        </span>
      ) : (
        <span className="whitespace-nowrap">в меню расширения.</span>
      )}
    </>
  );

  switch (type) {
    case "dataWarmupComplete": {
      extensionName = "short";
      children = (
        <>
          Данные для подсветки ботов готовы.{" "}
          <a href={window.location.href} onClick={handleClose}>
            Обновите страницу
          </a>{" "}
          или&nbsp;попробуйте открыть VK-паблик, где часто бывают боты:{" "}
          {[
            // cspell:ignore rt_russian vesti
            "ria",
            "rt_russian",
            "vesti",
            "mash",
          ].map((page, index) => (
            <React.Fragment key={page}>
              {index > 0 && ", "}
              <a href={`${vkBaseUrl}/${page}`} onClick={handleClose}>
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

    case "test": {
      header = "Тестовое уведомление";
      children = (
        <>
          <p>Тестовое уведомление + ссылка:</p>
          <div className="truncate">
            <a
              className="truncate"
              href={frontendBaseUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {frontendBaseUrl.replace("https://", "")}
            </a>
          </div>
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
