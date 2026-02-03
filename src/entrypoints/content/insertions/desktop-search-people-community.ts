import { type VkDomain, vkDomainSchema } from "@/shared/@model/primitives";
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

function extractVkDomain(authorLink: HTMLAnchorElement): VkDomain | undefined {
  const href = authorLink.getAttribute("href");
  if (!href) {
    return;
  }

  let pathname: string;
  try {
    pathname = new URL(href, location.origin).pathname;
  } catch {
    return;
  }

  const match = /^\/([^/?#]+)/.exec(pathname);
  return vkDomainSchema.safeParse(match?.[1]).data;
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: '[data-testid="userrichcell"]',

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(
      '[data-testid="userrichcell-avatar"] a',
    );
    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const registrationDateAnchor = authorLink.parentElement;

    if (!(registrationDateAnchor instanceof HTMLElement)) {
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
    let row: HTMLDivElement | undefined;
    let extraClassListTokens: string[] = [];

    const nameNode = element.querySelector<HTMLElement>(
      '[data-testid="userrichcell-name"]',
    );

    const nameLink = nameNode?.closest("a");
    if (!nameLink) {
      return;
    }

    const overflowHost =
      nameNode?.closest<HTMLElement>('[class*="RichCell__children"]') ??
      element.querySelector<HTMLElement>('[class*="RichCell__children"]');

    let previousOverflow: string | undefined;

    if (overflowHost) {
      previousOverflow = overflowHost.style.overflow;
      overflowHost.style.overflow = "visible";
    }

    const nameContainer = nameLink.parentElement;
    if (!(nameContainer instanceof HTMLElement)) {
      return;
    }

    if (accountAffiliation) {
      applyInlineAffiliationVars(element, accountAffiliation.color);

      extraClassListTokens = cnl(
        ...inlineAffiliationStripClassListTokens,
        `
          bn:mt-[-2px] bn:mr-[-2px] bn:mb-[-5px] bn:px-[2px] bn:pt-[2px]
          bn:pb-[5px]
        `,
      );

      element.classList.add(...extraClassListTokens);

      row = document.createElement("div");
      row.classList.add(
        ...cnl("bn:mt-[2px] bn:flex bn:flex-wrap bn:items-center bn:gap-1"),
      );
      nameContainer.after(row);

      const placeholder = document.createElement("span");
      row.append(placeholder);

      badgeUI = renderInlineBadge({
        mountAfter: placeholder,
        tags: accountAffiliation.tags,
        className: cn("bn:items-center"),
      });

      actionUI = renderAccountAction({
        design: "desktop",
        vkDomain,
        accountAffiliation,
        frontendBaseUrl,
        contentId,
        badgeAnchor: placeholder,
        registrationDateAnchor,
        className: cn("bn:opacity-100"),
        actionClassName: cn("bn:mr-1 bn:text-text-link"),
        showTooltip: true,
      });

      row.append(actionUI.element);
      placeholder.remove();
    }

    return () => {
      badgeUI?.destroy();
      actionUI?.destroy();
      row?.remove();

      if (accountAffiliation) {
        clearInlineAffiliationVars(element);
        element.classList.remove(...extraClassListTokens);
      }

      if (overflowHost) {
        if (previousOverflow && previousOverflow.length > 0) {
          overflowHost.style.overflow = previousOverflow;
        } else {
          overflowHost.style.removeProperty("overflow");
        }
      }
    };
  },
});
