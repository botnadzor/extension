export const contentScriptHosts = [
  "vk.com",
  "vk.ru",
  "vkvideo.ru",

  "m.vk.com",
  "m.vk.ru",
  "m.vkvideo.ru",
] as const;

export type ContentScriptHost = (typeof contentScriptHosts)[number];

export const contentScriptMatches = [
  ...contentScriptHosts.map((host) => `https://${host}/*`),
  ...contentScriptHosts.map((host) => `*://web.archive.org/*/${host}/*`),
];
