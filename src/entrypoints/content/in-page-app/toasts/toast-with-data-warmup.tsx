import { clamp, round } from "es-toolkit";
import * as React from "react";

import type { ConfigValue } from "@/lib/primitive-values";
import type { StaticListMetadata } from "@/lib/static-list-metadata";
import { detectVkBaseUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

import { Toast } from "./toast";

// cspell:ignore rt_russian vesti
const exampleVkPages = ["ria", "rt_russian", "vesti", "mash"];

function extractItemCountFromRawSummary(summary: ConfigValue): number {
  if (summary && typeof summary === "object") {
    const itemCount = "itemCount" in summary ? summary["itemCount"] : undefined;
    if (itemCount && typeof itemCount === "number") {
      return itemCount;
    }
  }
  return 0;
}

export function ToastWithDataWarmup({
  accountsMetadata,
  tagsMetadata,
  onClose,
}: {
  accountsMetadata: StaticListMetadata;
  tagsMetadata: StaticListMetadata;
  onClose: () => void;
}) {
  const vkBaseUrl = detectVkBaseUrl(window.location.href);

  const done = accountsMetadata.active && tagsMetadata.active;

  const nextExpectedItemCount =
    (accountsMetadata.next?.upstreamInfo.itemCount ?? 0) +
    (tagsMetadata.next?.upstreamInfo.itemCount ?? 0);

  const nextItemCount =
    extractItemCountFromRawSummary(accountsMetadata.next?.summary) +
    extractItemCountFromRawSummary(tagsMetadata.next?.summary);

  const progressInPercentage = nextExpectedItemCount
    ? clamp(round((nextItemCount / nextExpectedItemCount) * 100, 1), 0, 99.9)
    : 95;

  return (
    <Toast
      extensionName="short"
      onClose={done ? onClose : undefined}
      // Rendering all children variants to ensure toast height is stable (we don't want it to jump when data is ready)
      childrenWrapperClassName="grid"
    >
      <div className={cn("col-1 row-1", !done && "invisible select-none")}>
        Данные для подсветки ботов готовы.{" "}
        <a href={window.location.href}>Обновите страницу</a> или&nbsp;попробуйте
        открыть VK-паблик, где часто бывают боты:{" "}
        {exampleVkPages.map((page, index) => (
          <React.Fragment key={page}>
            {index > 0 && ", "}
            <a key={page} href={`${vkBaseUrl}/${page}`}>
              {page}
            </a>
          </React.Fragment>
        ))}
        .
      </div>

      <div
        className={cn(
          "col-1 row-1 flex flex-col gap-1",
          done && "invisible select-none",
        )}
      >
        <div className="flex-none">
          Список аккаунтов обрабатывается:{" "}
          <span className="tabular-nums">
            {Math.floor(progressInPercentage)}%
          </span>
        </div>
        <div className="flex flex-1 items-center">
          <div
            className="
              relative h-4 w-full overflow-hidden rounded-xs
              bg-muted-foreground/20
            "
          >
            <div
              className="absolute h-full bg-muted-foreground"
              style={{ width: `${progressInPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    </Toast>
  );
}
