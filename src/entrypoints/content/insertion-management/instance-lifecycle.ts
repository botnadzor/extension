import type { Logger } from "@logtape/logtape";
import { isEqual } from "es-toolkit";
import { produce } from "immer";
import { nanoid } from "nanoid";
import type { JsonObject } from "type-fest";

import type { InsertionConfig } from "@/shared/@model/insertion-configs";
import type { ContentId } from "@/shared/@primitives/misc";
import { getContentLogger } from "@/shared/logging";
import {
  affiliationService,
  collectingService,
  frontendService,
  inspectorService,
  notificationService,
  regDateService,
} from "@/shared/proxy-services";

import type { DerivedPageInfo } from "../derived-page-info";
import type {
  BlankInsertionInstance,
  InsertionInstance,
  InsertionInstanceWithServiceData,
  MountedInsertionInstance,
} from "../insertion-instance-typings";
import type {
  AvailableServiceLookup,
  BaseInsertionVariantDefinition,
} from "../insertion-variant-typings";
import { insertionVariantLookup } from "../insertion-variants";

const insertionInstanceIdKey = "bnInsertionInstanceId";

const insertionInnerDataKey = "bnInsertionInnerData";
const insertionMarkupDataKey = "bnInsertionMarkupData";
const insertionServiceDataKey = "bnInsertionServiceData";

export type InsertionInstanceMap = Map<string, InsertionInstance>;

const serviceLookup: AvailableServiceLookup = {
  affiliationService,
  collectingService,
  frontendService,
  inspectorService,
  notificationService,
  regDateService,
};

type InstanceForObtainingData = Pick<
  InsertionInstanceWithServiceData,
  "config" | "innerData" | "rootElement"
>;

async function obtainMarkupAndServiceData(
  instance: InstanceForObtainingData,
  definition: BaseInsertionVariantDefinition,
  derivedPageInfo: DerivedPageInfo,
  instanceLogger: Logger,
): Promise<{ markupData: JsonObject; serviceData: JsonObject } | undefined> {
  const markupData = await Promise.resolve(
    definition.getMarkupData({
      config: instance.config,
      derivedPageInfo,
      instanceLogger,
      rootElement: instance.rootElement,
    }),
  );
  if (markupData === undefined) {
    return undefined;
  }
  const serviceData = await Promise.resolve(
    definition.getServiceData({
      config: instance.config,
      derivedPageInfo,
      instanceLogger,
      innerData: instance.innerData,
      markupData,
      serviceLookup,
    }),
  );
  return { markupData, serviceData };
}

export function mountInstance(
  instance: InsertionInstanceWithServiceData,
  contentId: ContentId,
  instanceMap: InsertionInstanceMap,
  derivedPageInfo: DerivedPageInfo,
): MountedInsertionInstance {
  const definition = insertionVariantLookup[instance.config.variant];

  const instanceLogger = getContentLogger([
    "insertion-instance",
    instance.config.id,
  ]);

  function revalidateMarkupData(): void {
    void (async () => {
      const current = instanceMap.get(instance.instanceId);
      if (
        !current ||
        !("markupData" in current) ||
        !("serviceData" in current) ||
        !("render" in current)
      ) {
        return;
      }

      const result = await obtainMarkupAndServiceData(
        current,
        definition,
        derivedPageInfo,
        instanceLogger,
      );
      if (result === undefined) {
        return;
      }

      const { markupData: newMarkupData, serviceData: newServiceData } = result;
      const instanceAfterRevalidate = instanceMap.get(instance.instanceId);
      if (!instanceAfterRevalidate || !("render" in instanceAfterRevalidate)) {
        return;
      }

      const dataChanged =
        !isEqual(newMarkupData, instanceAfterRevalidate.markupData) ||
        !isEqual(newServiceData, instanceAfterRevalidate.serviceData);
      if (!dataChanged) {
        return;
      }

      instanceAfterRevalidate.rootElement.dataset[insertionMarkupDataKey] =
        JSON.stringify(newMarkupData);
      instanceAfterRevalidate.rootElement.dataset[insertionServiceDataKey] =
        JSON.stringify(newServiceData);

      instanceMap.set(instance.instanceId, {
        ...instanceAfterRevalidate,
        markupData: newMarkupData,
        serviceData: newServiceData,
      });

      instanceAfterRevalidate.render({
        innerData: instanceAfterRevalidate.innerData,
        markupData: newMarkupData,
        serviceData: newServiceData,
      });
    })();
  }

  const { render, unmount } = definition.mount({
    config: instance.config,
    contentId,
    derivedPageInfo,
    instanceLogger,
    revalidateMarkupData,
    rootElement: instance.rootElement,
    serviceLookup,
    updateInnerData: (recipe) => {
      const latestInstance = instanceMap.get(instance.instanceId);
      if (!latestInstance) {
        return;
      }
      const newInnerData = produce(latestInstance.innerData, recipe);

      // Only trigger re-render if state actually changed (deep equality)
      if (!isEqual(newInnerData, latestInstance.innerData)) {
        // Update the instance's state in the map
        const current = instanceMap.get(latestInstance.instanceId);
        if (current) {
          instanceMap.set(latestInstance.instanceId, {
            ...current,
            innerData: newInnerData,
          });
        }

        // Trigger re-render automatically
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- mutually recursive with mountInstance; call is deferred via callback
        requestInstanceRerender(instance.instanceId, instanceMap);
      }
    },
  });

  render({
    innerData: instance.innerData,
    markupData: instance.markupData,
    serviceData: instance.serviceData,
  });

  return { ...instance, render, unmount };
}

