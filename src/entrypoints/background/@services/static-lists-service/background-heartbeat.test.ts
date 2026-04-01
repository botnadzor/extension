import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeState = vi.hoisted(() => ({
  getPlatformInfo: vi.fn().mockResolvedValue({ os: "mac" }),
}));

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getPlatformInfo: runtimeState.getPlatformInfo,
    },
  },
}));

const { backgroundHeartbeatIntervalInMs, withBackgroundHeartbeat } =
  await import("./background-heartbeat");

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}

describe("withBackgroundHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    runtimeState.getPlatformInfo.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pings the runtime while long-running work is in flight", async () => {
    const deferred = createDeferred<string>();
    const heartbeat = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const resultPromise = withBackgroundHeartbeat(() => deferred.promise, {
      heartbeat,
      intervalInMs: backgroundHeartbeatIntervalInMs,
    });

    await vi.advanceTimersByTimeAsync(backgroundHeartbeatIntervalInMs);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(backgroundHeartbeatIntervalInMs);
    expect(heartbeat).toHaveBeenCalledTimes(2);

    deferred.resolve("done");
    await expect(resultPromise).resolves.toBe("done");
  });

  it("cleans up its timer once the task settles", async () => {
    const deferred = createDeferred<string>();
    const heartbeat = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const resultPromise = withBackgroundHeartbeat(() => deferred.promise, {
      heartbeat,
      intervalInMs: backgroundHeartbeatIntervalInMs,
    });

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(backgroundHeartbeatIntervalInMs);
    deferred.resolve("done");
    await expect(resultPromise).resolves.toBe("done");

    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(backgroundHeartbeatIntervalInMs);
    expect(heartbeat).toHaveBeenCalledTimes(1);
  });

  it("does not fail the wrapped task when the heartbeat itself errors", async () => {
    const heartbeat = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("ignored"));

    const resultPromise = withBackgroundHeartbeat(
      async () => {
        await vi.advanceTimersByTimeAsync(backgroundHeartbeatIntervalInMs);
        return "done";
      },
      { heartbeat, intervalInMs: backgroundHeartbeatIntervalInMs },
    );

    await expect(resultPromise).resolves.toBe("done");
    expect(heartbeat).toHaveBeenCalledTimes(1);
  });
});
