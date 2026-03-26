import { LoaderCircleIcon } from "lucide-react";
import * as React from "react";

import type { ContentId } from "@/shared/@primitives/misc";
import { Checkbox } from "@/shared/@ui-primitives/checkbox";
import { Label } from "@/shared/@ui-primitives/label";
import { formatInt } from "@/shared/formatting";

import type { AccountListTotalCount } from "./active-tab";
import type { DerivedAccountChart, DerivedAccountRow } from "./aggregation";
import { AccountListAppShell } from "./app-shell";
import { AccountListChart } from "./chart";
import { AccountListTable, type TableOverlayRect } from "./table";

const fallbackChartSize = {
  height: 160,
  width: 600,
};

function useObservedElementSize(): [
  (element: HTMLDivElement | null) => void,
  {
    height: number;
    width: number;
  },
] {
  const [element, setElement] = React.useState<HTMLDivElement | undefined>();
  const [size, setSize] = React.useState(fallbackChartSize);

  React.useEffect(() => {
    if (element === undefined) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      setSize({
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return [
    (nextElement) => {
      setElement(nextElement ?? undefined);
    },
    size,
  ];
}

export function AccountListApp({
  accounts,
  autoloadEnabled,
  chart,
  contentId,
  darkTheme,
  fansDisplay,
  frontendBaseUrl,
  loadedAccountCount,
  onRequestMoreAccountsFromTable,
  showAutoloadToggle,
  tableOverlayRect,
  totalCount,
  onAutoloadEnabledChange,
}: {
  accounts: readonly DerivedAccountRow[];
  autoloadEnabled: boolean;
  chart: DerivedAccountChart;
  contentId: ContentId;
  darkTheme: boolean;
  fansDisplay: "default" | "table";
  frontendBaseUrl: string;
  loadedAccountCount: number;
  onRequestMoreAccountsFromTable: () => void;
  showAutoloadToggle: boolean;
  tableOverlayRect?: TableOverlayRect | undefined;
  totalCount?: AccountListTotalCount | undefined;
  onAutoloadEnabledChange: (enabled: boolean) => void;
}) {
  const [setChartContainerElement, chartContainerSize] =
    useObservedElementSize();
  const [hoveredMillion, setHoveredMillion] = React.useState<
    number | undefined
  >(undefined);
  const chartHasData = chart.buckets.length > 0;
  const displayedLoadedCount =
    totalCount === undefined
      ? loadedAccountCount
      : Math.min(loadedAccountCount, totalCount.value);
  const hoveredBucket = chart.buckets.find(
    (bucket) => bucket.million === hoveredMillion,
  );
  const canRequestMoreAccountsInTable =
    totalCount === undefined ||
    totalCount.approximation !== undefined ||
    loadedAccountCount < totalCount.value;
  const shouldShowTableOverlay =
    fansDisplay === "table" && tableOverlayRect !== undefined;

  return (
    <AccountListAppShell darkTheme={darkTheme}>
      <div className="@container relative h-full overflow-visible">
        <div
          className="
            relative flex h-full flex-col gap-3 overflow-hidden text-sm
            text-foreground
          "
        >
          {chartHasData && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div
                className="
                  inline-grid w-fit max-w-60 grid-cols-[auto_1fr_auto]
                  items-center gap-x-2 gap-y-1
                "
              >
                <div className="col-span-3">
                  {hoveredBucket
                    ? `Аккаунты с айди ${hoveredBucket.million} ••• •••`
                    : "Аккаунты на графике"}
                </div>
                {chart.categories.map((category, index) => (
                  <React.Fragment key={category.id}>
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span>{category.label}</span>
                    <span
                      className="
                        min-w-10 text-right text-foreground tabular-nums
                      "
                    >
                      {formatInt(
                        hoveredBucket?.counts[index] ?? category.total,
                      )}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              <div
                className="relative min-h-0 flex-1"
                ref={setChartContainerElement}
              >
                <AccountListChart
                  chart={chart}
                  height={chartContainerSize.height}
                  hoveredMillion={hoveredMillion}
                  onHoveredMillionChange={setHoveredMillion}
                  width={chartContainerSize.width}
                />
              </div>
            </div>
          )}

          <div className="shrink-0 space-y-1.5">
            <div
              className="
                rounded-md bg-muted p-2 text-xs text-muted-foreground
                @lg:absolute @lg:top-1 @lg:right-0 @lg:left-auto @lg:ml-70
                @lg:max-w-64
              "
            >
              График показан только для загруженных аккаунтов. Подгрузка
              происходит, когда вы скроллите список.
            </div>
            <div className="flex items-center gap-4">
              <div
                className="
                  pl-2 tabular-nums
                  @lg:pl-0
                "
              >
                {totalCount === undefined
                  ? `Загружено: ${displayedLoadedCount}`
                  : `Загружено: ${displayedLoadedCount} / ${
                      totalCount.approximation === undefined ? "" : "≈"
                    }${formatInt(totalCount.value)}`}
              </div>
              {showAutoloadToggle ? (
                <Label>
                  <Checkbox
                    checked={autoloadEnabled}
                    onCheckedChange={(checked) => {
                      onAutoloadEnabledChange(checked);
                    }}
                  />
                  <span>автоподгрузка</span>
                </Label>
              ) : undefined}
            </div>
          </div>
        </div>

        {shouldShowTableOverlay ? (
          <AccountListTable
            accounts={accounts}
            autoloadEnabled={autoloadEnabled}
            canRequestMoreAccounts={canRequestMoreAccountsInTable}
            contentId={contentId}
            frontendBaseUrl={frontendBaseUrl}
            onRequestMoreAccounts={onRequestMoreAccountsFromTable}
            overlayRect={tableOverlayRect}
          />
        ) : undefined}
      </div>
    </AccountListAppShell>
  );
}

export function AccountListLoadingState({
  darkTheme,
  frontendBaseUrl,
  onRequestMoreAccountsFromTable,
  showTableOverlay = false,
  tableOverlayRect,
  contentId,
}: {
  contentId?: ContentId;
  darkTheme: boolean;
  frontendBaseUrl?: string;
  onRequestMoreAccountsFromTable?: () => void;
  showTableOverlay?: boolean;
  tableOverlayRect?: TableOverlayRect | undefined;
}) {
  return (
    <AccountListAppShell darkTheme={darkTheme}>
      <div className="relative h-full overflow-visible font-ubuntu">
        <div
          aria-hidden={true}
          className="flex h-full items-center justify-center overflow-hidden"
        >
          <LoaderCircleIcon className="size-10 animate-spin text-border" />
        </div>

        {showTableOverlay &&
        tableOverlayRect !== undefined &&
        contentId !== undefined &&
        frontendBaseUrl !== undefined &&
        onRequestMoreAccountsFromTable !== undefined ? (
          <AccountListTable
            accounts={[]}
            autoloadEnabled={false}
            canRequestMoreAccounts={false}
            contentId={contentId}
            frontendBaseUrl={frontendBaseUrl}
            onRequestMoreAccounts={onRequestMoreAccountsFromTable}
            overlayRect={tableOverlayRect}
          />
        ) : undefined}
      </div>
    </AccountListAppShell>
  );
}
