import { produce } from "immer";
import * as React from "react";

import { staticListIdSchema } from "@/shared/@model/dx-config";
import {
  staticListDefinitionLookup,
  type StaticListId,
  staticListIds,
} from "@/shared/@model/static-lists";
import { useDxConfig } from "@/shared/@ui-helpers/data-hooks";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/@ui-primitives/tabs";
import { dxConfigService } from "@/shared/proxy-services";

import { StaticListTabBody } from "./static-list-tab-body";

function getAvailableTabs(): StaticListId[] {
  const tabs: StaticListId[] = [];
  for (const listId of staticListIds) {
    if (staticListDefinitionLookup[listId].dxSidepanelTab) {
      tabs.push(listId);
    }
  }
  return tabs;
}

export function SidepanelMain() {
  const dxConfig = useDxConfig();

  const availableTabs = React.useMemo(() => getAvailableTabs(), []);

  // Get current tab, validating it's available
  const currentTab = React.useMemo(() => {
    const savedTab = dxConfig.sidepanelTab;
    if (
      savedTab &&
      staticListDefinitionLookup[savedTab].dxSidepanelTab !== undefined
    ) {
      return savedTab;
    }
    return availableTabs[0];
  }, [dxConfig.sidepanelTab, availableTabs]);

  // Update config if saved tab is not available
  React.useEffect(() => {
    const savedTab = dxConfig.sidepanelTab;
    if (
      savedTab &&
      staticListDefinitionLookup[savedTab].dxSidepanelTab === undefined
    ) {
      const firstTab = availableTabs[0];
      if (firstTab === undefined) {
        return;
      }
      void dxConfigService.set(
        produce(dxConfig, (draft) => {
          draft.sidepanelTab = firstTab;
        }),
      );
    }
  }, [dxConfig, availableTabs]);

  function handleTabChange(rawValue: string | null) {
    const result = staticListIdSchema.safeParse(rawValue);
    if (!result.success) {
      return;
    }

    const value = result.data;

    void dxConfigService.set(
      produce(dxConfig, (draft) => {
        if (value === availableTabs[0]) {
          delete draft.sidepanelTab;
        } else {
          draft.sidepanelTab = value;
        }
      }),
    );
  }

  return (
    <Tabs
      className="flex flex-1 flex-col overflow-hidden px-2 pb-4"
      value={currentTab}
      onValueChange={handleTabChange}
    >
      <TabsList
        className="
          flex-0
          *:px-2
        "
      >
        {staticListIds.map((listId) => {
          const definition = staticListDefinitionLookup[listId];
          if (!definition.dxSidepanelTab) {
            return;
          }

          return (
            <TabsTrigger key={listId} value={listId}>
              {definition.dxSidepanelTab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {staticListIds.map((listId) => {
        const definition = staticListDefinitionLookup[listId];
        if (!definition.dxSidepanelTab) {
          return;
        }

        return (
          <TabsContent
            className="relative flex flex-1 flex-col"
            key={listId}
            value={listId}
          >
            <StaticListTabBody listId={listId} />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
