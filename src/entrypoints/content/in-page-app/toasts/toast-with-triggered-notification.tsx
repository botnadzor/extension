import * as React from "react";

import { useContentId } from "@/hooks/content-id-context";
import { useFrontendBaseUrl } from "@/hooks/frontend-service";
import { notificationService, popupService } from "@/lib/proxy-services";
import type { TriggeredNotification } from "@/services/notification-service";

import { Toast } from "./toast";

const closeAfterInMilliseconds = 60_000;

// Unable to call action "openPopup" in Firefox. When sending message to background, getting
// `Uncaught (in promise) Error: openPopup requires a user gesture`
// Context: https://bugzilla.mozilla.org/show_bug.cgi?id=1799344#c4
// TODO: Review this in future versions of Firefox when the above issue is fixed
const popupCanBeOpened = !import.meta.env.FIREFOX;

export function ToastWithTriggeredNotification({
  type,
  triggeredAt,
}: NonNullable<TriggeredNotification> & {}) {
  let header: React.ReactNode;
  let children: React.ReactNode;

  const frontendBaseUrl = useFrontendBaseUrl();
  const contentId = useContentId();

  const handleClose = React.useCallback(() => {
    void notificationService.trigger(contentId, undefined);
  }, [contentId]);

  const handleToggleMenuClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      void popupService.open({ tab: "access" });

      setTimeout(() => {
        handleClose();
      }, 1000);
    },
    [handleClose],
  );

  React.useEffect(() => {
    const timeout = setTimeout(handleClose, closeAfterInMilliseconds);
    return () => {
      clearTimeout(timeout);
    };
  }, [handleClose]);

  const messageSuffixWithMentionOfMenu = popupCanBeOpened ? (
    <span className="whitespace-nowrap">
      <a href="#botnadzor-extension-popup" onClick={handleToggleMenuClick}>
        в меню расширения
      </a>
      .
    </span>
  ) : (
    <span className="whitespace-nowrap">в меню расширения.</span>
  );

  switch (type) {
    case "inspectorMissingPermission": {
      children = (
        <>
          Для доступа к{" "}
          <a
            target="_blank"
            href={`${frontendBaseUrl}/docs/extension#inspector`}
            rel="noopener noreferrer"
          >
            инспектору
          </a>
          , ваш код должен иметь дополнительные уровни. Подробности&nbsp;—{" "}
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
            target="_blank"
            href={`${frontendBaseUrl}/docs/extension#inspector`}
            rel="noopener noreferrer"
          >
            инспектор
          </a>
          , настройте доступ {messageSuffixWithMentionOfMenu}
        </>
      );
      break;
    }

    case "regDateAccountNotFound": {
      children = (
        <>
          Аккаунт не найден. Скорее всего, вы пытаетесь получить дату
          регистрации сообщества.
        </>
      );
      break;
    }

    case "regDateNoAliasToUse": {
      children = (
        <>
          Невозможно подключиться к серверу для получения даты регистрации.
          Попробуйте ещё раз с включённым или отключённым VPN.
        </>
      );
      break;
    }

    case "regDateNotYetKnown": {
      children = <>Дата регистрации у этого аккаунта пока неизвестна.</>;
      break;
    }

    case "regDateMissingPermission": {
      children = (
        <>
          Чтобы получить дату регистрации, ваш&nbsp;код должен иметь очки или
          дополнительные уровни. Подробности&nbsp;—{" "}
          {messageSuffixWithMentionOfMenu}
        </>
      );

      break;
    }

    case "regDateTooManyRequests": {
      children = (
        <>
          Слишком много запросов к серверу для получения даты регистрации.
          Попробуйте ещё раз позже.
        </>
      );
      break;
    }

    case "regDateUnauthorized": {
      children = (
        <>
          Чтобы получить дату регистрации, настройте доступ{" "}
          {messageSuffixWithMentionOfMenu}
        </>
      );
      break;
    }

    case "regDateUnexpectedError": {
      children = (
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
              href={frontendBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate"
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
      key={type}
      header={header}
      onClose={handleClose}
      triggeredAt={triggeredAt}
    >
      {children}
    </Toast>
  );
}
