import { ExternalLinkIcon, GlobeIcon } from "lucide-react";
import * as React from "react";

import { useFrontendBaseUrl } from "@/shared/@ui-helpers/data-hooks";
import { GithubIcon, TelegramIcon, VkIcon } from "@/shared/custom-icons";
import { notificationService } from "@/shared/proxy-services";

import { ExtensionPopupLink } from "./shared/extension-popup-link";
import { Toast } from "./toast";

export function ToastWithWelcomeMessage() {
  React.useEffect(() => {
    void notificationService.markWelcomeAnnouncementAsShown();
  }, []);

  const frontendBaseUrl = useFrontendBaseUrl();

  return (
    <Toast
      onClose={() => {
        void notificationService.markWelcomeAnnouncementAsRead();
      }}
    >
      Спасибо за установку!
      <ul className="-ml-1.5 py-2">
        {[
          {
            href: "https://github.com/botnadzor/extension",
            Icon: GithubIcon,
            label: "Исходный код (GitHub)",
          },
          {
            href: frontendBaseUrl,
            Icon: GlobeIcon,
            label: "Сайт проекта",
          },
          {
            href: "https://vk.com/botnadzor",
            Icon: VkIcon,
            label: "Группа VK: botnadzor",
          },
          {
            href: "https://t.me/botnadzor_org",
            Icon: TelegramIcon,
            label: "Телеграм-канал: @botnadzor_org",
          },
        ].map(({ href, Icon, label }) => (
          <li key={label}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center u-link"
            >
              <Icon className="mx-1.5 size-3.5 text-foreground" />
              {label}
              <ExternalLinkIcon className="mx-[0.2em] mt-[0.1em] size-[0.75em] text-ring" />
            </a>
          </li>
        ))}
      </ul>
      Настройки — <ExtensionPopupLink />
    </Toast>
  );
}