function requestInstanceRerender(
  instanceId: string,
  instanceMap: InsertionInstanceMap,
): void {
  const instance = instanceMap.get(instanceId);
  if (!instance || !("render" in instance)) {
    return;
  }

  const expectedNewVersion = instance.version + 1;
  instanceMap.set(instanceId, {
    ...instance,
    version: expectedNewVersion,
  });

  // Schedule re-render on next microtask
  void Promise.resolve().then(() => {
    const current = instanceMap.get(instanceId);
    if (current?.version !== expectedNewVersion || !("render" in current)) {
      return;
    }

    current.render({
      innerData: current.innerData,
      markupData: current.markupData,
      serviceData: current.serviceData,
    });

    current.rootElement.dataset[insertionInnerDataKey] = JSON.stringify(
      current.innerData,
    );

    current.rootElement.dataset[insertionServiceDataKey] = JSON.stringify(
      current.serviceData,
    );
  });
}

export function unmountInstance(
  instanceMap: InsertionInstanceMap,
  instanceId: string,
): void {
  const instance = instanceMap.get(instanceId);
  if (!instance) {
    return;
  }

  if ("unmount" in instance) {
    instance.unmount();
  }

  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- key is a runtime const
  delete instance.rootElement.dataset[insertionInstanceIdKey];
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- key is a runtime const
  delete instance.rootElement.dataset[insertionMarkupDataKey];
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- key is a runtime const
  delete instance.rootElement.dataset[insertionServiceDataKey];
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- key is a runtime const
  delete instance.rootElement.dataset[insertionInnerDataKey];
  instanceMap.delete(instanceId);
}

export function unmountAllInsertions(instanceMap: InsertionInstanceMap): void {
  const instanceIds = [...instanceMap.keys()];
  for (const instanceId of instanceIds) {
    unmountInstance(instanceMap, instanceId);
  }
}

