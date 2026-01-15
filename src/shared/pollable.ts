import { isEqual } from "es-toolkit";
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
 * Wraps a value and makes it pollable. Each call to .set(value) is internally
 * versioned. Calling .poll(lastPollVersion) immediately returns the current value
 * the provided version is smaller than the current version. Otherwise the method
 * returns a promise. It resolves to the new value when a new version is produced.
 *
 * Pollable structure is used inside services to watch for updates in outer services.
 * It also helps implement React hooks with real-time data from the background worker.
 */
export class Pollable<Value extends JsonValue | undefined> {
  private current: PollResult<Value>;
  private future: PromiseWithResolvers<PollResult<Value>>;

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
    return lastPollVersion === undefined ||
      lastPollVersion < this.current.version
      ? this.current
      : this.future.promise;
  }
}
