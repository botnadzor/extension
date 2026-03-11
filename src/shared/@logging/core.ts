import {
  configureSync,
  getConsoleSink,
  getLogger,
  type Logger,
} from "@logtape/logtape";

const loggerCategory = "botnadzor";

export function configureLogging(): void {
  configureSync({
    sinks: {
      console: getConsoleSink(),
    },
    loggers: [
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: ["console"],
      },
      {
        category: loggerCategory,
        lowestLevel: import.meta.env.DEV ? "debug" : "warning",
        sinks: ["console"],
      },
    ],
  });
}

export function getBackgroundLogger(subcategories: string[] = []): Logger {
  return getLogger([loggerCategory, "background", ...subcategories]);
}

// getContentLogger cannot be defined globally because it needs to include contentId in the category; pass contentLogger explicitly

export function getPopupLogger(subcategories: string[] = []): Logger {
  return getLogger([loggerCategory, "popup", ...subcategories]);
}

export function getSidepanelLogger(subcategories: string[] = []): Logger {
  return getLogger([loggerCategory, "sidepanel", ...subcategories]);
}
