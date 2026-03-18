import type { JsonValue } from "type-fest";

import type { SerializedLogRecordProperties } from "@/shared/@logging/serialization";

type JsonObject = Record<string, JsonValue>;

export function serializeJsonValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): JsonValue | undefined {
  switch (typeof value) {
    case "boolean":
    case "string": {
      return value;
    }
    case "number": {
      return Number.isFinite(value) ? value : String(value);
    }
    case "bigint": {
      return value.toString();
    }
    case "function": {
      return `[Function ${value.name || "anonymous"}]`;
    }
    case "symbol": {
      return value.toString();
    }
    case "undefined": {
      return undefined;
    }
    case "object": {
      if (value === null) {
        return null; // eslint-disable-line unicorn/no-null -- JSON preserves null values
      }

      if (seen.has(value)) {
        return "[Circular]";
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      seen.add(value);

      if (value instanceof Error) {
        const result: JsonObject = {
          name: value.name,
          message: value.message,
        };

        if (value.stack) {
          result["stack"] = value.stack;
        }

        for (const key of Object.keys(value)) {
          const serializedValue = serializeJsonValue(
            Object.getOwnPropertyDescriptor(value, key)?.value,
            seen,
          );
          if (serializedValue !== undefined) {
            result[key] = serializedValue;
          }
        }

        seen.delete(value);
        return result;
      }

      if (Array.isArray(value)) {
        const result = value.map(
          (item) =>
            // eslint-disable-next-line unicorn/no-null -- JSON arrays use null placeholders for removed values
            serializeJsonValue(item, seen) ?? null,
        );
        seen.delete(value);
        return result;
      }

      const result: JsonObject = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        const serializedValue = serializeJsonValue(nestedValue, seen);
        if (serializedValue !== undefined) {
          result[key] = serializedValue;
        }
      }

      seen.delete(value);
      return result;
    }
  }
}

export function serializeProperties(
  properties: Record<string, unknown>,
): SerializedLogRecordProperties {
  const result: JsonObject = {};

  for (const [key, value] of Object.entries(properties)) {
    const serializedValue = serializeJsonValue(value);
    if (serializedValue !== undefined) {
      result[key] = serializedValue;
    }
  }

  return result;
}

export function serializeMessage(message: readonly unknown[]): string {
  return message
    .map((value) => {
      const serializedValue = serializeJsonValue(value);
      if (serializedValue && typeof serializedValue === "object") {
        return JSON.stringify(serializedValue);
      }
      return String(serializedValue);
    })
    .join("");
}
