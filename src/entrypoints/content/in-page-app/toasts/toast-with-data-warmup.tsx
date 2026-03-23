import { clamp, round } from "es-toolkit";
import * as React from "react";

import { useStaticListMetadata } from "@/shared/@ui-helpers/data-hooks";

import { Toast } from "./toast";

// Wait for one observed interval before deciding whether the toast is needed.
const startForecastingAfterMs = 1000;

// Show the toast if the linearly-extrapolated remaining time exceeds this.
// Example: if we first saw 40 % and after 1 s we see 50 %, we estimate the
// remaining time from that observed speed instead of assuming we started at 0 %.
const showIfEstimatedRemainingMoreThanMs = 2000;

const forecastCheckIntervalMs = 1000;

export function ToastWithDataWarmup({ onDone }: { onDone: () => void }) {
  const accountsMetadata = useStaticListMetadata("accounts");
  const insertionsMetadata = useStaticListMetadata("insertions");
  const tagsMetadata = useStaticListMetadata("tags");

  const done =
    accountsMetadata.remoteActive &&
    insertionsMetadata.remoteActive &&
    tagsMetadata.remoteActive;

  const stagingExpectedItemCount =
    (accountsMetadata.remoteStaging?.upstreamInfo.itemCount ?? 0) +
    (insertionsMetadata.remoteStaging?.upstreamInfo.itemCount ?? 0) +
    (tagsMetadata.remoteStaging?.upstreamInfo.itemCount ?? 0);

  const stagingItemCount =
    (accountsMetadata.remoteStaging?.summary.itemCount ?? 0) +
    (insertionsMetadata.remoteStaging?.summary.itemCount ?? 0) +
    (tagsMetadata.remoteStaging?.summary.itemCount ?? 0);

  const progressInPercentage = stagingExpectedItemCount
    ? clamp(
        round((stagingItemCount / stagingExpectedItemCount) * 100, 1),
        0,
        99.9,
      )
    : 95;

  // Refs let the interval callback read the latest values without being
  // re-registered on every render.
  const initialProgressMeasuredAtRef = React.useRef<number | undefined>(
    undefined,
  );
  const initialProgressRef = React.useRef<number | undefined>(undefined);
  const progressRef = React.useRef(progressInPercentage);

  React.useEffect(() => {
    if (initialProgressMeasuredAtRef.current === undefined) {
      initialProgressMeasuredAtRef.current = Date.now();
      initialProgressRef.current = progressInPercentage;
    }

    progressRef.current = progressInPercentage;
  }, [progressInPercentage]);

  const [shouldShow, setShouldShow] = React.useState(false);

  React.useEffect(() => {
    function check() {
      const initialProgressMeasuredAt = initialProgressMeasuredAtRef.current;
      const initialProgress = initialProgressRef.current;

      if (
        initialProgressMeasuredAt === undefined ||
        initialProgress === undefined
      ) {
        return;
      }

      const now = Date.now();
      const elapsed = now - initialProgressMeasuredAt;

      if (elapsed < startForecastingAfterMs) {
        return;
      }

      const currentProgress = progressRef.current;
      const observedProgressDelta = currentProgress - initialProgress;

      if (observedProgressDelta <= 0) {
        setShouldShow(true);
        return;
      }

      const estimatedRemaining =
        (elapsed * (100 - currentProgress)) / observedProgressDelta;

      if (estimatedRemaining > showIfEstimatedRemainingMoreThanMs) {
        setShouldShow(true);
      }
    }

    const interval = setInterval(check, forecastCheckIntervalMs);
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
