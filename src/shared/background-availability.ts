import { getLogger } from "@logtape/logtape";

import { baseLoggerCategory } from "./@logging/categories";

let check: (() => boolean) | undefined;
let warnedAboutMissingCheck = false;

const logger = getLogger([baseLoggerCategory, "background-availability"]);
const controller = new AbortController();

export const backgroundAbortSignal: AbortSignal = controller.signal;

export function setBackgroundAvailabilityCheck(fn: () => boolean): void {
  check = fn;
}

const backgroundGoneErrorPatterns = [
  /Extension context invalidated/u,
  /message channel closed/u,
];

export function isBackgroundGone(error?: unknown): boolean {
  if (controller.signal.aborted) {
    return true;
  }
  if (error !== undefined) {
    const message = error instanceof Error ? error.message : "";
    if (backgroundGoneErrorPatterns.some((p) => p.test(message))) {
      controller.abort();
      return true;
    }
  }
  if (!check) {
    if (!warnedAboutMissingCheck) {
      warnedAboutMissingCheck = true;
      logger.warn(
        "isBackgroundGone() called before setBackgroundAvailabilityCheck()",
      );
    }
    return false;
  }
  if (!check()) {
    controller.abort();
    return true;
  }
  return false;
}
