import type { Logger } from "@logtape/logtape";

import { defaultDxConfig, type DxConfig } from "@/shared/@model/dx-config";
import type { InsertionConfig } from "@/shared/@model/insertion-configs";
import type { StaticListItem } from "@/shared/@model/static-lists";
import type { PollVersion } from "@/shared/@pollable/core";
import type { ContentId } from "@/shared/@primitives/misc";
import {
  dxConfigService,
  extensionVersionService,
  frontendService,
  staticListsService,
  userConfigService,
} from "@/shared/proxy-services";

import type { DerivedPageInfo } from "../derived-page-info";
import {
  type InsertionInstanceMap,
  mountNewInsertions,
  refreshExistingInsertions,
  syncElementDataAttributes,
} from "./instance-lifecycle";

let lastInsertionConfigs: InsertionConfig[] | undefined;

let lastDxInsertionsRemoved: boolean | undefined;
let lastDxInsertionForceRerenderedAt: string | undefined;
let lastDxConfig: DxConfig = defaultDxConfig;

export function startGlobalRerenderPolling({
  contentId,
  contentLogger,
  derivedPageInfo,
  getConfigs,
  initialDxConfig,
  instanceMap,
  onConfigsChanged,
  onDxConfigChanged,
}: {
  derivedPageInfo: DerivedPageInfo;
  contentId: ContentId;
  contentLogger: Logger;
  getConfigs: () => InsertionConfig[];
  initialDxConfig: DxConfig;
  instanceMap: InsertionInstanceMap;
  onConfigsChanged: (configs: InsertionConfig[]) => void;
  onDxConfigChanged?: (dxConfig: DxConfig) => void;
}): () => void {
  let disposed = false;
  lastDxConfig = initialDxConfig;

  const logger = contentLogger.getChild([
    "insertion-management",
    "global-rerender",
  ]);

  type ThingToPoll<T = unknown> = {
    id: string;
    poll: (
      version: PollVersion | undefined,
    ) => Promise<{ version: PollVersion; value: T }>;
    onVersionChange?: (value: T) => void;
  };

  // Define triggerRefreshAndMount before thingsToPoll to avoid use-before-define
  function triggerRefreshAndMount() {
    mountNewInsertions({
      configs: getConfigs(),
      instanceMap,
      contentId,
      contentLogger,
      derivedPageInfo,
      dxConfig: lastDxConfig,
    });
    refreshExistingInsertions({
      contentId,
      contentLogger,
      derivedPageInfo,
      instanceMap,
      dxConfig: lastDxConfig,
    });
  }

  lastInsertionConfigs = getConfigs();

  const thingsToPoll = [
    {
      id: "frontend-base-url",
      poll: (v) => frontendService.pollBaseUrl(v),
    } satisfies ThingToPoll,
    {
      id: "filtered-insertions",
      poll: (v) => extensionVersionService.pollFilteredInsertions(v),
      onVersionChange: (value) => {
        lastInsertionConfigs = value;
        onConfigsChanged(lastDxInsertionsRemoved ? [] : lastInsertionConfigs);
      },
    } satisfies ThingToPoll<Array<StaticListItem<"insertions">>>,
    {
      id: "accounts-list-summary",
      poll: (v) => staticListsService.pollListSummary(v, "accounts"),
    } satisfies ThingToPoll,
    {
      id: "accounts-list-updated-at",
      poll: (v) => staticListsService.pollListUpdatedAt(v, "accounts"),
    } satisfies ThingToPoll,
    {
      id: "tags-list-summary",
      poll: (v) => staticListsService.pollListSummary(v, "tags"),
    } satisfies ThingToPoll,
    {
      id: "tags-list-updated-at",
      poll: (v) => staticListsService.pollListUpdatedAt(v, "tags"),
    } satisfies ThingToPoll,
    {
      id: "dx-config",
      poll: (v) => dxConfigService.poll(v),
      onVersionChange: (dxConfig) => {
        const currentInsertionsRemoved = dxConfig.insertionsRemoved;
        const currentInsertionForceRenderedAtAt =
          dxConfig.insertionForceRerenderedAt;

        // Handle hidden state toggle
        if (currentInsertionsRemoved !== lastDxInsertionsRemoved) {
          logger.debug(
            currentInsertionsRemoved
              ? "Hiding all insertions (filtering configs to zero)"
              : "Showing insertions (restoring config filter)",
          );

          lastDxInsertionsRemoved = currentInsertionsRemoved;
          onConfigsChanged(
            lastDxInsertionsRemoved ? [] : (lastInsertionConfigs ?? []),
          );
        }

        // Handle force rerender (re-render all mounted insertions without remounting)
        if (
          currentInsertionForceRenderedAtAt !== lastDxInsertionForceRerenderedAt
        ) {
          logger.debug("Force rerendering all insertions");
          for (const instance of instanceMap.values()) {
            if ("render" in instance) {
              instance.render({
                innerData: instance.innerData,
                markupData: instance.markupData,
                serviceData: instance.serviceData,
              });
            }
          }
          lastDxInsertionForceRerenderedAt = currentInsertionForceRenderedAtAt;
        }

        if (
          dxConfig.insertionDataInDom !== lastDxConfig.insertionDataInDom ||
          dxConfig.insertionLabeling !== lastDxConfig.insertionLabeling ||
          dxConfig.insertionFraming !== lastDxConfig.insertionFraming
        ) {
          for (const instance of instanceMap.values()) {
            syncElementDataAttributes(instance.rootElement, dxConfig, {
              innerData: instance.innerData,
              ...("markupData" in instance && {
                markupData: instance.markupData,
              }),
              ...("serviceData" in instance && {
                serviceData: instance.serviceData,
              }),
            });
          }
        }

        lastDxConfig = dxConfig;
        onDxConfigChanged?.(dxConfig);
      },
    } satisfies ThingToPoll<DxConfig>,
    {
      id: "user-config",
      poll: (v) => userConfigService.poll(v),
    } satisfies ThingToPoll,
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic use of any entry
  async function watch(thingToPoll: ThingToPoll<any>) {
    const initial = await thingToPoll.poll(undefined);
    let lastPollVersion = initial.version;

    for (;;) {
      const result = await thingToPoll.poll(lastPollVersion);

      if (disposed) {
        break;
      }

      if (result.version !== lastPollVersion) {
        logger.debug(`${thingToPoll.id} changed, refreshing insertions`);
        thingToPoll.onVersionChange?.(result.value);
        triggerRefreshAndMount();
      }

      lastPollVersion = result.version;
    }
  }

  for (const entry of thingsToPoll) {
    void watch(entry);
  }

  return () => {
    disposed = true;
  };
}
