export const popupTabs = [
  "config",
  "access",
  "announcements",
  "stats",
] as const;
export type PopupTab = (typeof popupTabs)[number];
