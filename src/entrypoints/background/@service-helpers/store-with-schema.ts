import type { JsonValue } from "type-fest";
import type { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/logging";
import { getAppConfig, storage, type StorageItemKey } from "#imports";

/**
 * Prevent this error with Firefox temp addons:
 * > The storage API will not work with a temporary addon ID. Please add an explicit addon ID to your manifest.
 *
 * @see https://mzl.la/3lPk1aE
 */
function patchNameIfNeeded(name: StorageItemKey): StorageItemKey {
  if (name.startsWith("sync:") && !getAppConfig().syncStorageAllowed) {
    return `local:${name.slice(5)}`;
  }
  return name;
}

export type StoreWithSchema<T extends z.ZodMiniType<JsonValue | undefined>> = {
  getValue: () => Promise<z.infer<T> | undefined>;
  setValue: (value: z.infer<T>) => Promise<void>;
  watch: (callback: (value: z.infer<T>) => void) => () => void;
};

export function defineStoreWithSchema<T extends z.ZodMiniType<JsonValue>>(
  name: StorageItemKey,
  schema: T,
): StoreWithSchema<T> {
  const patchedName = patchNameIfNeeded(name);
  const storageItem = storage.defineItem<JsonValue | undefined>(patchedName);

  const logger = getBackgroundLogger(["store", patchedName]);

  function parseValue(value: unknown): z.infer<T> {
    const result = schema.safeParse(value);

    if (!result.success) {
      logger.error("Invalid value {value}: {error}", {
        value,
        error: result.error.message,
      });

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- undefined is a subset of T
      return undefined as z.infer<T>;
    }

    return result.data;
  }

  return {
    getValue: () =>
      storageItem
        .getValue()
        .then((value) => (value === null ? undefined : parseValue(value))),

    setValue: (value) => storageItem.setValue(value),

    watch: (callback) =>
      storageItem.watch((value) => {
        callback(parseValue(value));
      }),
  };
}