export function mountNewInsertions({
  configs,
  instanceMap,
  contentId,
  derivedPageInfo,
}: {
  configs: InsertionConfig[];
  contentId: ContentId;
  derivedPageInfo: DerivedPageInfo;
  instanceMap: InsertionInstanceMap;
}): void {
  const logger = getContentLogger(["insertion-management", "mount"]);

  let newInstanceCount = 0;

  for (const config of configs) {
    const definition = insertionVariantLookup[config.variant];

    const elements = document.querySelectorAll(config.selector);

    for (const rootElement of elements) {
      if (!(rootElement instanceof HTMLElement)) {
        continue;
      }

      if (rootElement.dataset[insertionInstanceIdKey]) {
        continue;
      }

      let instanceId: string;
      do {
        instanceId = `${config.id}|${nanoid(8)}`;
      } while (instanceMap.has(instanceId));

      const instanceLogger = getContentLogger([
        "insertion-instance",
        instanceId,
      ]);

      const initialVersion = 0;
      const initialInnerData = definition.defaultInnerData;

      rootElement.dataset[insertionInstanceIdKey] = instanceId;
      rootElement.dataset[insertionInnerDataKey] =
        JSON.stringify(initialInnerData);

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- key is a runtime const
      delete rootElement.dataset[insertionMarkupDataKey];
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- key is a runtime const
      delete rootElement.dataset[insertionServiceDataKey];

      const blankInstance: BlankInsertionInstance = {
        config,
        innerData: initialInnerData,
        instanceId,
        rootElement,
        version: initialVersion,
      };
      instanceMap.set(instanceId, blankInstance);

      newInstanceCount += 1;

      void Promise.resolve()
        .then(() => {
          const instanceAfterMarkup = instanceMap.get(instanceId);
          if (instanceAfterMarkup?.version !== initialVersion) {
            return;
          }
          return obtainMarkupAndServiceData(
            instanceAfterMarkup,
            definition,
            derivedPageInfo,
            instanceLogger,
          );
        })
        .then((result) => {
          if (!result) {
            return;
          }

          const { markupData, serviceData } = result;
          const instance = instanceMap.get(instanceId);

          if (instance?.version !== initialVersion) {
            return;
          }

          instance.rootElement.dataset[insertionMarkupDataKey] =
            JSON.stringify(markupData);
          instance.rootElement.dataset[insertionServiceDataKey] =
            JSON.stringify(serviceData);

          const mountedInstance = mountInstance(
            { ...instance, markupData, serviceData },
            contentId,
            instanceMap,
            derivedPageInfo,
          );

          instanceMap.set(instanceId, mountedInstance);
        })
        .catch((error: unknown) => {
          instanceLogger.error("Error mounting insertion: {error}", {
            error,
          });
        });
    }
  }

  if (newInstanceCount > 0) {
    logger.debug("Mounted {count} new insertion(s)", {
      count: newInstanceCount,
    });
  }
}

export function refreshExistingInsertions({
  instanceMap,
  contentId,
  derivedPageInfo,
}: {
  contentId: ContentId;
  derivedPageInfo: DerivedPageInfo;
  instanceMap: InsertionInstanceMap;
}): void {
  const logger = getContentLogger(["insertion-management", "refresh"]);

  for (const [instanceId, instance] of instanceMap) {
    if (!document.contains(instance.rootElement)) {
      unmountInstance(instanceMap, instanceId);
      continue;
    }

    const definition = insertionVariantLookup[instance.config.variant];

    const instanceLogger = getContentLogger([
      "insertion-instance",
      instance.config.id,
    ]);

    const expectedNewVersion = instance.version + 1;
    instanceMap.set(instanceId, {
      ...instance,
      version: expectedNewVersion,
    });

    void Promise.resolve()
      .then(async () => {
        const current = instanceMap.get(instanceId);
        if (current?.version !== expectedNewVersion) {
          return { skipped: true } as const;
        }
        const data = await obtainMarkupAndServiceData(
          current,
          definition,
          derivedPageInfo,
          instanceLogger,
        );
        return { data };
      })
      .then((result) => {
        if ("skipped" in result) {
          return;
        }
        if (result.data === undefined) {
          unmountInstance(instanceMap, instanceId);
          return;
        }

        const { markupData: newMarkupData, serviceData: newServiceData } =
          result.data;
        const instanceAfterData = instanceMap.get(instanceId);

        if (instanceAfterData?.version !== expectedNewVersion) {
          return;
        }

        if (
          "serviceData" in instanceAfterData &&
          isEqual(newServiceData, instanceAfterData.serviceData) &&
          isEqual(newMarkupData, instanceAfterData.markupData)
        ) {
          return;
        }

        logger.debug("Data changed for {instanceId}, re-rendering", {
          instanceId,
        });

        instanceAfterData.rootElement.dataset[insertionInnerDataKey] =
          JSON.stringify(instanceAfterData.innerData);
        instanceAfterData.rootElement.dataset[insertionMarkupDataKey] =
          JSON.stringify(newMarkupData);
        instanceAfterData.rootElement.dataset[insertionServiceDataKey] =
          JSON.stringify(newServiceData);

        if ("unmount" in instanceAfterData) {
          instanceAfterData.unmount();
        }

        const mountedInstance = mountInstance(
          {
            ...instanceAfterData,
            markupData: newMarkupData,
            serviceData: newServiceData,
          },
          contentId,
          instanceMap,
          derivedPageInfo,
        );

        instanceMap.set(instanceId, mountedInstance);
      })
      .catch((error: unknown) => {
        instanceLogger.error("Error refreshing insertion: {error}", {
          error,
        });
      });
  }
}
