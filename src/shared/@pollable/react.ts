import type { Logger } from "@logtape/logtape";
import { delay, isEqual } from "es-toolkit";
import { nanoid } from "nanoid";
import * as React from "react";
import type { JsonValue } from "type-fest";

import { useEntrypointLogger } from "../@logging/react";
import { isBackgroundGone } from "../background-availability";
import type { PollResult, PollVersion } from "./core";

type UsePollableValue<
  Payload extends JsonValue | undefined = never,
  Result extends JsonValue | undefined = undefined,
> = [Payload] extends [never] ? () => Result : (payload: Payload) => Result;

type NewValueDebugLogPayload = Readonly<{
  message: string;
  properties: Record<string, unknown>;
}>;

type NewValueDebugLogFormatter<
  Value extends JsonValue | undefined = undefined,
> = (payload: {
  lastPollVersion: PollVersion;
  newPollResult: PollResult<Value>;
  setterCount: number;
  watcherId: string;
}) => NewValueDebugLogPayload | undefined;

const minStaleTimeout = 100;
const payloadKeyForUndefined = "-";

type PayloadKeyRecord<
  Payload extends JsonValue | undefined = never,
  Value extends JsonValue | undefined = undefined,
> = Readonly<{
  logger: Logger;
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
    formatNewValueDebugLog,
    hookNameForDebugging,
    staleTimeout = 30_000,
    throttleInterval = 50,
  }: {
    formatNewValueDebugLog?: NewValueDebugLogFormatter<Value> | undefined;
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

  async function watchPayload(payloadKey: string) {
    const watcherId = nanoid(8);

    let latestRecord = payloadKeyRecordMap.get(payloadKey);
    if (!latestRecord) {
      return;
    }

    const logger = latestRecord.logger;

    logger.debug("Started watching payload with watcherId {watcherId}", {
      watcherId,
    });

    latestRecord = { ...latestRecord, watcherId };
    payloadKeyRecordMap.set(payloadKey, latestRecord);

    try {
      for (;;) {
        if (isBackgroundGone()) {
          break;
        }

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

        const newValueDebugLogPayload = formatNewValueDebugLog
          ? formatNewValueDebugLog({
              lastPollVersion,
              newPollResult,
              setterCount: latestRecord.setters.length,
              watcherId,
            })
          : {
              message:
                "Received new value {newValue} (version {lastPollVersion} -> {newPollVersion}), notified {setterCount} component(s) in watcher {watcherId}",
              properties: {
                newValue: newPollResult.value,
              },
            };

        if (newValueDebugLogPayload !== undefined) {
          logger.debug(newValueDebugLogPayload.message, {
            lastPollVersion,
            newPollVersion: newPollResult.version,
            setterCount: latestRecord.setters.length,
            watcherId,
            ...newValueDebugLogPayload.properties,
          });
        }
      }
    } catch (error: unknown) {
      if (!isBackgroundGone(error)) {
        // eslint-disable-next-line no-restricted-syntax -- service calls are only expected to throw when background is gone; re-throwing unknown defects
        throw error;
      }
    }

    logger.debug("Stopped watching payload with watcherId {watcherId}", {
      watcherId,
    });
  }

  // eslint-disable-next-line @eslint-react/component-hook-factories -- this utility intentionally creates reusable hooks from shared pollers
  function usePollableValue(payload: Payload): Value {
    const entrypointLogger = useEntrypointLogger();

    const payloadKey =
      payload === undefined ? payloadKeyForUndefined : JSON.stringify(payload);

    let recordInRender = payloadKeyRecordMap.get(payloadKey);
    if (!recordInRender) {
      recordInRender = {
        logger: entrypointLogger.getChild([
          "pollable-value-hook",
          `${hookNameForDebugging}(${payloadKey === payloadKeyForUndefined ? "" : payloadKey})`,
        ]),
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

    // Reset value when payloadKey changes. useState's initial value is only
    // used on mount, so without this the component would show the stale value
    // from the previous payload key until the next poll cycle.
    // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    const [prevPayloadKey, setPrevPayloadKey] = React.useState(payloadKey);
    if (prevPayloadKey !== payloadKey) {
      setPrevPayloadKey(payloadKey);
      setValue(initialPollResult.value);
    }

    React.useEffect(() => {
      const initialRecordInEffect = payloadKeyRecordMap.get(payloadKey);
      if (!initialRecordInEffect) {
        return;
      }
      const logger = initialRecordInEffect.logger;

      const updatedRecordInEffect = initialRecordInEffect.setters.includes(
        setValue,
      )
        ? initialRecordInEffect
        : {
            ...initialRecordInEffect,
            setters: [...initialRecordInEffect.setters, setValue],
          };

      payloadKeyRecordMap.set(payloadKey, updatedRecordInEffect);
      logger.debug("Added setter to record in effect");

      if (!initialRecordInEffect.watcherId) {
        void watchPayload(payloadKey);
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
        logger.debug("Removed setter from record in cleanup");

        if (updatedRecordInCleanup.setters.length === 0) {
          // eslint-disable-next-line @eslint-react/web-api/no-leaked-timeout -- timeout is created during component cleanup
          setTimeout(
            () => {
              const initialRecordInTimeout =
                payloadKeyRecordMap.get(payloadKey);

              if (initialRecordInTimeout === updatedRecordInCleanup) {
                payloadKeyRecordMap.delete(payloadKey);
                logger.debug("Deleted record as stale");
              }
            },

            Math.max(staleTimeout, minStaleTimeout),
          );
        }
      };
    }, [payloadKey]);

    return value;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type casting because payload may be absent in resulting hook
  return usePollableValue as UsePollableValue<Payload, Value>;
}
