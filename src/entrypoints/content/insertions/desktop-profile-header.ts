import { frontendService } from "@/lib/proxy-services";

import type { Insertion } from "../insertion-basics";
import {
  getProfileHeader,
  renderDesktopProfileHeaderUi,
} from "./shared/ui-profile-header";

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: ".ProfileHeader__wrapper",

  init: async ({ element, logger, contentId }) => {
    const profileContext = await getProfileHeader({
      element,
      logger,
      nameSelector: "#owner_page_name",
    });
    if (!profileContext) {
      return;
    }

    const frontendBaseUrl = await frontendService.getBaseUrl();

    const ui = renderDesktopProfileHeaderUi({
      nameElement: profileContext.nameElement,
      vkDomain: profileContext.vkDomain,
      accountAffiliation: profileContext.accountAffiliation,
      frontendBaseUrl,
      contentId,
    });

    return () => {
      ui.destroy();
    };
  },
};

export default insertion;
