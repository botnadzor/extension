import { type ContentId, contentIdSchema } from "@/shared/@primitives/misc";
import { configureLogging, getContentLogger } from "@/shared/logging";
import { browser, defineContentScript, getAppConfig } from "#imports";

import { derivePageInfo } from "./content/derived-page-info";
import { startManagingDxOverlays } from "./content/dx-overlays";
import { contentScriptMatches } from "./content/hosts-and-matches";
import { startInPageApp } from "./content/in-page-app";
import { startManagingInsertions } from "./content/insertion-management";

const logger = getContentLogger();

function setupContentId(): ContentId {
  if (!getAppConfig().persistentContentIdEnabled) {
    return contentIdSchema.parse(undefined);
  }

  const contentId = contentIdSchema.parse(window.name);

  if (!window.name) {
    // If parent page does not define window.name (and thus does not rely on it),
    // we set it to content id. This helps us restore UI state on page reload
    // (e.g. whether inspector is triggered).
    window.name = contentId;

    logger.debug("Setting empty window.name to content id {contentId}", {
      contentId,
    });
  } else if (window.name === contentId) {
    logger.debug("Using existing window.name for content id {contentId}", {
      contentId,
    });
  } else {
    logger.warn(
      "Existing window.name ({windowName}) does not match content id schema; using {contentId} for content id. Extension state won't be preserved between page reloads",
      { windowName: window.name, contentId },
    );
  }

  return contentId;
}

export default defineContentScript({
  matches: contentScriptMatches,

  cssInjectionMode: "manual",

  async main(ctx) {
    configureLogging();

    logger.debug("Starting content entrypoint {runtimeId}", {
      runtimeId: browser.runtime.id,
    });

    const contentId = setupContentId();

    logger.debug(
      "Loading content script with content id {contentId} for {url}",
      { contentId, url: window.location.href },
    );

    const derivedPageInfo = derivePageInfo(window.location);

    if (!derivedPageInfo) {
      logger.info("Content script does not apply to this page, exiting");
      return;
    }

    logger.debug("Derived page info: {derivedPageInfo}", {
      derivedPageInfo,
    });

    void startManagingInsertions({ contentId, ...derivedPageInfo });

    if (getAppConfig().dxFeaturesEnabled) {
      void startManagingDxOverlays();
    }

    await startInPageApp(contentId, ctx);
  },
});
