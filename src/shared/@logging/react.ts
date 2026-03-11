import type { Logger } from "@logtape/logtape";
import * as React from "react";

const LoggerContext = React.createContext<Logger | undefined>(undefined);

export const LoggerProvider = LoggerContext.Provider;

export function useLogger(): Logger {
  const logger = React.use(LoggerContext);

  if (!logger) {
    // eslint-disable-next-line no-restricted-syntax -- if this happens, it's an implementation defect rather than a runtime exception
    throw new Error("useLogger must be used within a LoggerProvider");
  }

  return logger;
}
