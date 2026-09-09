import { describe, expect, it } from "vitest";

import {
  archivedContentScriptHosts,
  contentScriptHosts,
  contentScriptMatches,
} from "./hosts-and-matches";

describe("content script hosts and matches", () => {
  it("prioritizes canonical hosts while retaining live aliases", () => {
    expect(contentScriptHosts).toEqual([
      "vk.ru",
      "vkvideo.ru",
      "m.vk.ru",
      "m.vkvideo.ru",
      "vk.com",
      "m.vk.com",
    ]);
  });

  it("retains historical aliases only for archived snapshots", () => {
    expect(archivedContentScriptHosts).toContain("vkontakte.ru");
    expect(archivedContentScriptHosts).toContain("m.vkontakte.ru");

    expect(contentScriptMatches).toContain(
      "*://web.archive.org/*/vkontakte.ru/*",
    );
    expect(contentScriptMatches).toContain(
      "*://web.archive.org/*/m.vkontakte.ru/*",
    );
    expect(contentScriptMatches).not.toContain("https://vkontakte.ru/*");
  });
});
