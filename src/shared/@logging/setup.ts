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

export function getConsoleSnapshot(): Console {
  const boundConsoleMethodByName = {
    debug: globalThis.console.debug.bind(globalThis.console),
    error: globalThis.console.error.bind(globalThis.console),
    info: globalThis.console.info.bind(globalThis.console),
    log: globalThis.console.log.bind(globalThis.console),
    warn: globalThis.console.warn.bind(globalThis.console),
  } as const;

  // Firefox enforces strict invariants for non-configurable `console`
  // properties like `warn`, so a Proxy is not a safe shape here. A plain
  // snapshot keeps the methods bound while remaining compatible with LogTape.
  return Object.assign(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.create returns any
    Object.create(globalThis.console) as Console,
    boundConsoleMethodByName,
  );
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
