import { clamp, round } from "es-toolkit";
import * as React from "react";
import type { JsonValue } from "type-fest";

import { useStaticListMetadata } from "@/shared/@ui-helpers/data-hooks";

import { Toast } from "./toast";

function extractItemCountFromRawSummary(
  summary: JsonValue | undefined,
): number {
  if (summary && typeof summary === "object") {
    const itemCount = "itemCount" in summary ? summary["itemCount"] : undefined;
    if (itemCount && typeof itemCount === "number") {
      return itemCount;
    }
  }
  return 0;
}

export function ToastWithDataWarmup({ onClose }: { onClose: () => void }) {
  const tagsMetadata = useStaticListMetadata("tags");
  const accountsMetadata = useStaticListMetadata("accounts");

  const done = accountsMetadata.active && tagsMetadata.active;

  React.useEffect(() => {
    if (done) {
      onClose();
    }
  }, [done, onClose]);

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
    <Toast>
      <div className="flex flex-col gap-1">
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
            />
          </div>
        </div>
      </div>
    </Toast>
  );
}
