import type { Logger } from "@logtape/logtape";
import { delay, isEqual } from "es-toolkit";
import { nanoid } from "nanoid";
import * as React from "react";
import type { JsonValue } from "type-fest";

import type { ConfigValue } from "../@model/primitives";
import { getContentLogger, getPopupLogger } from "../logging";
import type { PollResult, PollVersion } from "./core";

type UsePollableValue<
  Payload extends ConfigValue = never,
  Result extends ConfigValue = undefined,
> = [Payload] extends [never] ? () => Result : (payload: Payload) => Result;

const minStaleTimeout = 100;
const payloadKeyForUndefined = "-";

type PayloadKeyRecord<
  Payload extends JsonValue | undefined = never,
  Value extends JsonValue | undefined = undefined,
> = Readonly<{
  payload: Payload;
  pollResult: PollResult<Value> | Promise<PollResult<Value>>;
  setters: Array<React.Dispatch<React.SetStateAction<Value>>>;
  watcherId?: string;
}>;

/**
 * Creates a hook that returns Pollable value
 *
 * Changes to value are obtained using polling which is based on the value version
 * in the last poll. Relevant React components are re-rendered when a new unique
 * value has been polled.
 *
 * The resulting hook may suspend on the initial render. Make sure you wrap the
 * component subtree with `<React.Suspense>` and show a loader, if needed.
 */
export function createPollableValueHook<
  Payload extends JsonValue | undefined = never,
  Value extends JsonValue | undefined = undefined,
>(
  poll: (
    lastPollVersion: PollVersion | undefined,
    payload: Payload,
  ) => Promise<PollResult<Value>>,
  {
    hookNameForDebugging,
    staleTimeout = 30_000,
    throttleInterval = 50,
  }: {
    hookNameForDebugging: string;
    /**
     * When all components that poll the same value are unmounted, the value becomes
     * stale after this number of milliseconds. Set to `undefined` to disable staleness.
     * In this case the last known value will become the initial value even if a new
     * component is mounted much later after the last component was unmounted.
     *
     * Defaults to 30 000ms (30 seconds).
     * Small numeric values are converted to 100ms for Suspense to work properly.
     */
    staleTimeout?: number | undefined;
    /**
     * If set, updates to the value will be throttled to the given interval.
     *
     * Defaults to 50ms to avoid excessive re-renders.
     */
    throttleInterval?: number | undefined;
  },
): UsePollableValue<Payload, Value> {
  const payloadKeyRecordMap = new Map<
    string,
    PayloadKeyRecord<Payload, Value>
  >();

  const parentLogger =
    import.meta.env.ENTRYPOINT === "content"
      ? getContentLogger()
      : getPopupLogger();

  async function watchPayload(payloadKey: string, payloadLogger: Logger) {
    const watcherId = nanoid(8);
    payloadLogger.debug("Started watching payload with watcherId {watcherId}", {
      watcherId,
    });

    let latestRecord = payloadKeyRecordMap.get(payloadKey);
    if (!latestRecord) {
      return;
    }

    latestRecord = { ...latestRecord, watcherId };
    payloadKeyRecordMap.set(payloadKey, latestRecord);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- breaking inside the loop
    while (true) {
      if (throttleInterval && throttleInterval > 0) {
        await delay(throttleInterval);
      }

      const { version: lastPollVersion } = await latestRecord.pollResult;
      const newPollResult = await poll(lastPollVersion, latestRecord.payload);

      latestRecord = payloadKeyRecordMap.get(payloadKey);
      if (latestRecord?.watcherId !== watcherId) {
        break;
      }

      latestRecord = { ...latestRecord, pollResult: newPollResult };
      payloadKeyRecordMap.set(payloadKey, latestRecord);

      for (const setter of latestRecord.setters) {
        setter((oldValue) =>
          isEqual(oldValue, newPollResult.value)
            ? oldValue
            : newPollResult.value,
        );
      }

      payloadLogger.debug(
        "Received new value {newValue} (version {lastPollVersion} -> {newPollVersion}), notified {setterCount} component(s) in watcher {watcherId}",
        {
          lastPollVersion,
          newPollVersion: newPollResult.version,
          newValue: newPollResult.value,
          setterCount: latestRecord.setters.length,
          watcherId,
        },
      );
    }

    payloadLogger.debug("Stopped watching payload with watcherId {watcherId}", {
      watcherId,
    });
  }

  function usePollableValue(payload: Payload): Value {
    const payloadKey =
      payload === undefined ? payloadKeyForUndefined : JSON.stringify(payload);

    let recordInRender = payloadKeyRecordMap.get(payloadKey);
    if (!recordInRender) {
      recordInRender = {
        payload,
        pollResult: poll(undefined, payload),
        setters: [],
      };
      payloadKeyRecordMap.set(payloadKey, recordInRender);
    }

    const initialPollResult =
      recordInRender.pollResult instanceof Promise
        ? React.use(recordInRender.pollResult)
        : recordInRender.pollResult;

    const [value, setValue] = React.useState<Value>(initialPollResult.value);

    const payloadLogger = React.useMemo(
      () =>
        parentLogger.getChild([
          "pollable-value-hook",
          `${hookNameForDebugging}(${payloadKey === payloadKeyForUndefined ? "" : payloadKey})`,
        ]),
      [payloadKey],
    );

    React.useEffect(() => {
      const initialRecordInEffect = payloadKeyRecordMap.get(payloadKey);
      if (!initialRecordInEffect) {
        return;
      }

      const updatedRecordInEffect = initialRecordInEffect.setters.includes(
        setValue,
      )
        ? initialRecordInEffect
        : {
            ...initialRecordInEffect,
            setters: [...initialRecordInEffect.setters, setValue],
          };

      payloadKeyRecordMap.set(payloadKey, updatedRecordInEffect);
      payloadLogger.debug("Added setter to record in effect");

      if (!initialRecordInEffect.watcherId) {
        void watchPayload(payloadKey, payloadLogger);
      }

      return () => {
        const initialRecordInCleanup = payloadKeyRecordMap.get(payloadKey);
        if (!initialRecordInCleanup) {
          return;
        }

        const updatedRecordInCleanup = {
          ...initialRecordInCleanup,
          setters: initialRecordInCleanup.setters.filter(
            (setter) => setter !== setValue,
          ),
        };

        payloadKeyRecordMap.set(payloadKey, updatedRecordInCleanup);
        payloadLogger.debug("Removed setter from record in cleanup");

        if (updatedRecordInCleanup.setters.length === 0) {
          // eslint-disable-next-line @eslint-react/web-api/no-leaked-timeout -- timeout is created during component cleanup
          setTimeout(
            () => {
              const initialRecordInTimeout =
                payloadKeyRecordMap.get(payloadKey);

              if (initialRecordInTimeout === updatedRecordInCleanup) {
                payloadKeyRecordMap.delete(payloadKey);
                payloadLogger.debug("Deleted record as stale");
              }
            },
            Math.max(staleTimeout, minStaleTimeout),
          );
        }
      };
    }, [payloadKey, payloadLogger]);

    return value;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type casting because payload may be absent in resulting hook
  return usePollableValue as UsePollableValue<Payload, Value>;
}
