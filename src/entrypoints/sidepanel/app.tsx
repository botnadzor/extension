import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";

import { configureLogging, getSidepanelLogger } from "@/shared/@logging/core";
import { LoggerProvider } from "@/shared/@logging/react";
import { LogoLink } from "@/shared/@ui-primitives/logo";
import { TooltipProvider } from "@/shared/@ui-primitives/tooltip";

import { SidepanelMain } from "./app/main";

const logger = getSidepanelLogger();

function startSidepanelApp() {
  configureLogging();

  logger.debug("Starting sidepanel entrypoint {runtimeId}", {
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
      <LoggerProvider value={logger}>
        <TooltipProvider>
          <div className="absolute inset-0 flex flex-col text-sm">
            <header className="flex flex-0 flex-row items-center gap-2 p-4 pb-2">
              <LogoLink />
              <span className="mt-0.5 size-1.5 rounded-full bg-muted-foreground" />
              <span className="mb-0.5 font-play text-2xl text-muted-foreground">
                Отладка
              </span>
            </header>
            <SidepanelMain />
          </div>
        </TooltipProvider>
      </LoggerProvider>
    </React.StrictMode>,
  );
}

startSidepanelApp();
