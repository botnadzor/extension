import * as React from "react";

import { useActivePopupTab } from "@/shared/@ui-helpers/data-hooks";
import { ScrollArea } from "@/shared/@ui-primitives/scroll-area";
import { cn } from "@/shared/tailwindcss-helpers";

import { popupTabDefinitionLookup } from "./tabs";

export function ActiveTab() {
  const activeTab = useActivePopupTab();
  const activeTabDefinition = popupTabDefinitionLookup[activeTab];

  return (
    <ScrollArea
      className={cn(
        "flex flex-1 grow",
        activeTabDefinition.scrollAreaClassName,
      )}
    >
      <React.Suspense>
        <activeTabDefinition.Body />
      </React.Suspense>
    </ScrollArea>
  );
}
