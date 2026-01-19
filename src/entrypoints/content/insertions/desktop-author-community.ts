import type { VkDomain } from "@/shared/@model/primitives";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import {
  applyInlineAffiliationVars,
  clearInlineAffiliationVars,
  inlineAffiliationStripClasses,
} from "./shared/affiliation-highlight-style";
import { renderAccountAction } from "./shared/ui-account-action";
import { renderInlineBadge } from "./shared/ui-badge";
import { extractVkDomainFromHref } from "./shared/vk-identifies";

function extractVkDomain(authorLink: HTMLAnchorElement): VkDomain | undefined {
  return extractVkDomainFromHref(authorLink.getAttribute("href"));
}

export default defineInsertion({
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

      applyInlineAffiliationVars(authorLink, accountAffiliation.color);
      extraClassListTokens = [...inlineAffiliationStripClasses];

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
        clearInlineAffiliationVars(authorLink);
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
});
