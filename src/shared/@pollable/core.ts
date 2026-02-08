import { delay, isEqual } from "es-toolkit";
import type { JsonValue, Tagged } from "type-fest";

/**
 * Using Tagged type to ensure we don't use values other than internally generated ones
 */
export type PollVersion = Tagged<number, "PollVersion">;

export type PollResult<Value extends JsonValue | undefined> = Readonly<{
  value: Value;
  version: PollVersion;
}>;

/**
 * Wraps a value and exposes a pollable interface. Each call to
 * .setValue(newValue) updates the value and advances its internal version
 * if the new value is structurally different from the current value.
 *
 * Using .poll(lastPollVersion) immediately returns the current value if
 * lastPollVersion is undefined or less than the current version. Otherwise,
 * .poll returns a promise that resolves either when a new version is set or
 * after a 60-second timeout (whichever comes first). This timeout ensures
 * subscribers regularly re-issue poll requests and helps detect stale data.
 *
 * Pollable is typically used within services to monitor updates from
 * external dependencies, and is also useful for implementing React hooks
 * that consume real-time data from the background worker.
 */
export class Pollable<Value extends JsonValue | undefined> {
  private current: PollResult<Value>;
  private future: PromiseWithResolvers<PollResult<Value>>;
  private maxPollDurationInMs: number = 60 * 1000;

  constructor(value: Value) {
    this.current = {
      value,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- internal conversion (implementation detail)
      version: Date.now() as PollVersion,
    };
    this.future = Promise.withResolvers<PollResult<Value>>();
  }

  public getValue(): Value {
    return this.current.value;
  }

  public setValue(value: Value): void {
    if (isEqual(value, this.current.value)) {
      return;
    }

    const newResult = {
      value,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- internal conversion (implementation detail)
      version: Math.max(this.current.version + 1, Date.now()) as PollVersion,
    };

    this.current = newResult;
    this.future.resolve(newResult);
    this.future = Promise.withResolvers<PollResult<Value>>();
  }

  public async poll(
    lastPollVersion: PollVersion | undefined,
  ): Promise<PollResult<Value>> {
    if (
      lastPollVersion === undefined ||
      lastPollVersion < this.current.version
    ) {
      return this.current;
    }

    return await Promise.race([
      this.future.promise,
      delay(this.maxPollDurationInMs).then(() => this.current),
    ]);
  }
}
