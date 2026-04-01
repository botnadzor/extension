import { upperFirst } from "es-toolkit";
import {
  DownloadIcon,
  FilterIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import {
  maxSerializedRecordCountPerLowestLogLevel,
  type SerializedLogLevel,
  serializedLogLevelLookup,
  type SerializedLogRecordWithId,
} from "@/shared/@logging/serialization";
import { type LowestLogLevel, lowestLogLevels } from "@/shared/@logging/setup";
import { baseExtensionVersionInfo } from "@/shared/@model/extension-version";
import { createPollableValueHook } from "@/shared/@pollable/react";
import { isoDateTimeSchema } from "@/shared/@primitives/temporal";
import { useAnimate } from "@/shared/@ui-helpers/use-animate";
import { Button } from "@/shared/@ui-primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/@ui-primitives/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/shared/@ui-primitives/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/@ui-primitives/select";
import { formatInt } from "@/shared/formatting";
import { loggingService, popupService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

const logLevels = lowestLogLevels;

const useDebugTabLowestLogLevel = createPollableValueHook(
  (lastPollVersion) => popupService.pollDebugTabLowestLogLevel(lastPollVersion),
  { hookNameForDebugging: "useDebugTabLowestLogLevel" },
);

const useLogRecordCount = createPollableValueHook(
  (lastPollVersion, lowestLogLevel: LowestLogLevel) =>
    loggingService.pollRecordCount(lastPollVersion, lowestLogLevel),
  {
    formatNewValueDebugLog: () => undefined, // Prevent new debug logs when looking at debug logs
    hookNameForDebugging: "useLogRecordCount",
  },
);

const useLogRecords = createPollableValueHook(
  (lastPollVersion, lowestLogLevel: LowestLogLevel) =>
    loggingService.pollRecords(lastPollVersion, lowestLogLevel),
  {
    formatNewValueDebugLog: () => undefined, // Prevent new debug logs when looking at debug logs
    hookNameForDebugging: "useLogRecords",
    throttleInterval: 500,
  },
);

function getLogLevelBadgeClassName(
  serializedLevel: SerializedLogLevel,
): string {
  switch (serializedLevel) {
    case "TRC": {
      return cn("border-slate-200 bg-slate-100 text-slate-700");
    }
    case "DBG": {
      return cn("border-sky-200 bg-sky-100 text-sky-700");
    }
    case "INF": {
      return cn("border-emerald-200 bg-emerald-100 text-emerald-700");
    }
    case "WRN": {
      return cn("border-amber-200 bg-amber-100 text-amber-700");
    }
    case "ERR": {
      return cn("border-rose-200 bg-rose-100 text-rose-700");
    }
    case "FTL": {
      return cn("border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700");
    }
  }
}

function stringifyRecordAsJsonlRow(record: SerializedLogRecordWithId): string {
  return JSON.stringify([new Date(record[1]).toISOString(), record.slice(2)]);
}

function stringifyLogRecordForSearch(
  record: SerializedLogRecordWithId,
): string {
  return [record[3].join("."), record[4]].join("\n").toLowerCase();
}

function formatLogTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    fractionalSecondDigits: 3,
  }).format(new Date(timestamp));
}

function buildExportMetaLine(lowestLogLevel: LowestLogLevel): string {
  return JSON.stringify({
    _: "meta",
    exportedAt: isoDateTimeSchema.parse(undefined),
    extension: `Botnadzor for ${upperFirst(import.meta.env.BROWSER)}`,
    versionName: baseExtensionVersionInfo.versionName,
    buildInfo: baseExtensionVersionInfo.buildInfo,
    userAgent: navigator.userAgent,
    lowestLogLevel,
  });
}

function stringifyLogRecordsAsJsonl(
  records: readonly SerializedLogRecordWithId[],
  lowestLogLevel: LowestLogLevel,
): string {
  const metaLine = buildExportMetaLine(lowestLogLevel);
  const recordLines = records.map((record) =>
    stringifyRecordAsJsonlRow(record),
  );

  return [metaLine, ...recordLines].join("\n");
}

