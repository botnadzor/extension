export const contentScriptHosts = [
  "vk.ru",
  "vkvideo.ru",
  "m.vk.ru",
  "m.vkvideo.ru",

  // Legacy aliases remain supported while they are still reachable.
  "vk.com",
  "m.vk.com",
] as const;

export const archivedContentScriptHosts = [
  ...contentScriptHosts,
  "vkontakte.ru",
  "m.vkontakte.ru",
] as const;

export type ArchivedContentScriptHost =
  (typeof archivedContentScriptHosts)[number];

export const contentScriptMatches = [
  ...contentScriptHosts.map((host) => `https://${host}/*`),
  ...archivedContentScriptHosts.map(
    (host) => `*://web.archive.org/*/${host}/*`,
  ),
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
