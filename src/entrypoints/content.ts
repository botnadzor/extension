import { getLogger, type Logger } from "@logtape/logtape";

import { configureLogging } from "@/shared/@logging/core";
import { type ContentId, contentIdSchema } from "@/shared/@primitives/misc";
import { browser, defineContentScript, getAppConfig } from "#imports";

import { derivePageInfo } from "./content/derived-page-info";
import { startManagingDxOverlays } from "./content/dx-overlays";
import { contentScriptMatches } from "./content/hosts-and-matches";
import { startInPageApp } from "./content/in-page-app";
import { startManagingInsertions } from "./content/insertion-management";

function setupContentId(): { contentId: ContentId; contentLogger: Logger } {
  if (!getAppConfig().persistentContentIdEnabled) {
    const contentId = contentIdSchema.parse(undefined);
    return { contentId, contentLogger: getLogger(["content", contentId]) };
  }

  const contentId = contentIdSchema.parse(window.name);
  const contentLogger = getLogger(["content", contentId]);

  if (!window.name) {
    // If parent page does not define window.name (and thus does not rely on it),
    // we set it to content id. This helps us restore UI state on page reload
    // (e.g. whether inspector is triggered).
    window.name = contentId;

    contentLogger.debug("Setting empty window.name to content id {contentId}", {
      contentId,
    });
  } else if (window.name === contentId) {
    contentLogger.debug(
      "Using existing window.name for content id {contentId}",
      {
        contentId,
      },
    );
  } else {
    contentLogger.warn(
      "Existing window.name ({windowName}) does not match content id schema; using {contentId} for content id. Extension state won't be preserved between page reloads",
      { windowName: window.name, contentId },
    );
  }

  return { contentId, contentLogger };
}

export default defineContentScript({
  matches: contentScriptMatches,

  cssInjectionMode: "manual",

  async main(ctx) {
    configureLogging();

    getLogger(["content", "-" /* Content id is not available yet */]).debug(
      "Starting content entrypoint {runtimeId}",
      { runtimeId: browser.runtime.id },
    );

    const { contentId, contentLogger } = setupContentId();

    contentLogger.debug(
      "Loading content script with content id {contentId} for {url}",
      { contentId, url: window.location.href },
    );

    const derivedPageInfo = derivePageInfo(window.location);

    if (!derivedPageInfo) {
      contentLogger.info("Content script does not apply to this page, exiting");
      return;
    }

    contentLogger.debug("Derived page info: {derivedPageInfo}", {
      derivedPageInfo,
    });

    void startManagingInsertions({
      contentId,
      contentLogger,
      ...derivedPageInfo,
    });

    if (getAppConfig().dxFeaturesEnabled) {
      void startManagingDxOverlays();
    }

    await startInPageApp(contentId, contentLogger, ctx);
  },
});
