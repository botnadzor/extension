import type { Logger } from "@logtape/logtape";
import * as React from "react";

const EntrypointLoggerContext = React.createContext<Logger | undefined>(
  undefined,
);

export const EntrypointLoggerProvider = EntrypointLoggerContext.Provider;

export function useEntrypointLogger(): Logger {
  const logger = React.use(EntrypointLoggerContext);

  if (!logger) {
    // eslint-disable-next-line no-restricted-syntax -- if this happens, it's an implementation defect rather than a runtime exception
    throw new Error(
      "useEntrypointLogger must be used within a EntrypointLoggerProvider",
    );
  }

  return logger;
}
