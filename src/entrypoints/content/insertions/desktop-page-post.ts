import { affiliationService, frontendService } from "@/lib/proxy-services";

import type { Insertion } from "../insertion-basics";
import { extractVkDomain, renderPostUI } from "./shared/ui-page-post";

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: ".PostHeader",

  init: async ({ element, logger, contentId }) => {
    const authorLink = element.querySelector(".PostHeaderTitle__authorLink");

    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const vkDomain = extractVkDomain(authorLink);

    if (!vkDomain) {
      logger.warn(`Unable to determine vkDomain from ${authorLink.href}`);
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    const authorPostName = element.querySelector(
      ".PostHeaderTitle__authorBlock",
    );

    if (!(authorPostName instanceof HTMLElement)) {
      return;
    }

    const overflowHost = element.querySelector<HTMLElement>(".PostHeaderTitle");
    let previousOverflow: string | undefined;

    if (overflowHost) {
      previousOverflow = overflowHost.style.overflow;
      overflowHost.style.overflow = "visible";
    }

    const ui = renderPostUI({
      vkDomain,
      accountAffiliation,
      frontendBaseUrl,
      contentId,
      headerContainer: element,
      badgeAnchor: authorPostName,
    });

    return () => {
      ui.destroy();

      if (overflowHost) {
        if (previousOverflow && previousOverflow.length > 0) {
          overflowHost.style.overflow = previousOverflow;
        } else {
          overflowHost.style.removeProperty("overflow");
        }
      }
    };
  },
};

export default insertion;