function filterLogRecords(
  records: readonly SerializedLogRecordWithId[],
  normalizedFilter: string,
): readonly SerializedLogRecordWithId[] {
  if (normalizedFilter.length === 0) {
    return records;
  }

  return records.filter((record) =>
    stringifyLogRecordForSearch(record).includes(normalizedFilter),
  );
}

function downloadTextFile({
  fileName,
  text,
}: {
  fileName: string;
  text: string;
}) {
  const blob = new Blob([text.length === 0 ? "" : `${text}\n`], {
    type: "text/x-jsonl;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function getExportFileName(lowestLogLevel: LowestLogLevel): string {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  return `botnadzor-logs-${lowestLogLevel}-visible-${timestamp}.jsonl`;
}

function LogLevelCount({ level }: { level: LowestLogLevel }) {
  const count = useLogRecordCount(level);

  return (
    <span className="flex-1 text-right text-muted-foreground tabular-nums">
      {count === maxSerializedRecordCountPerLowestLogLevel ? ">" : ""}
      {formatInt(count)}
    </span>
  );
}

function LogLevelLabel({
  level,
  includeCount,
}: {
  level: LowestLogLevel;
  includeCount: boolean;
}) {
  return (
    <span className="flex flex-1 items-center gap-1">
      <span>{serializedLogLevelLookup[level]}</span>
      {includeCount && (
        <React.Suspense>
          <LogLevelCount level={level} />
        </React.Suspense>
      )}
    </span>
  );
}

function LowestLogLevelSelect({
  lowestLogLevel,
  onLowestLogLevelChange,
}: {
  lowestLogLevel: LowestLogLevel;
  onLowestLogLevelChange: (lowestLogLevel: LowestLogLevel) => void;
}) {
  return (
    <Select
      value={lowestLogLevel}
      onValueChange={(value) => {
        if (value) {
          onLowestLogLevelChange(value);
          void popupService.setDebugTabLowestLogLevel(value);
        }
      }}
    >
      <SelectTrigger size="sm" className="w-21">
        <SelectValue>
          <LogLevelLabel level={lowestLogLevel} includeCount={false} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {logLevels.map((level) => (
          <SelectItem key={level} value={level}>
            <LogLevelLabel level={level} includeCount={true} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FilterInput({
  filter,
  onFilterChange,
}: {
  filter: string;
  onFilterChange: (filter: string) => void;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <FilterIcon
        className="
          pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2
          text-muted-foreground
        "
      />
      <input
        className="
          h-8 w-full rounded-md border border-input bg-transparent px-7 text-sm
          shadow-xs u-ring transition-[color,box-shadow] outline-none
          placeholder:text-muted-foreground
          dark:bg-input/30
          dark:hover:bg-input/50
        "
        onChange={(event) => {
          onFilterChange(event.target.value);
        }}
        placeholder="Фильтр списка"
        type="text"
        value={filter}
      />
      {filter.length > 0 && (
        <button
          aria-label="Clear log filter"
          type="button"
          className="
            absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center
            justify-center rounded-xs text-muted-foreground u-no-ring
            transition-colors
            hover:text-foreground
          "
          onClick={() => {
            onFilterChange("");
          }}
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

function ExportDropdownMenu({
  lowestLogLevel,
  normalizedFilter,
}: {
  lowestLogLevel: LowestLogLevel;
  normalizedFilter: string;
}) {
  const [clearing, setClearing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  function exportRecords(): void {
    setExporting(true);

    void loggingService
      .getRecords(lowestLogLevel)
      .then((records) => {
        const recordsToExport = filterLogRecords(records, normalizedFilter);

        if (recordsToExport.length === 0) {
          return;
        }

        downloadTextFile({
          fileName: getExportFileName(lowestLogLevel),
          text: stringifyLogRecordsAsJsonl(recordsToExport, lowestLogLevel),
        });
      })
      .finally(() => {
        setExporting(false);
      });
  }

  function clearCollectedRecords(): void {
    setClearing(true);

    void Promise.resolve(loggingService.clearCollectedRecords()).finally(() => {
      setClearing(false);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="iconSm" variant="outline" aria-label="Export logs">
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        <DropdownMenuItem
          disabled={exporting || clearing}
          onClick={exportRecords}
        >
          <DownloadIcon />
          Скачать показанные записи как JSONL
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={exporting || clearing}
          variant="destructive"
          onClick={clearCollectedRecords}
        >
          <Trash2Icon />
          Очистить журнал записей (все уровни)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LogRecordRowInner({
  record,
  onRecordClick,
}: {
  record: SerializedLogRecordWithId;
  onRecordClick: (record: SerializedLogRecordWithId) => void;
}) {
  return (
    <button
      className="
        h-9 rounded-sm px-1 font-mono text-xs
        hover:bg-muted
      "
      type="button"
      onClick={() => {
        onRecordClick(record);
      }}
    >
      <div className="flex h-4 items-center gap-1">
        <span className="text-muted-foreground tabular-nums">
          {formatLogTimestamp(record[1])}
        </span>

        <span
          className={cn(
            `
              w-8 shrink-0 rounded-full border py-0.5 text-center font-ubuntu
              text-[10px]/[1] font-semibold tracking-wide
            `,
            getLogLevelBadgeClassName(record[2]),
          )}
        >
          {record[2]}
        </span>

        <span className="whitespace-nowrap text-muted-foreground">
          {record[3].join(".")}
        </span>
      </div>

      <div className="flex flex-row gap-1">
        <div className="truncate text-[12px]/4">{record[4]}</div>
        {Object.keys(record[5]).length > 0 && (
          <span className="truncate text-muted-foreground">
            {JSON.stringify(record[5])}
          </span>
        )}
      </div>
    </button>
  );
}

const LogRecordRow = React.memo(LogRecordRowInner, (prevProps, nextProps) => {
  return (
    prevProps.record[0] === nextProps.record[0] &&
    prevProps.onRecordClick === nextProps.onRecordClick
  );
});

function useAutoScroll(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  dependencyToTrack: unknown,
  dependencyToForceScroll: unknown,
) {
  const autoScrollRef = React.useRef(true);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    function handleScroll() {
      if (!viewport) {
        return;
      }

      const atBottom =
        Math.abs(
          viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
        ) < 1;
      const atLeft = viewport.scrollLeft < 1;

      autoScrollRef.current = atBottom && atLeft;
    }

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [viewportRef]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !autoScrollRef.current) {
      return;
    }

    viewport.scrollTo({ top: viewport.scrollHeight, left: 0 });
  }, [viewportRef, dependencyToTrack]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    autoScrollRef.current = true;
    viewport.scrollTo({ top: viewport.scrollHeight, left: 0 });
  }, [viewportRef, dependencyToForceScroll]);
}

function LogRecordScrollArea({
  lowestLogLevel,
  visibleRecords,
  pending,
  onRecordClick,
}: {
  lowestLogLevel: LowestLogLevel;
  visibleRecords: readonly SerializedLogRecordWithId[];
  pending: boolean;
  onRecordClick: (record: SerializedLogRecordWithId) => void;
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  useAutoScroll(viewportRef, visibleRecords, lowestLogLevel);

  return (
    <div className="relative min-h-0 flex-1">
      <ScrollArea
        viewportRef={viewportRef}
        className={cn(
          `
            absolute! inset-0 overflow-hidden border-border/70
            transition-opacity duration-200
          `,
          pending && "opacity-55",
        )}
        scrollBar={
          <>
            <ScrollBar />
            <ScrollBar orientation="horizontal" />
          </>
        }
      >
        <div
          className="
            flex w-fit max-w-400 flex-col items-stretch overflow-hidden pb-10
          "
        >
          {visibleRecords.map((record) => (
            <LogRecordRow
              key={record[0]}
              record={record}
              onRecordClick={onRecordClick}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function DebugTabLogRecordArea({
  lowestLogLevel,
  normalizedFilter,
}: {
  lowestLogLevel: LowestLogLevel;
  normalizedFilter: string;
}) {
  const records = useLogRecords(lowestLogLevel);
  const visibleRecords = React.useMemo(
    () => filterLogRecords(records, normalizedFilter),
    [records, normalizedFilter],
  );
  const deferredVisibleRecords = React.useDeferredValue(visibleRecords);
  const pending = deferredVisibleRecords !== visibleRecords;

  const [copiedTimestamp, setCopiedTimestamp] = React.useState<number>();

  const showingText =
    deferredVisibleRecords.length === records.length
      ? `Записей уровня ≥ ${lowestLogLevel.toUpperCase()}: ${formatInt(deferredVisibleRecords.length)}${
          deferredVisibleRecords.length ===
          maxSerializedRecordCountPerLowestLogLevel
            ? " (список урезан)"
            : ""
        }`
      : `Показано записей: ${formatInt(deferredVisibleRecords.length)} из ${formatInt(records.length)}`;

  const statusText =
    copiedTimestamp === undefined
      ? showingText
      : `Запись от ${formatLogTimestamp(copiedTimestamp)} скопирована в буфер обмена`;

  const { animationClassName, animate } = useAnimate();

  const handleRecordClick = React.useCallback(
    (record: SerializedLogRecordWithId) => {
      void navigator.clipboard
        .writeText(stringifyRecordAsJsonlRow(record))
        .then(() => {
          animate("blink");
          setCopiedTimestamp(record[1]);
        });
    },
    [animate],
  );

  React.useEffect(() => {
    if (copiedTimestamp === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      setCopiedTimestamp(undefined);
    }, 2000);

    return () => {
      clearTimeout(timeout);
    };
  }, [copiedTimestamp]);

  return (
    <>
      <div
        className={cn(
          "truncate px-1 text-sm transition-opacity duration-200",
          copiedTimestamp === undefined && "text-muted-foreground",
          animationClassName,
          pending && "opacity-55",
        )}
      >
        {statusText}
      </div>
      <LogRecordScrollArea
        lowestLogLevel={lowestLogLevel}
        visibleRecords={deferredVisibleRecords}
        pending={pending}
        onRecordClick={handleRecordClick}
      />
    </>
  );
}

export function DebugTabBody() {
  const [filter, setFilter] = React.useState("");
  const lowestLogLevel = useDebugTabLowestLogLevel();

  const deferredFilter = React.useDeferredValue(filter);
  const normalizedFilter = deferredFilter.trim().toLowerCase();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5">
        <LowestLogLevelSelect
          lowestLogLevel={lowestLogLevel}
          onLowestLogLevelChange={(level) => {
            void popupService.setDebugTabLowestLogLevel(level);
          }}
        />
        <FilterInput filter={filter} onFilterChange={setFilter} />
        <ExportDropdownMenu
          lowestLogLevel={lowestLogLevel}
          normalizedFilter={normalizedFilter}
        />
      </div>

      <React.Suspense>
        <DebugTabLogRecordArea
          lowestLogLevel={lowestLogLevel}
          normalizedFilter={normalizedFilter}
        />
      </React.Suspense>
    </div>
  );
}

export function DebugTabWrapper({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [shownBefore, setShownBefore] = React.useState(false);

  if (!shownBefore && active) {
    setShownBefore(true);
  }

  const shown =
    active || shownBefore || baseExtensionVersionInfo.lifecycle !== "release";

  return (
    <>
      {shown && (
        <div
          className="
            flex flex-col items-stretch
            *:*:border-dotted
          "
        >
          {children}
        </div>
      )}
      <div
        className="
          flex-1
          focus:outline-none
        "
        role="button"
        tabIndex={-1}
        onDoubleClick={() => {
          void popupService.setActiveTab("debug");
        }}
      />
    </>
  );
}
