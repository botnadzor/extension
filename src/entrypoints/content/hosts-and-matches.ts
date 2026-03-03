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

/**
 * Match patterns for web_accessible_resources. Chrome only allows origin-level
 * patterns (path must be /*); archive path patterns are invalid, so we use
 * a single archive origin pattern.
 */
export const webAccessibleResourcesMatches = [
  ...contentScriptHosts.map((host) => `https://${host}/*`),
  "*://web.archive.org/*",
] as const;
