import type { Logger } from "@logtape/logtape";

import { serializeJsonValue, serializeMessage } from "./serialization-helpers";

const globalCatchAllStateSymbol = Symbol.for(
  "botnadzor.logging.globalCatchAll",
);

const wrappedConsoleMethods = [
  "trace",
  "debug",
  "log",
  "info",
  "warn",
  "error",
] as const;

type WrappedConsoleMethod = (typeof wrappedConsoleMethods)[number];
type CatchAllLogLevel = "debug" | "info" | "warning" | "error";

type GlobalCatchAllState = {
  installed: boolean;
  isForwarding: boolean;
  originalConsoleMethodByName: Record<
    WrappedConsoleMethod,
    Console[WrappedConsoleMethod]
  >;
};

const logLevelByConsoleMethod = {
  trace: "debug",
  debug: "debug",
  log: "debug",
  info: "info",
  warn: "warning",
  error: "error",
} satisfies Record<WrappedConsoleMethod, CatchAllLogLevel>;

function isGlobalCatchAllState(value: unknown): value is GlobalCatchAllState {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "installed" in value &&
    typeof value.installed === "boolean" &&
    "isForwarding" in value &&
    typeof value.isForwarding === "boolean" &&
    "originalConsoleMethodByName" in value &&
    value.originalConsoleMethodByName !== null &&
    typeof value.originalConsoleMethodByName === "object"
  );
}

function logWithLevel({
  level,
  logger,
  message,
  properties,
}: {
  level: CatchAllLogLevel;
  logger: Logger;
  message: string;
  properties: Record<string, unknown>;
}): void {
  switch (level) {
    case "debug": {
      logger.debug(message, properties);
      return;
    }
    case "info": {
      logger.info(message, properties);
      return;
    }
    case "warning": {
      logger.warn(message, properties);
      return;
    }
    case "error": {
      logger.error(message, properties);
      return;
    }
  }
}

function getGlobalCatchAllState(): GlobalCatchAllState {
  const existingState: unknown = Reflect.get(
    globalThis,
    globalCatchAllStateSymbol,
  );
  if (isGlobalCatchAllState(existingState)) {
    return existingState;
  }

  const state: GlobalCatchAllState = {
    installed: false,
    isForwarding: false,
    originalConsoleMethodByName: {
      trace: globalThis.console.trace.bind(globalThis.console),
      debug: globalThis.console.debug.bind(globalThis.console),
      log: globalThis.console.log.bind(globalThis.console),
      info: globalThis.console.info.bind(globalThis.console),
      warn: globalThis.console.warn.bind(globalThis.console),
      error: globalThis.console.error.bind(globalThis.console),
    },
  };

  Reflect.set(globalThis, globalCatchAllStateSymbol, state);
  return state;
}

function getConsoleMessage(
  args: readonly unknown[],
  method: WrappedConsoleMethod,
) {
  const message = serializeMessage(args);
  return message.length > 0 ? message : `console.${method}()`;
}

function getEventValue(event: Event, key: string): unknown {
  return Reflect.get(event, key);
}

function getErrorMessage(event: Event): string {
  const message = getEventValue(event, "message");
  if (typeof message === "string") {
    return message;
  }

  const error = getEventValue(event, "error");
  if (error !== undefined) {
    return serializeMessage([error]);
  }

  return "Unhandled global error event";
}

function getUnhandledRejectionMessage(event: Event): string {
  const reason = getEventValue(event, "reason");
  if (reason !== undefined) {
    return serializeMessage([reason]);
  }

  return "Unhandled promise rejection";
}

function forwardConsoleCall({
  args,
  consoleLogger,
  method,
}: {
  args: readonly unknown[];
  consoleLogger: Logger;
  method: WrappedConsoleMethod;
}): void {
  logWithLevel({
    level: logLevelByConsoleMethod[method],
    logger: consoleLogger,
    message: "{message}",
    properties: {
      consoleArgs: serializeJsonValue(args),
      consoleMethod: method,
      message: getConsoleMessage(args, method),
      ...(method === "trace"
        ? { stack: new Error("console.trace()").stack }
        : {}),
    },
  });
}

function forwardErrorEvent({
  event,
  runtimeLogger,
}: {
  event: Event;
  runtimeLogger: Logger;
}): void {
  const error = getEventValue(event, "error");
  const colno = getEventValue(event, "colno");
  const filename = getEventValue(event, "filename");
  const lineno = getEventValue(event, "lineno");

  logWithLevel({
    level: "error",
    logger: runtimeLogger,
    message: "{message}",
    properties: {
      ...(error === undefined ? {} : { error }),
      ...(typeof colno === "number" ? { colno } : {}),
      ...(typeof filename === "string" && filename.length > 0
        ? { source: filename }
        : {}),
      ...(typeof lineno === "number" ? { lineno } : {}),
      message: getErrorMessage(event),
    },
  });
}

function forwardUnhandledRejection({
  event,
  runtimeLogger,
}: {
  event: Event;
  runtimeLogger: Logger;
}): void {
  const reason = getEventValue(event, "reason");

  logWithLevel({
    level: "error",
    logger: runtimeLogger,
    message: "{message}",
    properties: {
      message: getUnhandledRejectionMessage(event),
      ...(reason === undefined ? {} : { reason }),
    },
  });
}

/**
 * Configures forwarding of console calls and error events to logtape
 */
export function setupGlobalCatchAllLogging({
  logger,
}: {
  logger: Logger;
}): void {
  const state = getGlobalCatchAllState();
  if (state.installed) {
    return;
  }

  state.installed = true;

  const consoleLogger = logger.getChild(["console"]);
  const runtimeLogger = logger.getChild(["runtime"]);

  for (const method of wrappedConsoleMethods) {
    globalThis.console[method] = (...args: unknown[]) => {
      if (state.isForwarding) {
        state.originalConsoleMethodByName[method](...args);
        return;
      }

      state.isForwarding = true;
      try {
        forwardConsoleCall({
          args,
          consoleLogger,
          method,
        });
      } finally {
        state.isForwarding = false;
      }
    };
  }

  if (typeof globalThis.addEventListener !== "function") {
    return;
  }

  globalThis.addEventListener("error", (event) => {
    if (state.isForwarding) {
      return;
    }

    state.isForwarding = true;
    try {
      forwardErrorEvent({ event, runtimeLogger });
    } finally {
      state.isForwarding = false;
    }
  });

  globalThis.addEventListener("unhandledrejection", (event) => {
    if (state.isForwarding) {
      return;
    }

    state.isForwarding = true;
    try {
      forwardUnhandledRejection({ event, runtimeLogger });
    } finally {
      state.isForwarding = false;
    }
  });
}
