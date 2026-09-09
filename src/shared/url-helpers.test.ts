import { describe, expect, it } from "vitest";

import { defaultVkBaseUrl, detectVkBaseUrl } from "./url-helpers";

describe("VK URL helpers", () => {
  it("uses vk.ru as the canonical base URL", () => {
    expect(defaultVkBaseUrl).toBe("https://vk.ru");
  });

  it.each([
    ["https://vk.ru/id1", "https://vk.ru"],
    ["https://m.vk.ru/id1", "https://m.vk.ru"],
    ["https://vk.com/id1", "https://vk.com"],
    ["https://m.vk.com/id1", "https://m.vk.com"],
  ])("preserves the active live alias for %s", (url, expected) => {
    expect(detectVkBaseUrl(url)).toBe(expected);
  });

  it.each([
    "https://web.archive.org/web/20110101000000/http://vkontakte.ru",
    "https://web.archive.org/web/20110101000000/http://m.vkontakte.ru",
    "https://web.archive.org/web/20260101000000/https://vk.com",
    "https://web.archive.org/web/20260101000000id_/https://m.vk.ru",
  ])("preserves the archived base URL for %s", (url) => {
    expect(detectVkBaseUrl(`${url}/id1`)).toBe(url);
  });

  it("falls back to the canonical URL for unrelated hosts", () => {
    expect(detectVkBaseUrl("https://example.com/vk.ru/id1")).toBe(
      "https://vk.ru",
    );
  });
});
