import { type VkDomain, vkDomainSchema } from "@/shared/primitive-values";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import { renderAccountAction } from "./shared/ui-account-action";
import { renderInlineBadge } from "./shared/ui-badge";

function extractVkDomain(authorLink: HTMLAnchorElement): VkDomain | undefined {
  const href = authorLink.getAttribute("href");
  if (!href) {
    return;
  }

  const match = /^\/(.+)$/.exec(href);
  return vkDomainSchema.safeParse(match?.[1]).data;
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".mention_tt_wrap",

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(".mention_tt_name");
    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const registrationDateAnchor = authorLink.parentElement;

    if (!(registrationDateAnchor instanceof HTMLElement)) {
      logger.warn("Registration date anchor not found");
      return;
    }

    const vkDomain = extractVkDomain(authorLink);
    if (!vkDomain) {
      logger.warn(`${authorLink.href} not found`);
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    let badgeUI: ReturnType<typeof renderInlineBadge> | undefined;
    let actionUI: ReturnType<typeof renderAccountAction> | undefined;
    let extraClassListTokens: string[] = [];

    const badgeAnchor = element.querySelector<HTMLElement>(".mention_tt_title");
    if (!badgeAnchor) {
      return;
    }

    if (accountAffiliation) {
      badgeAnchor.style.setProperty(
        "--bn-inline-affiliation-color",
        accountAffiliation.color,
      );

      badgeAnchor.style.setProperty(
        "--bn-inline-affiliation-border",
        "color-mix(in srgb, var(--bn-inline-affiliation-color) 80%, rgba(250 0 0))",
      );

      extraClassListTokens = cnl(
        `
          bn:box-border bn:flex bn:w-full bn:items-center bn:self-stretch
          bn:border-l-3 bn:border-l-(--bn-inline-affiliation-border)
          bn:bg-(--bn-inline-affiliation-color) bn:p-[2px]
          bn:dark:border-l-(--bn-inline-affiliation-border)/50
          bn:dark:bg-(--bn-inline-affiliation-color)/20
        `,
      );

      badgeAnchor.classList.add(...extraClassListTokens);

      badgeUI = renderInlineBadge({
        mountAfter: badgeAnchor,
        tags: accountAffiliation.tags,
        textColor: cn("bn:text-foreground"),
      });

      actionUI = renderAccountAction({
        design: "desktop",
        vkDomain,
        accountAffiliation,
        frontendBaseUrl,
        contentId,
        badgeAnchor,
        registrationDateAnchor,
        className: cn("bn:translate-y-px bn:opacity-100"),
        actionClassName: cn("bn:ml-1 bn:text-text-link"),
        showTooltip: false,
      });

      badgeUI.element.after(actionUI.element);
    }
    return () => {
      badgeAnchor.style.removeProperty("--bn-inline-affiliation-color");
      badgeAnchor.style.removeProperty("--bn-inline-affiliation-border");
      badgeUI?.destroy();
      actionUI?.destroy();
    };
  },
});
