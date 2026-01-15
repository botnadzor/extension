import { frontendService } from "@/shared/proxy-services";

import { defineInsertion } from "../insertion-basics";
import {
  getProfileHeader,
  renderMobileProfileHeaderUI,
} from "./shared/ui-profile-header";

export default defineInsertion({
  appliesTo: "mobileVkWebsite",
  elementSelector: ".ProfileInfo__main",

  init: async ({ element, logger, contentId }) => {
    const profileContext = await getProfileHeader({
      element,
      logger,
      nameSelector: ".ProfileInfoName",
    });

    if (!profileContext) {
      return;
    }

    const frontendBaseUrl = await frontendService.getBaseUrl();

    const ui = renderMobileProfileHeaderUI({
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
});
