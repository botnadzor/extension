import { isEqual } from "es-toolkit";
import { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/@logging/categories";
import type { AuthInput } from "@/shared/@model/auth";
import {
  defaultUserConfig,
  type UserConfig,
} from "@/shared/@model/user-config";
import { hexColorSchema, tagIdSchema } from "@/shared/@primitives/misc";
import {
  type IsoDateTime,
  isoDateTimeSchema,
} from "@/shared/@primitives/temporal";
import { omitUndefined } from "@/shared/omit-undefined";
import { browser } from "#imports";

const logger = getBackgroundLogger(["legacy-v1-migration"]);

export const legacyLocalStorageKeys = [
  "token-state",
  "user_settings",
  "config",
  "popupTab",
  "registration_dates",
  "reply_collector",
  "bot_types_counter",
  "bot_marks_counter",
  "bot_list_fetch_date",
  "is_data_loading",
  "notification_log",
  "last_closed_notification",
  "closed_notification_data",
  "lastConfigLoad",
  "localBotListVersion",
  "lastTokenRecheck",
] as const;

export const legacyAlarmNames = ["10 minutes", "weekly"] as const;
// cspell:ignore gosvon
export const legacyIndexedDbName = "gosvon";

const legacyTokenStateSchema = z.readonly(
  z.object({
    userToken: z.string(),
  }),
);

const legacyConfigSchema = z.readonly(
  z.object({
    types: z.array(
      z.object({
        id: z.number().check(z.int(), z.nonnegative()),
      }),
    ),
  }),
);

type LegacyTokenState = z.infer<typeof legacyTokenStateSchema>;
type LegacyUserSettings = Readonly<{
  disabledTypesIds?: number[];
  customTypesColors?: Record<string, string>;
  isRepliesCollectingEnabled?: boolean;
  isFansTableView?: boolean;
}>;
type LegacyConfig = z.infer<typeof legacyConfigSchema>;

type GlobalNotificationsMigrationState = Readonly<{
  announcementReadAtByCreatedAt: Record<string, IsoDateTime>;
  welcomeMessageShownAt: IsoDateTime;
  welcomeMessageReadAt: IsoDateTime;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLegacyValue<T extends z.ZodMiniType>(
  schema: T,
  value: unknown,
  label: string,
): z.infer<T> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    logger.warn("Skipping invalid legacy value {label}: {error}", {
      label,
      error: result.error.message,
    });
    return undefined;
  }

  return result.data;
}

function parseLegacyNonnegativeInt(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value);
  }

  return undefined;
}

