import { browser } from "#imports";

export const backgroundHeartbeatIntervalInMs = 25 * 1000;

async function pingBackgroundHeartbeat(): Promise<void> {
  await browser.runtime.getPlatformInfo();
}

/**
 * Chrome's MV3 migration guide documents this waitUntil-style pattern for
 * exceptional long-running tasks that may otherwise outlive the service
 * worker's idle timeout.
 *
 * We intentionally use it only as a bounded reliability guard around one
 * resumable static-list update task. This is not a general-purpose keepalive:
 * the timer starts immediately before the work, stops in `finally`, and does not
 * try to keep the background alive between tasks. In practice, the duration of
 * the update is about 1-2 minutes.
 *
 * Reviewer context:
 * - if the background is terminated during a large staging update, the
 *   extension can resume from persisted progress, so correctness does not
 *   depend on this helper
 * - the helper exists only to reduce waste from repeatedly re-downloading and
 *   re-verifying very large lists such as `accounts.jsonl`
 * - the heartbeat uses a harmless extension API call (`runtime.getPlatformInfo`)
 *   instead of hidden pages, persistent ports, or other longer-lived mechanisms
 */
export async function withBackgroundHeartbeat<Result>(
  task: () => Promise<Result>,
  options?: {
    heartbeat?: () => Promise<unknown>;
    intervalInMs?: number;
  },
): Promise<Result> {
  const heartbeat = options?.heartbeat ?? pingBackgroundHeartbeat;
  const intervalInMs = options?.intervalInMs ?? backgroundHeartbeatIntervalInMs;

  let inFlightHeartbeat: Promise<void> | undefined;
  const keepAliveTimer = setInterval(() => {
    if (inFlightHeartbeat) {
      return;
    }

    inFlightHeartbeat = Promise.resolve(heartbeat())
      .catch(() => {
        // Best-effort only: the download task itself remains authoritative.
      })
      .then(() => {
        inFlightHeartbeat = undefined;
      });
  }, intervalInMs);

  try {
    return await task();
  } finally {
    clearInterval(keepAliveTimer);
    await inFlightHeartbeat;
  }
}
