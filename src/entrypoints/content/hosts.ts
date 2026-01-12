export const contentScriptHosts = [
  "vk.com",
  "m.vk.com",

  "vk.ru",
  "m.vk.ru",

  "vkvideo.ru",
  "m.vkvideo.ru",
] as const;

export type ContentScriptHost = (typeof contentScriptHosts)[number];
