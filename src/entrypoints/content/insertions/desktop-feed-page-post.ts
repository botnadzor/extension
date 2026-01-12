import { affiliationService, frontendService } from "@/lib/proxy-services";

import type { Insertion } from "../insertion-basics";
import { extractVkDomain, renderPostUI } from "./shared/ui-page-post";

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: '[data-testid="post"]',

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(
      '[data-testid="post-header-title"][href^="/"]',
    );
    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const vkDomain = extractVkDomain(authorLink);
    if (!vkDomain) {
      logger.warn(`${authorLink.href} not found`);
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    const postHeaderContainer =
      element.querySelector<HTMLElement>(":scope > div");
    if (!(postHeaderContainer instanceof HTMLElement)) {
      return;
    }

    const titleOverflowContainer = authorLink.parentElement;
    if (!(titleOverflowContainer instanceof HTMLElement)) {
      return;
    }

    const originalStyle = titleOverflowContainer.getAttribute("style");

    if (accountAffiliation) {
      titleOverflowContainer.removeAttribute("style");
    }

    const hiderElement = authorLink.nextElementSibling;
    const originalHiderStyle =
      hiderElement instanceof HTMLElement
        ? hiderElement.getAttribute("style")
        : undefined;

    if (accountAffiliation && hiderElement instanceof HTMLElement) {
      hiderElement.style.display = "none";
      hiderElement.style.background = "none";
    }

    const ui = renderPostUI({
      vkDomain,
      accountAffiliation,
      frontendBaseUrl,
      contentId,
      headerContainer: postHeaderContainer,
      badgeAnchor: titleOverflowContainer,
    });

    return () => {
      if (accountAffiliation) {
        titleOverflowContainer.removeAttribute("style");

        if (originalStyle) {
          titleOverflowContainer.setAttribute("style", originalStyle);
        }
      }

      if (hiderElement instanceof HTMLElement) {
        hiderElement.removeAttribute("style");
        if (originalHiderStyle) {
          hiderElement.setAttribute("style", originalHiderStyle);
        }
      }
      ui.destroy();
    };
  },
};

export default insertion;
