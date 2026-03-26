import type { Logger } from "@logtape/logtape";
import * as React from "react";
import ReactDOM from "react-dom/client";

import type { AccountListInsertionConfig } from "@/shared/@model/insertion-configs/account-list";
import type { UserConfig } from "@/shared/@model/user-config";
import { stringifyAccountIdentifier } from "@/shared/@primitives/vk";
import isolatedUiStyling from "@/shared/isolated-ui-styling.css?inline";
import { cn } from "@/shared/tailwindcss-helpers";

import {
  defineInsertionVariant,
  type GetInsertionSnapshotResult,
} from "../insertion-variant-typings";
import {
  type AccountListTotalCount,
  extractActiveTabContent,
  extractTotalCountFromActiveTabContent,
} from "./=account-list/active-tab";
import {
  dedupeInstanceIds,
  deriveAccountChart,
  type DerivedAccountChart,
  type DerivedAccountRow,
  mergeRememberedAccounts,
} from "./=account-list/aggregation";
import { AccountListApp, AccountListLoadingState } from "./=account-list/app";
import { createNativeListTableModeController } from "./=account-list/native-list-visibility";
import { scrollAccountListToEnd } from "./=account-list/scrolling";
import type { TableOverlayRect } from "./=account-list/table";
import { createInsertionUi } from "./shared/@markup-ui/helpers";
import type {
  AccountInsertionMarkupData,
  AccountInsertionServiceData,
} from "./shared/account-insertion-payload";
import { applyMarkupEdits } from "./shared/markup-edits";
import { resolveSelector } from "./shared/selector-resolution";

const accountListObserverDebounceMs = 500;
const accountListAutoloadIntervalMs = 1000;
const accountListAutoloadMaxIdleTicks = 3;
const accountListWarnCooldownMs = 5000;
const accountListPendingComparisonPrefixCount = 4;

type AccountListInnerData = {
  autoloadEnabled: boolean;
  rememberedAccounts: DerivedAccountRow[];
  rememberedActiveTabContent?: string;
};

type AccountListMarkupData = {
  activeTabContent?: string;
  childInstanceIds: string[];
  totalCount?: AccountListTotalCount;
};

type LookupStats = {
  notMountedCount: number;
  variantMismatchCount: number;
};

type AccountListServiceData = {
  accounts: DerivedAccountRow[];
  chart: DerivedAccountChart;
  fansDisplay: UserConfig["fansDisplay"];
  frontendBaseUrl: string;
  lookupStats: LookupStats;
};

type ActiveTabMarkupData = {
  activeTabContent?: string;
  totalCount?: AccountListTotalCount;
};

type RenderedPayloadSignature = {
  childInstanceIds: string[];
  resolvedAccountCount: number;
  resolvedAccountPrefixKeys: string[];
};

function resolveAccountListElement(
  rootElement: HTMLElement,
  selector: AccountListInsertionConfig["markup"]["data"]["accountList"],
): HTMLElement | undefined {
  return resolveSelector(rootElement, { selector });
}

function extractActiveTabDataFromMarkup({
  config,
  instanceLogger,
  rootElement,
}: {
  config: AccountListInsertionConfig;
  instanceLogger: Logger;
  rootElement: HTMLElement;
}): ActiveTabMarkupData {
  if (config.markup.data.activeTab === false) {
    return {};
  }

  const activeTabElement = resolveSelector(rootElement, {
    selector: config.markup.data.activeTab,
  });
  if (!activeTabElement) {
    instanceLogger
      .getChild(["account-list", "active-tab"])
      .warn("Could not resolve active tab element");
    return {};
  }

  const activeTabContent = extractActiveTabContent(activeTabElement);
  const totalCount = extractTotalCountFromActiveTabContent(activeTabContent);

  return {
    ...(activeTabContent ? { activeTabContent } : {}),
    ...(totalCount === undefined ? {} : { totalCount }),
  };
}

function resolveLoadMoreButton(
  rootElement: HTMLElement,
  config: AccountListInsertionConfig,
): HTMLElement | undefined {
  if (config.markup.data.loadMoreButton === false) {
    return;
  }

  return resolveSelector(rootElement, {
    selector: config.markup.data.loadMoreButton,
  });
}

