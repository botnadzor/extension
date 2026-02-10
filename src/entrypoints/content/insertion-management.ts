import { nanoid } from "nanoid";

import type { ContentId } from "@/shared/@primitives/misc";
import { getContentLogger } from "@/shared/logging";

import type { DerivedPageInfo } from "./derived-page-info";
import type {
  Insertion,
  InsertionCleanupFunction,
  InsertionInstance,
} from "./insertion-basics";
import insertionStyling from "./insertion-styling.css?inline";
import { insertionLookup } from "./insertions";

const insertionInstanceIdKey = "bnInsertionInstanceId";

const insertionInstanceMap = new Map<string, InsertionInstance>();

export function startManagingInsertions({
  archivedSnapshot,
  contentId,
  websiteVariant,
}: DerivedPageInfo & { contentId: ContentId }): void {
  const logger = getContentLogger(["insertion-management"]);

  const style = document.createElement("style");
  style.textContent = insertionStyling;
  document.head.append(style);

  const pickedInsertionLookup: Record<string, Insertion> = {};

  for (const [insertionKey, insertion] of Object.entries(insertionLookup)) {
    if (insertion.appliesToArchivedSnapshotsOnly && !archivedSnapshot) {
      continue;
    }

    if (insertion.appliesTo !== websiteVariant) {
      continue;
    }

    pickedInsertionLookup[insertionKey] = insertion;
  }

  logger.info(
    "Picked insertions ({pickedInsertionsCount} / {allInsertionsCount}): {pickedInsertionKeys}",
    {
      allInsertionsCount: Object.keys(insertionLookup).length,
      pickedInsertionsCount: Object.keys(pickedInsertionLookup).length,
      pickedInsertionKeys: Object.keys(pickedInsertionLookup),
    },
  );

  function mountInsertions() {
    logger.debug("Mounting insertions");

    let newInsertionInstanceCount = 0;

    for (const [insertionKey, insertion] of Object.entries(
      pickedInsertionLookup,
    )) {
      const insertionLogger = getContentLogger(["insertion", insertionKey]);

      const elements = document.querySelectorAll(insertion.elementSelector);
      if (elements.length === 0) {
        insertionLogger.debug("No elements found");
        continue;
      }

      insertionLogger.debug("{elementCount} element(s) found", {
        elementCount: elements.length,
      });

      for (const element of elements) {
        if (!(element instanceof HTMLElement)) {
          insertionLogger.warn("Element is not an HTMLElement");
          continue;
        }

        const existingInsertionInstanceId =
          element.dataset[insertionInstanceIdKey];

        if (existingInsertionInstanceId) {
          insertionLogger.debug(
            "Matched element already has an insertion instance {existingInsertionInstanceId}",
            { existingInsertionInstanceId },
          );
          continue;
        }

        let insertionInstanceId;
        do {
          insertionInstanceId = insertionKey + "|" + nanoid(8);
        } while (insertionInstanceMap.has(insertionInstanceId));

        const insertionInstanceLogger = getContentLogger([
          "insertion-instance",
          insertionInstanceId,
        ]);

        element.dataset[insertionInstanceIdKey] = insertionInstanceId;

        insertionInstanceMap.set(insertionInstanceId, {
          insertion,
          instanceId: insertionInstanceId,
          element,
        });

        newInsertionInstanceCount += 1;

        let initResult:
          | InsertionCleanupFunction
          | Promise<InsertionCleanupFunction | undefined>
          | undefined;

        try {
          initResult = insertion.init({
            contentId,
            element,
            logger: insertionInstanceLogger,
            archivedSnapshot,
          });
        } catch (error) {
          insertionInstanceLogger.error(
            "Error initializing insertion: {error}",
            { error },
          );
        }

        if (typeof initResult === "function") {
          insertionInstanceMap.set(insertionInstanceId, {
            insertion,
            instanceId: insertionInstanceId,
            element,
            cleanup: initResult,
          });
        }

        if (initResult instanceof Promise) {
          void initResult
            .then((cleanup) => {
              if (typeof cleanup === "function") {
                insertionInstanceMap.set(insertionInstanceId, {
                  insertion,
                  instanceId: insertionInstanceId,
                  element,
                  cleanup,
                });
              }
            })
            .catch((error: unknown) => {
              insertionInstanceLogger.error(
                "Error initializing insertion: {error}",
                {
                  error,
                },
              );
            });
        }
      }
    }

    logger.debug(`Insertions mounted: ${newInsertionInstanceCount}`, {
      newInsertionInstanceCount,
    });
  }

  mountInsertions();

  let throttleTimeout: number | undefined;
  const mutationObserver = new MutationObserver(() => {
    if (throttleTimeout !== undefined) {
      return;
    }

    throttleTimeout = window.setTimeout(() => {
      mountInsertions();
      throttleTimeout = undefined;
    }, 100);
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("beforeunload", () => {
    mutationObserver.disconnect();
  });
}
