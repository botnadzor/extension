import type { Logger } from "@logtape/logtape";

/**
 * Accepts a record of fields. If any of the fields are undefined, warns about them.
 */
export function warnAboutUndefinedFields(
  instanceLogger: Logger,
  messagePrefix: string,
  fieldsThatMayBeUndefined: Record<string, unknown>,
): void {
  const filteredFields = Object.entries(fieldsThatMayBeUndefined)
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);

  if (filteredFields.length === 0) {
    return;
  }

  instanceLogger.warn(`${messagePrefix} ${filteredFields.join(", ")}`);
}