function canUseLoadMoreButton(
  button: HTMLElement | undefined,
): button is HTMLElement {
  if (!button) {
    return false;
  }

  return (
    button.getAttribute("aria-disabled") !== "true" &&
    !button.hasAttribute("disabled") &&
    !(button instanceof HTMLButtonElement && button.disabled)
  );
}

function measureTableOverlayRect({
  tableMeasurerElement,
  hostElement,
}: {
  tableMeasurerElement: HTMLElement | undefined;
  hostElement: HTMLElement | undefined;
}): TableOverlayRect | undefined {
  if (!tableMeasurerElement || !hostElement) {
    return;
  }

  const accountListRect = tableMeasurerElement.getBoundingClientRect();
  const hostRect = hostElement.getBoundingClientRect();

  if (accountListRect.width <= 0 || accountListRect.height <= 0) {
    return;
  }

  const computedStyle = getComputedStyle(tableMeasurerElement);
  const hostComputedStyle = getComputedStyle(hostElement);
  const hostPaddingLeft = Number.parseFloat(hostComputedStyle.paddingLeft) || 0;
  const hostPaddingTop = Number.parseFloat(hostComputedStyle.paddingTop) || 0;

  return {
    height: accountListRect.height,
    left: accountListRect.left - hostRect.left - hostPaddingLeft,
    style: {
      paddingBottom: Number.parseFloat(computedStyle.paddingBottom) || 0,
      paddingLeft: Number.parseFloat(computedStyle.paddingLeft) || 0,
      paddingRight: Number.parseFloat(computedStyle.paddingRight) || 0,
      paddingTop: Number.parseFloat(computedStyle.paddingTop) || 0,
      ...(computedStyle.backgroundColor
        ? { backgroundColor: computedStyle.backgroundColor }
        : {}),
      ...(computedStyle.borderRadius
        ? { borderRadius: computedStyle.borderRadius }
        : {}),
    },
    top: accountListRect.top - hostRect.top - hostPaddingTop,
    width: accountListRect.width,
  };
}

function aggregateResolvedAccounts({
  childInstanceIds,
  lookupSnapshot,
}: {
  childInstanceIds: readonly string[];
  lookupSnapshot: (instanceId: string) => GetInsertionSnapshotResult;
}): {
  accounts: DerivedAccountRow[];
  lookupStats: LookupStats;
} {
  let notMountedCount = 0;
  let variantMismatchCount = 0;
  const accounts: DerivedAccountRow[] = [];

  for (const instanceId of childInstanceIds) {
    const snapshotResult = lookupSnapshot(instanceId);
    if (!snapshotResult.success) {
      if (snapshotResult.reason === "notMounted") {
        notMountedCount += 1;
      } else if (snapshotResult.reason === "variantMismatch") {
        variantMismatchCount += 1;
      }

      continue;
    }

    /* eslint-disable @typescript-eslint/consistent-type-assertions -- account
      lookup narrows by variant; payload remains type-erased in instance map */
    const markupData = snapshotResult.snapshot
      .markupData as AccountInsertionMarkupData;
    const serviceData = snapshotResult.snapshot
      .serviceData as AccountInsertionServiceData;
    /* eslint-enable @typescript-eslint/consistent-type-assertions -- matching
      re-enablement for the temporary account payload narrowing block */

    accounts.push({
      ...(serviceData.accountAffiliation
        ? { accountAffiliation: serviceData.accountAffiliation }
        : {}),
      ...(markupData.accountAvatarUrl
        ? { accountAvatarUrl: markupData.accountAvatarUrl }
        : {}),
      accountIdentifier: markupData.accountIdentifier,
      accountName: markupData.accountName,
      instanceId: snapshotResult.snapshot.instanceId,
    });
  }

  return {
    accounts,
    lookupStats: {
      notMountedCount,
      variantMismatchCount,
    },
  };
}

function areStringArraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function getRenderedPayloadSignature(payload: {
  markupData: AccountListMarkupData;
  serviceData: AccountListServiceData;
}): RenderedPayloadSignature {
  return {
    childInstanceIds: [...payload.markupData.childInstanceIds],
    resolvedAccountCount: payload.serviceData.accounts.length,
    resolvedAccountPrefixKeys: payload.serviceData.accounts
      .slice(0, accountListPendingComparisonPrefixCount)
      .map((account) => stringifyAccountIdentifier(account.accountIdentifier)),
  };
}

function hasFreshRenderedPayload({
  lastStableSignature,
  nextPayload,
}: {
  lastStableSignature?: RenderedPayloadSignature;
  nextPayload: {
    markupData: AccountListMarkupData;
    serviceData: AccountListServiceData;
  };
}): boolean {
  if (nextPayload.serviceData.accounts.length === 0) {
    return false;
  }

  if (!lastStableSignature) {
    return true;
  }

  const nextSignature = getRenderedPayloadSignature(nextPayload);

  return (
    nextSignature.resolvedAccountCount !==
      lastStableSignature.resolvedAccountCount ||
    !areStringArraysEqual(
      nextSignature.childInstanceIds,
      lastStableSignature.childInstanceIds,
    ) ||
    !areStringArraysEqual(
      nextSignature.resolvedAccountPrefixKeys,
      lastStableSignature.resolvedAccountPrefixKeys,
    )
  );
}

export default defineInsertionVariant<
  AccountListInsertionConfig,
  AccountListInnerData,
  AccountListMarkupData,
  AccountListServiceData
