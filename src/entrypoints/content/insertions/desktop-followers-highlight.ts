import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import { renderActionButton } from "./shared/ui-action-buttons";
import { renderInlineBadge } from "./shared/ui-badge";

function extractVkDomain(link: HTMLAnchorElement): string | undefined {
  const authorHref = link.getAttribute("href");
  if (!authorHref) {
    return;
  }

  const match = /^\/([^/?#]+)/.exec(authorHref);
  return match?.[1];
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".fans_fan_row",

  init: async ({ element, logger }) => {
    const avatarLink =
      element.querySelector<HTMLAnchorElement>("a.fans_fan_ph");
    if (!avatarLink) {
      logger.warn(`${avatarLink} not found!`);
      return;
    }
    const vkDomain = extractVkDomain(avatarLink);

    if (!vkDomain) {
      logger.info("vkDomain not found");
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    if (!accountAffiliation) {
      return;
    }

    const frontendBaseUrl = await frontendService.getBaseUrl();

    const tile = avatarLink.closest(".fans_fan_row");
    const tileElement = tile instanceof HTMLElement ? tile : element;
    tileElement.classList.add(...cnl("bn:relative"));
    const overlay = document.createElement("div");
    overlay.className = cn(
      "bn:pointer-events-none bn:absolute bn:inset-0 bn:opacity-40",
    );
    overlay.style.backgroundColor = accountAffiliation.color;

    tileElement.append(overlay);

    const badgeUi = renderInlineBadge({
      mountAfter: overlay,
      tags: accountAffiliation.tags,
      textColor: cn("bn:text-black"),
      background: accountAffiliation.color,
      className: cn(
        `
          bn:absolute bn:top-[25%] bn:left-1/2 bn:ml-0 bn:flex bn:w-full
          bn:-translate-x-1/2 bn:items-center bn:justify-center bn:text-center
          bn:text-[13px] bn:not-italic bn:opacity-40
        `,
      ),
    });

    const actionUi = renderActionButton({
      icons: [
        {
          id: "squareMenu",
          kind: "link",
          href: frontendBaseUrl + "/account/" + vkDomain,
        },
      ],
      containerClassName: cn(
        "bn:absolute bn:left-1/2 bn:-translate-x-1/2 bn:opacity-100",
        "bn:inline",
      ),
      actionClassName: cn("bn:pl-1 bn:text-text-link"),
      iconClassName: cn("bn:size-4"),
    });

    tileElement.append(actionUi.element);

    return () => {
      tileElement.classList.remove(...cnl("bn:relative"));
      overlay.remove();
      badgeUi.destroy();
      actionUi.destroy();
    };
  },
});
