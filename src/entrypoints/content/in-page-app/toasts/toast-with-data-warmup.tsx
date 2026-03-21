import { clamp, round } from "es-toolkit";
import * as React from "react";
import type { JsonValue } from "type-fest";

import { useStaticListMetadata } from "@/shared/@ui-helpers/data-hooks";

import { Toast } from "./toast";

// Minimum time before we even consider showing the toast.
const showToastAfterMs = 2000;

// Show the toast if the linearly-extrapolated remaining time exceeds this.
// Example: at 2 s in with 50 % done → ~2 s estimated remaining → show.
//          at 2 s in with 98 % done → ~40 ms estimated remaining  → skip.
const showIfEstimatedRemainingMoreThanMs = 2000;

// Also show if progress hasn't moved for this long after the initial delay.
// Handles the case where loading sprints to a high percentage and then stalls.
const showIfProgressStuckForMs = 2000;

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

export function ToastWithDataWarmup({ onDone }: { onDone: () => void }) {
  const accountsMetadata = useStaticListMetadata("accounts");
  const insertionsMetadata = useStaticListMetadata("insertions");
  const tagsMetadata = useStaticListMetadata("tags");

  const done =
    accountsMetadata.remoteActive &&
    insertionsMetadata.remoteActive &&
    tagsMetadata.remoteActive;

  const nextExpectedItemCount =
    (accountsMetadata.remoteNext?.upstreamInfo.itemCount ?? 0) +
    (insertionsMetadata.remoteNext?.upstreamInfo.itemCount ?? 0) +
    (tagsMetadata.remoteNext?.upstreamInfo.itemCount ?? 0);

  const nextItemCount =
    extractItemCountFromRawSummary(accountsMetadata.remoteNext?.summary) +
    extractItemCountFromRawSummary(insertionsMetadata.remoteNext?.summary) +
    extractItemCountFromRawSummary(tagsMetadata.remoteNext?.summary);

  const progressInPercentage = nextExpectedItemCount
    ? clamp(round((nextItemCount / nextExpectedItemCount) * 100, 1), 0, 99.9)
    : 95;

  // Refs let the interval callback read the latest values without being
  // re-registered on every render. Initialized and synced via effect -
  // avoids calling Date.now() during render.
  const mountTimeRef = React.useRef<number | undefined>(undefined);
  const progressRef = React.useRef(progressInPercentage);
  const lastProgressChangeAtRef = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    const now = Date.now();
    if (mountTimeRef.current === undefined) {
      mountTimeRef.current = now;
      lastProgressChangeAtRef.current = now;
    } else if (progressInPercentage !== progressRef.current) {
      lastProgressChangeAtRef.current = now;
    }
    progressRef.current = progressInPercentage;
  });

  const [shouldShow, setShouldShow] = React.useState(false);

  React.useEffect(() => {
    function check() {
      const mountTime = mountTimeRef.current;
      const lastProgressChangeAt = lastProgressChangeAtRef.current;
      if (mountTime === undefined || lastProgressChangeAt === undefined) {
        return;
      }

      const now = Date.now();
      const elapsed = now - mountTime;
      if (elapsed < showToastAfterMs) {
        return;
      }

      const progress = progressRef.current;
      const estimatedRemaining =
        progress > 0 ? (elapsed * (100 - progress)) / progress : Infinity;
      const timeSinceProgressChange = now - lastProgressChangeAt;

      if (
        estimatedRemaining > showIfEstimatedRemainingMoreThanMs ||
        timeSinceProgressChange > showIfProgressStuckForMs
      ) {
        setShouldShow(true);
      }
    }

    const interval = setInterval(check, 500);
    return () => {
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (done) {
      onDone();
    }
  }, [done, onDone]);

  if (!shouldShow) {
    return;
  }

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
