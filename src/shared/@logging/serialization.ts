import type { LogLevel } from "@logtape/logtape";
import type { JsonObject } from "type-fest";

export const serializedLogLevelLookup = {
  trace: "TRC" as const,
  debug: "DBG" as const,
  info: "INF" as const,
  warning: "WRN" as const,
  error: "ERR" as const,
  fatal: "FTL" as const,
} satisfies Record<LogLevel, string>;

export type SerializedLogLevel =
  (typeof serializedLogLevelLookup)[keyof typeof serializedLogLevelLookup];

export type SerializedLogRecordProperties = Readonly<JsonObject>;

export type SerializedLogRecord = readonly [
  timestamp: number, // Using number (milliseconds) instead of ISO string for memory and message transfer efficiency. When exporting, we convert it to ISO string.
  level: SerializedLogLevel,
  category: readonly string[],
  message: string,
  properties: SerializedLogRecordProperties,
];

export type SerializedLogRecordWithId = readonly [
  id: number,
  ...rest: SerializedLogRecord,
];

export const maxSerializedRecordCountPerLowestLogLevel = 100;
