import { getLogger, type Logger } from "@logtape/logtape";

import type { ContentId } from "../@primitives/misc";

export const baseLoggerCategory = "bn";

export function getBackgroundLogger(subcategories: string[] = []): Logger {
  return getLogger([baseLoggerCategory, "background", ...subcategories]);
}

// Unlike other loggers, content logger needs to be initialized once per content script and then passed around.
// This ensures that all logs have the correct content id.
export function getContentLogger(contentId: ContentId | undefined): Logger {
  return getLogger([baseLoggerCategory, "content", contentId ?? "-"]);
}

export function getPopupLogger(subcategories: string[] = []): Logger {
  return getLogger([baseLoggerCategory, "popup", ...subcategories]);
}

export function getSidepanelLogger(subcategories: string[] = []): Logger {
  return getLogger([baseLoggerCategory, "sidepanel", ...subcategories]);
}
