import { type VkDomain, vkDomainSchema } from "@/lib/primitive-values";
import { affiliationService, frontendService } from "@/lib/proxy-services";
import { cn, cnl } from "@/lib/utils";

import type { Insertion } from "../insertion-basics";
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

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: '[data-testid="showmoretext-in-expanded"]',

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(
      'a[href^="/"]:not([data-testid="mention"])',
    );

    if (!(authorLink instanceof HTMLAnchorElement)) {
      logger.warn("Author not found in author-community");
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
    let previousOverflow: string | undefined;

    if (accountAffiliation) {
      previousOverflow = authorLink.style.overflow || undefined;
      authorLink.style.overflow = "visible";

      authorLink.style.setProperty(
        "--bn-inline-affiliation-color",
        accountAffiliation.color,
      );

      authorLink.style.setProperty(
        "--bn-inline-affiliation-border",
        "color-mix(in srgb, var(--bn-inline-affiliation-color) 80%, rgba(250 0 0))",
      );

      extraClassListTokens = cnl(
        `
          bn:border-l-3 bn:border-l-(--bn-inline-affiliation-border)
          bn:bg-(--bn-inline-affiliation-color)
          bn:dark:border-l-(--bn-inline-affiliation-border)/50
          bn:dark:bg-(--bn-inline-affiliation-color)/20
        `,
      );

      authorLink.classList.add(...extraClassListTokens);

      badgeUI = renderInlineBadge({
        mountAfter: authorLink,
        tags: accountAffiliation.tags,
        className: cn("bn:px-[2px]"),
        mountMode: "append",
      });

      const badgeAnchor = element.querySelector("a[href^='/']") ?? authorLink;

      if (!(badgeAnchor instanceof HTMLElement)) {
        return;
      }

      actionUI = renderAccountAction({
        design: "desktop",
        vkDomain,
        accountAffiliation,
        frontendBaseUrl,
        badgeAnchor,
        registrationDateAnchor: authorLink,
        contentId,
        className: cn("bn:translate-y-[3px] bn:opacity-100"),
        actionClassName: cn("bn:ml-1 bn:text-text-link"),
        showTooltip: true,
      });

      badgeUI.element.after(actionUI.element);
    }

    return () => {
      if (accountAffiliation) {
        authorLink.style.removeProperty("--bn-inline-affiliation-color");
        authorLink.style.removeProperty("--bn-inline-affiliation-border");
        authorLink.classList.remove(...extraClassListTokens);

        if (typeof previousOverflow === "string") {
          authorLink.style.overflow = previousOverflow;
        } else {
          authorLink.style.removeProperty("overflow");
        }
      }
      badgeUI?.destroy();
      actionUI?.destroy();
    };
  },
};

export default insertion;
