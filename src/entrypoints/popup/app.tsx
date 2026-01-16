import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";

import { TooltipProvider } from "@/shared/@ui-primitives/tooltip";
import { configureLogging, getPopupLogger } from "@/shared/logging";

import { ActiveTab } from "./app/active-tab";
import { Header } from "./app/header";
import { Sidebar } from "./app/sidebar";

const logger = getPopupLogger();

function startPopupApp() {
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
      <TooltipProvider>
        <div className="absolute inset-0 flex flex-col">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <ActiveTab />
          </div>
        </div>
      </TooltipProvider>
    </React.StrictMode>,
  );
}

startPopupApp();
