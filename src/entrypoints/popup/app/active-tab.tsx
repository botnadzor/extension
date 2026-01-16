import * as React from "react";

import { useActivePopupTab } from "@/shared/@ui-helpers/data-hooks";
import { ScrollArea } from "@/shared/@ui-primitives/scroll-area";

import { popupTabDefinitionLookup } from "./tabs";

function ActiveTabBody() {
  const activeTab = useActivePopupTab();
  const activeTabDefinition = popupTabDefinitionLookup[activeTab];

  return <activeTabDefinition.Body />;
}

export function ActiveTab() {
  return (
    <ScrollArea className="flex-1 grow">
      <React.Suspense>
        <ActiveTabBody />
      </React.Suspense>
    </ScrollArea>
  );
}
