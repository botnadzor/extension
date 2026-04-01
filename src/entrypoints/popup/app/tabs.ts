import type * as React from "react";

import type { PopupTab } from "@/shared/@model/popup";
import { cn } from "@/shared/tailwindcss-helpers";

import { AccessTabBody } from "./tabs/=access";
import { AnnouncementsTabBody } from "./tabs/=announcements";
import { ConfigTabBody } from "./tabs/=config";
import { DebugTabBody, DebugTabWrapper } from "./tabs/=debug";
import { StatsTabBody } from "./tabs/=stats";

type PopupTabDefinition = {
  Body: React.ComponentType;
  scrollAreaClassName?: string | undefined;
  tabLabel: React.ReactNode;
  TabWrapper?: React.ComponentType<{
    active: boolean;
    children: React.ReactNode;
  }>;
};

export const popupTabDefinitionLookup: Record<PopupTab, PopupTabDefinition> = {
  config: {
    Body: ConfigTabBody,
    tabLabel: "Настройки",
  },
  access: {
    Body: AccessTabBody,
    tabLabel: "Доступ",
  },
  announcements: {
    Body: AnnouncementsTabBody,
    tabLabel: "Объявления",
  },
  stats: {
    Body: StatsTabBody,
    tabLabel: "Статистика",
  },
  debug: {
    Body: DebugTabBody,
    scrollAreaClassName: cn(`
      **:data-[slot=scroll-area-content]:flex
      **:data-[slot=scroll-area-content]:min-h-full
      **:data-[slot=scroll-area-content]:flex-col
    `),
    tabLabel: "Отладка",
    TabWrapper: DebugTabWrapper,
  },
};
