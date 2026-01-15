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
  appliesTo: "mobileVkWebsite",
  elementSelector: ".PostHeader__info",

  init: async ({ element, logger, contentId }) => {
    const timeLink =
      element.querySelector<HTMLAnchorElement>("a.PostHeaderTime");
    if (!timeLink) {
      logger.warn("Post author not found");
      return;
    }
    timeLink.classList.add(...cnl("bn:pl-1"));

    const vkDomain = extractVkDomain(timeLink);
    if (!vkDomain) {
      return;
    }

    const registrationDateAnchor = element.children[0];

    if (!(registrationDateAnchor instanceof HTMLElement)) {
      logger.warn("Registration date anchor not found");
      return;
    }

    const badgeAnchor = timeLink;

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    const actionButton = renderAccountAction({
      design: "mobile",
      vkDomain,
      accountAffiliation,
      frontendBaseUrl,
      contentId,
      badgeAnchor,
      registrationDateAnchor,
      className: cn("bn:ml-1 bn:opacity-100"),
      actionClassName: cn("bn:ml-1 bn:rounded-md bn:text-text-link"),
      showTooltip: false,
    });

    let badge: ReturnType<typeof renderInlineBadge> | undefined;
    let extraClassListTokens: string[] = [];
    if (accountAffiliation) {
      const base = accountAffiliation.color;
      element.style.setProperty("--bn-page-post-affiliation-color", base);
      element.style.setProperty(
        "--bn-page-post-affiliation-border",
        "color-mix(in srgb, var(--bn-page-post-affiliation-color) 80%, rgba(200 0 0))",
      );

      extraClassListTokens = cnl(`
        bn:border-l-3 bn:border-l-(--bn-page-post-affiliation-border)
        bn:bg-(--bn-page-post-affiliation-color)
        bn:dark:border-l-(--bn-page-post-affiliation-border)/50
        bn:dark:bg-(--bn-page-post-affiliation-color)/20
      `);

      element.classList.add(...extraClassListTokens);

      badge = renderInlineBadge({
        mountAfter: timeLink,
        tags: accountAffiliation.tags,
        className: cn("bn:px-[2px]"),
      });

      badge.element.after(actionButton.element);
    } else {
      timeLink.after(actionButton.element);
    }

    return () => {
      if (accountAffiliation) {
        timeLink.classList.remove(...cnl("bn:pl-1"));
        element.style.removeProperty("--bn-page-post-affiliation-color");
        element.style.removeProperty("--bn-page-post-affiliation-border");
        element.classList.remove(...extraClassListTokens);
      }
      badge?.destroy();
      actionButton.destroy();
    };
  },
});
