import { affiliationService, frontendService } from "@/lib/proxy-services";

import type { Insertion } from "../insertion-basics";
import { extractVkDomain, renderPostUI } from "./shared/ui-page-post";

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: ".copy_post_header",

  init: async ({ element, contentId }) => {
    const authorLink = element.querySelector(".CopyPost__authorLink");

    if (!(authorLink instanceof HTMLAnchorElement)) {
      return;
    }

    const vkDomain = extractVkDomain(authorLink);
    if (!vkDomain) {
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);
    const frontendBaseUrl = await frontendService.getBaseUrl();

    const authorNameBlock = element.querySelector<HTMLElement>(
      ".copy_post_header_info",
    );

    if (!authorNameBlock) {
      return;
    }

    const ui = renderPostUI({
      vkDomain,
      accountAffiliation,
      frontendBaseUrl,
      contentId,
      headerContainer: element,
      badgeAnchor: authorNameBlock,
    });

    return () => {
      ui.destroy();
    };
  },
};

export default insertion;
