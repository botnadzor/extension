import type * as React from "react";

import { TooltipProvider } from "@/shared/@ui-primitives/tooltip";
import { cn } from "@/shared/tailwindcss-helpers";

export function AccountListAppShell({
  children,
  darkTheme,
}: {
  children: React.ReactNode;
  darkTheme: boolean;
}) {
  return (
    <div
      className={cn(
        "relative h-full overflow-visible font-ubuntu text-foreground",
        darkTheme && "dark-theme",
      )}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </div>
  );
}
