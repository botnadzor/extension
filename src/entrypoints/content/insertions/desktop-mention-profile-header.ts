import type { VkDomain } from "@/shared/@model/primitives";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn, cnl } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import {
  applyInlineAffiliationVars,
  clearInlineAffiliationVars,
  inlineAffiliationStripClassListTokens,
} from "./shared/affiliation-highlight-style";
import { renderAccountAction } from "./shared/ui-account-action";
import { renderInlineBadge } from "./shared/ui-badge";
import { extractVkDomainFromHref } from "./shared/vk-identifies";

function extractVkDomain(authorLink: HTMLAnchorElement): VkDomain | undefined {
  return extractVkDomainFromHref(authorLink.getAttribute("href"));
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

    const badgeAnchor = element.querySelector(".mention_tt_title");
    if (!(badgeAnchor instanceof HTMLElement)) {
      return;
    }

    if (accountAffiliation) {
      applyInlineAffiliationVars(badgeAnchor, accountAffiliation.color);

      extraClassListTokens = cnl(
        ...inlineAffiliationStripClassListTokens,
        "bn:mt-[-2px] bn:mr-[-2px] bn:px-[2px] bn:pt-[2px]",
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
      clearInlineAffiliationVars(badgeAnchor);
      badgeUI?.destroy();
      actionUI?.destroy();
    };
  },
});
