import type { StaticListItemOrigin } from "@/shared/@model/static-list-helpers";
import { cn } from "@/shared/tailwindcss-helpers";

import type { PageItem } from "../static-list-tab-body";

const originDefinitionLookup: Record<
  StaticListItemOrigin,
  { className: string; label: string }
> = {
  remote: {
    className: cn("bg-muted-foreground/20 text-muted-foreground"),
    label: "remote",
  },
  localOverride: {
    className: cn(`
      bg-blue-500/20 text-blue-700
      dark:text-blue-400
    `),
    label: "override",
  },
  local: {
    className: cn(`
      bg-green-500/20 text-green-700
      dark:text-green-400
    `),
    label: "local",
  },
};

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function ItemRow({
  indexNames,
  item: pageItem,
  onClick,
}: {
  indexNames: readonly string[];
  item: PageItem;
  onClick: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- item is always a record from Dexie
  const itemRecord = pageItem.item as Record<string, unknown>;

  return (
    <button
      className={cn(
        `
          grid w-full gap-x-2 border-b border-border/50 px-2 py-1 text-left
          text-xs transition-colors
          hover:bg-accent/50
        `,
        !pageItem.valid && "bg-destructive/10",
      )}
      onClick={onClick}
      style={{
        gridTemplateColumns: `4rem repeat(${indexNames.length}, 1fr)`,
      }}
      type="button"
    >
      <div>
        <span
          className={cn(
            "inline-block rounded-sm px-1 py-0.5 text-[10px] leading-tight",
            originDefinitionLookup[pageItem.origin].className,
          )}
        >
          {originDefinitionLookup[pageItem.origin].label}
        </span>
      </div>
      {indexNames.map((indexName) => (
        <div className="truncate" key={indexName}>
          {formatCellValue(itemRecord[indexName])}
        </div>
      ))}
    </button>
  );
}
