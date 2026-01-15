import * as React from "react";
import ReactDOM from "react-dom/client";

import { configureLogging, getPopupLogger } from "@/shared/logging";
import { browser } from "#imports";

import { App } from "./app";

const logger = getPopupLogger();

function main() {
  configureLogging();

  logger.debug("Starting popup entrypoint {runtimeId}", {
    runtimeId: browser.runtime.id,
  });

  const rootElement = document.querySelector("#root");
  if (!rootElement) {
    logger.error("Root element not found");
    return;
  }

  const darkThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  document.documentElement.classList.toggle(
    "dark-theme",
    darkThemeQuery.matches,
  );

  darkThemeQuery.addEventListener("change", (event) => {
    document.documentElement.classList.toggle("dark-theme", event.matches);
  });

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

main();
