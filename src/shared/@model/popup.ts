export const popupTabs = [
  "config",
  "access",
  "announcements",
  "stats",
  "debug",
] as const;
export type PopupTab = (typeof popupTabs)[number];
