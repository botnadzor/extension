import { configureSync, getConsoleSink, type LogLevel } from "@logtape/logtape";
import type { ProxyService } from "@webext-core/proxy-service";

import type { LoggingService } from "@/entrypoints/background/@services/logging-service";

import { baseExtensionVersionInfo } from "../@model/extension-version";
import { baseLoggerCategory } from "./categories";
import { createLoggingServiceSink } from "./logging-service-sink";

const lowestLogLevelsForProd = [
  "warning",
  "error",
] as const satisfies readonly LogLevel[];

const lowestLogLevelsForDev = [
  "debug",
  "info",
  "warning",
  "error",
] as const satisfies readonly LogLevel[];

export const lowestLogLevels =
  baseExtensionVersionInfo.lifecycle === "release"
    ? lowestLogLevelsForProd
    : lowestLogLevelsForDev;

export type LowestLogLevel = (typeof lowestLogLevels)[number];
export type AlwaysAvailableLowestLogLevel =
  (typeof lowestLogLevelsForProd)[number] &
    (typeof lowestLogLevelsForDev)[number];

function getConsoleSnapshot(): Console {
  const boundConsoleMethodByName = {
    debug: globalThis.console.debug.bind(globalThis.console),
    error: globalThis.console.error.bind(globalThis.console),
    info: globalThis.console.info.bind(globalThis.console),
    log: globalThis.console.log.bind(globalThis.console),
    warn: globalThis.console.warn.bind(globalThis.console),
  } as const;

  return new Proxy(globalThis.console, {
    get(target, property, receiver) {
      switch (property) {
        case "debug": {
          return boundConsoleMethodByName.debug;
        }
        case "error": {
          return boundConsoleMethodByName.error;
        }
        case "info": {
          return boundConsoleMethodByName.info;
        }
        case "log": {
          return boundConsoleMethodByName.log;
        }
        case "warn": {
          return boundConsoleMethodByName.warn;
        }
        default: {
          const result: unknown = Reflect.get(target, property, receiver);
          return result;
        }
      }
    },
  });
}

export function setupLogging(
  loggingService: ProxyService<LoggingService> | LoggingService,
): void {
  configureSync({
    sinks: {
      console: getConsoleSink({ console: getConsoleSnapshot() }),
      loggingService: createLoggingServiceSink(loggingService),
    },
    loggers: [
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: ["console", "loggingService"],
      },
      {
        category: [baseLoggerCategory],
        lowestLevel: lowestLogLevels[0],
        sinks: ["console", "loggingService"],
      },
    ],
  });
}