export function parseLegacyUserSettings(
  value: unknown,
): LegacyUserSettings | undefined {
  if (!isRecord(value)) {
    if (value !== undefined) {
      logger.warn(
        "Skipping invalid legacy value user_settings: expected object",
      );
    }
    return undefined;
  }

  const raw = value;

  const disabledTypesIds = Array.isArray(raw["disabledTypesIds"])
    ? raw["disabledTypesIds"].flatMap((item) => {
        const parsed = parseLegacyNonnegativeInt(item);
        return parsed === undefined ? [] : [parsed];
      })
    : undefined;

  const customTypesColors = isRecord(raw["customTypesColors"])
    ? (() => {
        const result: Record<string, string> = {};

        for (const [typeId, color] of Object.entries(
          raw["customTypesColors"],
        )) {
          if (typeof color === "string") {
            result[typeId] = color;
          }
        }

        return result;
      })()
    : undefined;

  const isRepliesCollectingEnabled =
    typeof raw["isRepliesCollectingEnabled"] === "boolean"
      ? raw["isRepliesCollectingEnabled"]
      : undefined;

  const isFansTableView =
    typeof raw["isFansTableView"] === "boolean"
      ? raw["isFansTableView"]
      : undefined;

  return omitUndefined({
    disabledTypesIds,
    customTypesColors,
    isRepliesCollectingEnabled,
    isFansTableView,
  });
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function getLocalStorageValues(
  keys: string | readonly string[],
): Promise<Record<string, unknown>> {
  return await browser.storage.local.get(
    typeof keys === "string" ? keys : [...keys],
  );
}

async function removeLocalStorageValues(
  keys: readonly string[],
): Promise<void> {
  await browser.storage.local.remove([...keys]);
}

async function clearAlarm(alarmName: string): Promise<boolean> {
  return await browser.alarms.clear(alarmName);
}

async function getAlarm(alarmName: string): Promise<unknown> {
  return await browser.alarms.get(alarmName);
}

function createAllowedLegacyTypeIdSet(
  legacyConfig: LegacyConfig | undefined,
): ReadonlySet<number> | undefined {
  if (!legacyConfig || legacyConfig.types.length === 0) {
    return undefined;
  }

  return new Set(legacyConfig.types.map((type) => type.id));
}

export function migrateAuthInputFromLegacyTokenState({
  legacyTokenState,
  migratedAt,
}: {
  legacyTokenState: LegacyTokenState | undefined;
  migratedAt: IsoDateTime;
}): AuthInput | undefined {
  if (!legacyTokenState) {
    return undefined;
  }

  const accessCode = legacyTokenState.userToken.trim().slice(0, 1000);
  if (accessCode.length === 0) {
    return undefined;
  }

  return {
    accessCode,
    accessCodeEnteredAt: migratedAt,
  };
}

export function migrateUserConfigFromLegacyState({
  legacyConfig,
  legacyUserSettings,
}: {
  legacyConfig: LegacyConfig | undefined;
  legacyUserSettings: LegacyUserSettings | undefined;
}): UserConfig | undefined {
  if (!legacyUserSettings) {
    return undefined;
  }

  const allowedLegacyTypeIds = createAllowedLegacyTypeIdSet(legacyConfig);
  const tagOverrideLookup = { ...defaultUserConfig.tagOverrideLookup };

  function shouldUseLegacyTypeId(typeId: number): boolean {
    return allowedLegacyTypeIds?.has(typeId) ?? true;
  }

  function upsertTagOverride(
    rawTypeId: number,
    override: {
      colorForHighlight?: z.infer<typeof hexColorSchema>;
      hidden?: true;
    },
  ): void {
    if (!shouldUseLegacyTypeId(rawTypeId)) {
      return;
    }

    const tagIdResult = tagIdSchema.safeParse(String(rawTypeId));
    if (!tagIdResult.success) {
      return;
    }

    const tagId = tagIdResult.data;
    const currentOverride = tagOverrideLookup[tagId] ?? {};
    tagOverrideLookup[tagId] = omitUndefined({
      hidden: currentOverride.hidden ?? override.hidden,
      colorForHighlight:
        currentOverride.colorForHighlight ?? override.colorForHighlight,
    });
  }

  for (const rawTypeId of legacyUserSettings.disabledTypesIds ?? []) {
    upsertTagOverride(rawTypeId, { hidden: true });
  }

  for (const [rawTypeId, rawColor] of Object.entries(
    legacyUserSettings.customTypesColors ?? {},
  )) {
    const typeId = Number(rawTypeId);
    if (!Number.isInteger(typeId) || typeId < 0) {
      continue;
    }

    const colorResult = hexColorSchema.safeParse(rawColor.trim().toLowerCase());
    if (!colorResult.success) {
      continue;
    }

    upsertTagOverride(typeId, { colorForHighlight: colorResult.data });
  }

  const fansDisplay: UserConfig["fansDisplay"] =
    legacyUserSettings.isFansTableView ? "table" : "default";
  const collectingComments = legacyUserSettings.isRepliesCollectingEnabled
    ? true
    : undefined;

  const migratedUserConfig: UserConfig = omitUndefined({
    tagOverrideLookup,
    fansDisplay,
    collectingComments,
  });

  return isEqual(migratedUserConfig, defaultUserConfig)
    ? undefined
    : migratedUserConfig;
}

export function hasLegacyV1FootprintInLocalStorage(
  rawLegacyState: Partial<
    Record<(typeof legacyLocalStorageKeys)[number], unknown>
  >,
): boolean {
  return legacyLocalStorageKeys.some((key) =>
    Object.hasOwn(rawLegacyState, key),
  );
}

export async function migrateAuthInputFromV1(): Promise<AuthInput | undefined> {
  let rawLegacyState: Record<string, unknown>;
  try {
    rawLegacyState = await getLocalStorageValues("token-state");
  } catch (error) {
    logger.warn("Failed to read legacy value token-state: {error}", {
      error: formatErrorMessage(error),
    });
    return undefined;
  }

  return migrateAuthInputFromLegacyTokenState({
    legacyTokenState: parseLegacyValue(
      legacyTokenStateSchema,
      rawLegacyState["token-state"],
      "token-state",
    ),
    migratedAt: isoDateTimeSchema.parse(undefined),
  });
}

export async function migrateUserConfigFromV1(): Promise<
  UserConfig | undefined
> {
  let rawLegacyState: Record<string, unknown>;
  try {
    rawLegacyState = await getLocalStorageValues(["config", "user_settings"]);
  } catch (error) {
    logger.warn("Failed to read legacy values config/user_settings: {error}", {
      error: formatErrorMessage(error),
    });
    return undefined;
  }

  return migrateUserConfigFromLegacyState({
    legacyConfig: parseLegacyValue(
      legacyConfigSchema,
      rawLegacyState["config"],
      "config",
    ),
    legacyUserSettings: parseLegacyUserSettings(
      rawLegacyState["user_settings"],
    ),
  });
}

export async function migrateGlobalNotificationsStateFromV1(): Promise<
  GlobalNotificationsMigrationState | undefined
> {
  let rawLegacyState: Record<string, unknown>;
  try {
    rawLegacyState = await getLocalStorageValues([...legacyLocalStorageKeys]);
  } catch (error) {
    logger.warn("Failed to read legacy footprint from local storage: {error}", {
      error: formatErrorMessage(error),
    });
    return undefined;
  }

  if (!hasLegacyV1FootprintInLocalStorage(rawLegacyState)) {
    return undefined;
  }

  // Using arbitrary date in the past to enable toasts with announcements from this date.
  const isoDateTime = isoDateTimeSchema.parse("2026-01-01T00:00:00Z");

  return {
    announcementReadAtByCreatedAt: {},
    welcomeMessageShownAt: isoDateTime,
    welcomeMessageReadAt: isoDateTime,
  };
}

async function removeLegacyLocalStorageKeys(): Promise<boolean> {
  let remaining: Record<string, unknown>;
  try {
    await removeLocalStorageValues(legacyLocalStorageKeys);
    remaining = await getLocalStorageValues([...legacyLocalStorageKeys]);
  } catch (error) {
    logger.warn("Failed to remove legacy local storage keys: {error}", {
      error: formatErrorMessage(error),
    });
    return false;
  }

  return legacyLocalStorageKeys.every((key) => !Object.hasOwn(remaining, key));
}

async function clearLegacyAlarms(): Promise<boolean> {
  let alarms: unknown[];
  try {
    await Promise.all(
      legacyAlarmNames.map((alarmName) => clearAlarm(alarmName)),
    );

    alarms = await Promise.all(
      legacyAlarmNames.map((alarmName) => getAlarm(alarmName)),
    );
  } catch (error) {
    logger.warn("Failed to clear legacy alarms: {error}", {
      error: formatErrorMessage(error),
    });
    return false;
  }

  return alarms.every((alarm) => alarm === undefined);
}

async function deleteLegacyIndexedDb(): Promise<boolean> {
  if (typeof indexedDB === "undefined") {
    logger.warn("indexedDB is unavailable, skipping legacy DB cleanup");
    return false;
  }

  // cspell:ignore IDBOpenDBRequest
  let request: IDBOpenDBRequest;
  try {
    request = indexedDB.deleteDatabase(legacyIndexedDbName);
  } catch (error) {
    logger.warn("Failed to start deleting legacy IndexedDB {dbName}: {error}", {
      dbName: legacyIndexedDbName,
      error: formatErrorMessage(error),
    });
    return false;
  }

  const { promise, resolve } = Promise.withResolvers<boolean>();

  request.addEventListener("success", () => {
    resolve(true);
  });

  request.addEventListener("error", () => {
    logger.warn("Failed to delete legacy IndexedDB {dbName}: {error}", {
      dbName: legacyIndexedDbName,
      error: request.error?.message,
    });
    resolve(false);
  });

  request.addEventListener("blocked", () => {
    logger.warn("Deletion of legacy IndexedDB {dbName} was blocked", {
      dbName: legacyIndexedDbName,
    });
    resolve(false);
  });

  return await promise;
}

export async function cleanupLegacyV1State(): Promise<void> {
  const [localStorageRemoved, alarmsCleared, indexedDbDeleted] =
    await Promise.all([
      removeLegacyLocalStorageKeys(),
      clearLegacyAlarms(),
      deleteLegacyIndexedDb(),
    ]);

  if (!localStorageRemoved || !alarmsCleared || !indexedDbDeleted) {
    logger.warn(
      "Legacy v1 cleanup remains incomplete (localStorageRemoved={localStorageRemoved}, alarmsCleared={alarmsCleared}, indexedDbDeleted={indexedDbDeleted})",
      {
        localStorageRemoved,
        alarmsCleared,
        indexedDbDeleted,
      },
    );
    return;
  }

  logger.info("Legacy v1 cleanup completed");
}