>({
  defaultInnerData: {
    autoloadEnabled: false,
    rememberedAccounts: [],
  },

  getMarkupData: ({ config, instanceLogger, rootElement }) => {
    const accountListElement = resolveAccountListElement(
      rootElement,
      config.markup.data.accountList,
    );

    if (!accountListElement) {
      return;
    }

    const childInstanceIds = dedupeInstanceIds(
      [
        ...accountListElement.querySelectorAll(
          "[data-bn-insertion-instance-id]",
        ),
      ].flatMap((element) =>
        element instanceof HTMLElement &&
        element.dataset["bnInsertionInstanceId"]
          ? [element.dataset["bnInsertionInstanceId"]]
          : [],
      ),
      instanceLogger,
    );

    const activeTabData = extractActiveTabDataFromMarkup({
      config,
      instanceLogger,
      rootElement,
    });

    return {
      childInstanceIds,
      ...activeTabData,
    };
  },

  getServiceData: async ({
    innerData,
    insertionLookup,
    markupData,
    serviceLookup: { frontendService, userConfigService },
  }) => {
    const [{ fansDisplay }, frontendBaseUrl] = await Promise.all([
      userConfigService.get(),
      frontendService.getBaseUrl(),
    ]);

    const { accounts: visibleAccounts, lookupStats } =
      aggregateResolvedAccounts({
        childInstanceIds: markupData.childInstanceIds,
        lookupSnapshot: (instanceId) =>
          insertionLookup.getInsertionSnapshot(instanceId, "account"),
      });
    const rememberedAccounts =
      innerData.rememberedActiveTabContent === markupData.activeTabContent
        ? innerData.rememberedAccounts
        : [];
    const accounts = mergeRememberedAccounts({
      currentAccounts: visibleAccounts,
      rememberedAccounts,
    });

    return {
      accounts,
      chart: deriveAccountChart(accounts),
      fansDisplay,
      frontendBaseUrl,
      lookupStats,
    };
  },

  mount: ({
    config,
    contentId,
    instanceLogger,
    revalidateMarkupData,
    rootElement,
    updateInnerData,
  }) => {
    const cleanupMarkupEdits = applyMarkupEdits(
      rootElement,
      config.markup.edits,
    );

    const accountListElement = resolveAccountListElement(
      rootElement,
      config.markup.data.accountList,
    );

    const tableModeController = accountListElement
      ? createNativeListTableModeController(accountListElement)
      : undefined;

    const summaryUi = createInsertionUi({
      className: cn("bn:relative"),
      dxLabel: "summary",
      placement: config.markup.ui.summary,
      rootElement,
      tagName: "div",
    });

    const tableMeasurerUi = createInsertionUi({
      dxLabel: "table-measurer",
      placement: config.markup.ui.tableMeasurer,
      rootElement,
      tagName: "div",
    });

    const hostElement = summaryUi.element;
    const tableMeasurerElement = tableMeasurerUi.element;
    if (tableMeasurerElement) {
      tableMeasurerElement.ariaHidden = "true";
      tableMeasurerElement.hidden = false;
      tableMeasurerElement.style.opacity = "0";
      tableMeasurerElement.style.pointerEvents = "none";
    }

    const shadowRoot = hostElement?.attachShadow({ mode: "open" });
    const styleElement = shadowRoot?.ownerDocument.createElement("style");
    if (styleElement) {
      styleElement.textContent = isolatedUiStyling;
      shadowRoot?.append(styleElement);
    }

    const appRootElement = shadowRoot?.ownerDocument.createElement("div");
    if (appRootElement) {
      appRootElement.id = "root";
      shadowRoot?.append(appRootElement);
      appRootElement.style.height = "100%";
      appRootElement.style.width = "100%";
    }

    const reactRoot = appRootElement
      ? ReactDOM.createRoot(appRootElement)
      : undefined;

    const schemeElement = document.querySelector(
      "[scheme='vkcom_dark'], [scheme='vkcom_light']",
    );

    let latestRenderPayload:
      | {
          innerData: AccountListInnerData;
          markupData: AccountListMarkupData;
          serviceData: AccountListServiceData;
        }
      | undefined;

    let lastWarnAtByKind: Partial<Record<keyof LookupStats, number>> = {};
    let idleAutoloadTicks = 0;
    let lastAutoloadProgressCount = -1;
    let isAwaitingFreshActiveTabData = false;
    let lastStableActiveTabContent: string | undefined;
    let lastStableRenderedPayloadSignature:
      | RenderedPayloadSignature
      | undefined;
    let lastTableBottomLoadCount = -1;
    let latestTableOverlayRect: TableOverlayRect | undefined;
    let pendingActiveTabContent: string | undefined;
    let observerTimeoutId: ReturnType<typeof setTimeout> | undefined;

    function syncTableOverlayRect() {
      latestTableOverlayRect = measureTableOverlayRect({
        hostElement,
        tableMeasurerElement,
      });
    }

    function requestMoreAccounts():
      | "triggered"
      | "unavailable"
      | "waitingForButton" {
      const loadMoreButton = resolveLoadMoreButton(rootElement, config);
      if (loadMoreButton) {
        if (!canUseLoadMoreButton(loadMoreButton)) {
          return "waitingForButton";
        }

        loadMoreButton.click();
        return "triggered";
      }

      if (!accountListElement) {
        return "unavailable";
      }

      scrollAccountListToEnd(accountListElement);
      return "triggered";
    }

    function requestMoreAccountsFromTable() {
      const payload = latestRenderPayload;
      if (!payload) {
        return;
      }

      const loadedAccountCount = payload.serviceData.accounts.length;
      if (loadedAccountCount === lastTableBottomLoadCount) {
        return;
      }

      const requestResult = requestMoreAccounts();
      if (requestResult === "triggered") {
        lastTableBottomLoadCount = loadedAccountCount;
      }
    }

    function renderLoadingShell() {
      if (!reactRoot || !hostElement) {
        return;
      }

      syncTableOverlayRect();

      const tableOverlayRect = latestTableOverlayRect;
      const shouldKeepTableCover =
        latestRenderPayload?.serviceData.fansDisplay === "table" &&
        tableOverlayRect !== undefined;

      if (shouldKeepTableCover) {
        tableModeController?.enable();
      } else {
        tableModeController?.disable();
      }

      hostElement.hidden = false;
      reactRoot.render(
        React.createElement(AccountListLoadingState, {
          ...(shouldKeepTableCover
            ? {
                contentId,
                frontendBaseUrl:
                  latestRenderPayload?.serviceData.frontendBaseUrl ?? "",
                onRequestMoreAccountsFromTable: requestMoreAccountsFromTable,
                showTableOverlay: true,
                tableOverlayRect,
              }
            : {}),
          darkTheme: schemeElement?.getAttribute("scheme") === "vkcom_dark",
        }),
      );
    }

    function captureStableRenderedState(payload: {
      markupData: AccountListMarkupData;
      serviceData: AccountListServiceData;
    }) {
      lastStableActiveTabContent = payload.markupData.activeTabContent;
      lastStableRenderedPayloadSignature = getRenderedPayloadSignature(payload);
    }

    function setAutoloadEnabled(nextValue: boolean) {
      if (nextValue) {
        idleAutoloadTicks = 0;
        lastAutoloadProgressCount =
          latestRenderPayload?.serviceData.accounts.length ?? -1;
      } else {
        idleAutoloadTicks = 0;
      }

      updateInnerData((draft) => {
        draft.autoloadEnabled = nextValue;
      });
    }

    function getCurrentActiveTabContent(): string | undefined {
      const activeTabData = extractActiveTabDataFromMarkup({
        config,
        instanceLogger,
        rootElement,
      });

      return activeTabData.activeTabContent;
    }

    function enterPendingActiveTabState(
      nextActiveTabContent: string | undefined,
    ) {
      isAwaitingFreshActiveTabData = true;
      pendingActiveTabContent = nextActiveTabContent;
      lastTableBottomLoadCount = -1;
      idleAutoloadTicks = 0;
      lastAutoloadProgressCount = -1;

      updateInnerData((draft) => {
        draft.autoloadEnabled = false;
        draft.rememberedAccounts = [];

        if (nextActiveTabContent === undefined) {
          delete draft.rememberedActiveTabContent;
        } else {
          draft.rememberedActiveTabContent = nextActiveTabContent;
        }
      });

      tableModeController?.disable();
      renderLoadingShell();
    }

    function warnAboutLookupCount(kind: keyof LookupStats, count: number) {
      if (count <= 0) {
        return;
      }

      const now = Date.now();
      const lastWarnAt = lastWarnAtByKind[kind] ?? 0;
      if (now - lastWarnAt < accountListWarnCooldownMs) {
        return;
      }

      lastWarnAtByKind = {
        ...lastWarnAtByKind,
        [kind]: now,
      };

      instanceLogger.warn(
        kind === "notMountedCount"
          ? "Skipped {count} nested account insertions because they are not mounted yet"
          : "Skipped {count} nested insertions with unexpected variant inside account list",
        {
          count,
        },
      );
    }

    function renderReactTree() {
      if (!reactRoot || !hostElement) {
        return;
      }

      const payload = latestRenderPayload;
      if (!payload || payload.serviceData.accounts.length === 0) {
        renderLoadingShell();
        tableModeController?.disable();
        return;
      }

      if (isAwaitingFreshActiveTabData) {
        const activeTabContentMatches =
          payload.markupData.activeTabContent === pendingActiveTabContent;

        if (
          !activeTabContentMatches ||
          !hasFreshRenderedPayload({
            nextPayload: payload,
            ...(lastStableRenderedPayloadSignature === undefined
              ? {}
              : {
                  lastStableSignature: lastStableRenderedPayloadSignature,
                }),
          })
        ) {
          renderLoadingShell();
          tableModeController?.disable();
          return;
        }

        isAwaitingFreshActiveTabData = false;
        pendingActiveTabContent = undefined;
      }

      syncTableOverlayRect();

      warnAboutLookupCount(
        "notMountedCount",
        payload.serviceData.lookupStats.notMountedCount,
      );
      warnAboutLookupCount(
        "variantMismatchCount",
        payload.serviceData.lookupStats.variantMismatchCount,
      );

      hostElement.hidden = false;

      const shouldEnableTableMode =
        payload.serviceData.fansDisplay === "table" &&
        latestTableOverlayRect !== undefined;

      if (shouldEnableTableMode) {
        tableModeController?.enable();
      } else {
        tableModeController?.disable();
      }

      reactRoot.render(
        React.createElement(AccountListApp, {
          accounts: payload.serviceData.accounts,
          autoloadEnabled: payload.innerData.autoloadEnabled,
          chart: payload.serviceData.chart,
          contentId,
          darkTheme: schemeElement?.getAttribute("scheme") === "vkcom_dark",
          fansDisplay: payload.serviceData.fansDisplay,
          frontendBaseUrl: payload.serviceData.frontendBaseUrl,
          loadedAccountCount: payload.serviceData.accounts.length,
          onRequestMoreAccountsFromTable: requestMoreAccountsFromTable,
          onAutoloadEnabledChange: setAutoloadEnabled,
          showAutoloadToggle: Boolean(accountListElement),
          tableOverlayRect: latestTableOverlayRect,
          totalCount: payload.markupData.totalCount,
        }),
      );

      captureStableRenderedState(payload);
      updateInnerData((draft) => {
        draft.rememberedAccounts = payload.serviceData.accounts;

        if (payload.markupData.activeTabContent === undefined) {
          delete draft.rememberedActiveTabContent;
        } else {
          draft.rememberedActiveTabContent =
            payload.markupData.activeTabContent;
        }
      });
    }

    const rootObserver =
      hostElement === undefined
        ? undefined
        : new MutationObserver(() => {
            const currentActiveTabContent = getCurrentActiveTabContent();
            if (
              lastStableActiveTabContent !== undefined &&
              currentActiveTabContent !== undefined &&
              currentActiveTabContent !== lastStableActiveTabContent
            ) {
              enterPendingActiveTabState(currentActiveTabContent);
            }

            clearTimeout(observerTimeoutId);
            observerTimeoutId = setTimeout(() => {
              revalidateMarkupData();
            }, accountListObserverDebounceMs);
          });

    if (rootObserver) {
      rootObserver.observe(rootElement, {
        attributeFilter: [
          "aria-selected",
          "data-bn-insertion-instance-id",
          "data-bn-insertion-markup-data",
          "data-bn-insertion-service-data",
        ],
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    const tableMeasurerResizeObserver = tableMeasurerElement
      ? new ResizeObserver(() => {
          syncTableOverlayRect();
          renderReactTree();
        })
      : undefined;

    if (tableMeasurerElement && tableMeasurerResizeObserver) {
      tableMeasurerResizeObserver.observe(tableMeasurerElement);
    }

    const schemeObserver = schemeElement
      ? new MutationObserver(() => {
          renderReactTree();
        })
      : undefined;

    if (schemeElement && schemeObserver) {
      schemeObserver.observe(schemeElement, {
        attributeFilter: ["scheme"],
        attributes: true,
      });
    }

    const autoloadIntervalId = setInterval(() => {
      const payload = latestRenderPayload;
      if (!payload?.innerData.autoloadEnabled) {
        return;
      }

      const loadedAccountCount = payload.serviceData.accounts.length;
      const totalCount = payload.markupData.totalCount;

      if (
        totalCount?.approximation === undefined &&
        totalCount !== undefined &&
        loadedAccountCount >= totalCount.value
      ) {
        setAutoloadEnabled(false);
        return;
      }

      const requestResult = requestMoreAccounts();
      if (requestResult === "unavailable") {
        setAutoloadEnabled(false);
        return;
      }

      if (loadedAccountCount > lastAutoloadProgressCount) {
        lastAutoloadProgressCount = loadedAccountCount;
        idleAutoloadTicks = 0;
      } else {
        idleAutoloadTicks += 1;
      }

      if (idleAutoloadTicks >= accountListAutoloadMaxIdleTicks) {
        setAutoloadEnabled(false);
        return;
      }
    }, accountListAutoloadIntervalMs);

    renderLoadingShell();

    return {
      render: (payload) => {
        latestRenderPayload = payload;
        renderReactTree();
      },

      unmount: () => {
        clearInterval(autoloadIntervalId);
        clearTimeout(observerTimeoutId);
        tableMeasurerResizeObserver?.disconnect();
        schemeObserver?.disconnect();
        rootObserver?.disconnect();
        tableModeController?.disable();
        reactRoot?.unmount();
        tableMeasurerElement?.remove();
        hostElement?.remove();
        cleanupMarkupEdits();
      },
    };
  },
});
