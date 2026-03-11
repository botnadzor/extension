import type { Logger } from "@logtape/logtape";
import { isEqual } from "es-toolkit";

import type { InsertionConfig } from "@/shared/@model/insertion-configs";
import type { ContentId } from "@/shared/@primitives/misc";
import { dxConfigService, staticListsService } from "@/shared/proxy-services";

import type { DerivedPageInfo } from "./derived-page-info";
import { startGlobalRerenderPolling } from "./insertion-management/global-rerender";
import {
  type InsertionInstanceMap,
  mountNewInsertions,
  unmountAllInsertions,
  unmountInstance,
} from "./insertion-management/instance-lifecycle";
import insertionStyling from "./insertion-styling.css?inline";

function filterConfigsForPage(
  configs: InsertionConfig[],
  { websiteVariant, archivedSnapshot }: DerivedPageInfo,
): InsertionConfig[] {
  return configs.filter((config) => {
    if (config.disabled) {
      return false;
    }
    if (
      config.appliesTo !== "desktopAndMobileVkWebsite" &&
      config.appliesTo !== websiteVariant
    ) {
      return false;
    }
    if (config.appliesToArchivedSnapshotsOnly && !archivedSnapshot) {
      return false;
    }
    return true;
  });
}

export async function startManagingInsertions({
  archivedSnapshot,
  contentId,
  contentLogger,
  websiteVariant,
}: DerivedPageInfo & {
  contentId: ContentId;
  contentLogger: Logger;
}): Promise<void> {
  const style = document.createElement("style");
  style.textContent = insertionStyling;
  document.head.append(style);

  const derivedPageInfo: DerivedPageInfo = { archivedSnapshot, websiteVariant };
  const instanceMap: InsertionInstanceMap = new Map();
  let currentConfigs: InsertionConfig[] = [];

  function updateConfigs(staticListConfigs: InsertionConfig[]) {
    const filtered = filterConfigsForPage(staticListConfigs, derivedPageInfo);

    const configMap = new Map(filtered.map((config) => [config.id, config]));
    for (const [instanceId, instance] of instanceMap) {
      const matchingConfig = configMap.get(instance.config.id);
      if (!matchingConfig || !isEqual(matchingConfig, instance.config)) {
        unmountInstance(instanceMap, instanceId);
      }
    }

    currentConfigs = filtered;

    contentLogger.info(
      "Updated insertion configs ({count} for this page): {ids}",
      {
        count: currentConfigs.length,
        ids: currentConfigs.map((c) => c.id),
      },
    );
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- proxy service erases generic type parameter
  const initialItems = (await staticListsService.getItems(
    "insertions",
  )) as InsertionConfig[];
  const initialDxConfig = await dxConfigService.get();

  updateConfigs(initialDxConfig.insertionsRemoved ? [] : initialItems);

  mountNewInsertions({
    configs: currentConfigs,
    contentId,
    contentLogger,
    derivedPageInfo,
    instanceMap,
  });

  let throttleTimeout: number | undefined;
  const mutationObserver = new MutationObserver(() => {
    if (throttleTimeout !== undefined) {
      return;
    }
    throttleTimeout = window.setTimeout(() => {
      mountNewInsertions({
        configs: currentConfigs,
        contentId,
        contentLogger,
        derivedPageInfo,
        instanceMap,
      });
      throttleTimeout = undefined;
    }, 100);
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  const stopPolling = startGlobalRerenderPolling({
    derivedPageInfo,
    instanceMap,
    contentLogger,
    contentId,
    getConfigs: () => currentConfigs,
    onConfigsChanged: updateConfigs,
  });

  window.addEventListener("beforeunload", () => {
    mutationObserver.disconnect();
    stopPolling();
    unmountAllInsertions(instanceMap);
  });
}
