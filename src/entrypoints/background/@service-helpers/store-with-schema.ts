import type { JsonValue } from "type-fest";
import type { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/@logging/core";
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

type DefineStoreWithSchemaOptions<T extends z.ZodMiniType<JsonValue>> = {
  migrateDataFromV1?: () => Promise<z.infer<T> | undefined>;
};

export function defineStoreWithSchema<T extends z.ZodMiniType<JsonValue>>(
  name: StorageItemKey,
  schema: T,
  options?: DefineStoreWithSchemaOptions<T>,
): StoreWithSchema<T> {
  const patchedName = patchNameIfNeeded(name);
  const storageItem = storage.defineItem<JsonValue | undefined>(patchedName);

  const logger = getBackgroundLogger(["store", patchedName]);
  let migrationAttemptPromise: Promise<z.infer<T> | undefined> | undefined;

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

  async function migrateValueFromV1(): Promise<z.infer<T> | undefined> {
    const migrateDataFromV1 = options?.migrateDataFromV1;
    if (!migrateDataFromV1) {
      return;
    }

    migrationAttemptPromise ??= (async () => {
      try {
        const migratedValue = await migrateDataFromV1();
        if (migratedValue === undefined) {
          return;
        }

        const migratedValueResult = schema.safeParse(migratedValue);
        if (!migratedValueResult.success) {
          logger.error("Invalid migrated value {value}: {error}", {
            value: migratedValue,
            error: migratedValueResult.error.message,
          });
          return;
        }

        const parsedMigratedValue = migratedValueResult.data;
        await storageItem.setValue(parsedMigratedValue);
        return parsedMigratedValue;
      } catch (error) {
        logger.error("Failed to migrate value from v1: {error}", {
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    })();

    return migrationAttemptPromise;
  }

  return {
    getValue: async () => {
      const rawValue = await storageItem.getValue();
      if (rawValue !== null) {
        return parseValue(rawValue);
      }

      return await migrateValueFromV1();
    },

    setValue: (value) => storageItem.setValue(value),

    watch: (callback) =>
      storageItem.watch((value) => {
        callback(parseValue(value));
      }),
  };
}
