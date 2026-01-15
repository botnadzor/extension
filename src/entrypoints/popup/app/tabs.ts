import type { PopupTab } from "@/shared/primitive-values";

import { AccessTabBody } from "./tabs/=access";
import { AnnouncementsTabBody } from "./tabs/=announcements";
import { ConfigTabBody } from "./tabs/=config";
import { StatsTabBody } from "./tabs/=stats";

type PopupTabDefinition = {
  label: string;
  Body: React.ComponentType;
};

export const popupTabDefinitionLookup: Record<PopupTab, PopupTabDefinition> = {
  config: {
    label: "Настройки",
    Body: ConfigTabBody,
  },
  access: {
    label: "Доступ",
    Body: AccessTabBody,
  },
  announcements: {
    label: "Уведомления",
    Body: AnnouncementsTabBody,
  },
  stats: {
    label: "Статистика",
    Body: StatsTabBody,
  },
};
