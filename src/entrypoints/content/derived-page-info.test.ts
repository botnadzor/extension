import { describe, expect, it } from "vitest";

import { derivePageInfo } from "./derived-page-info";

function locationFromUrl(url: string): Pick<Location, "host" | "pathname"> {
  return new URL(url);
}

describe("derivePageInfo", () => {
  it.each([
    "https://vk.ru/id1",
    "https://vk.com/id1",
    "https://vkvideo.ru/video-1_1",
  ])("supports desktop host %s", (url) => {
    expect(derivePageInfo(locationFromUrl(url))).toEqual({
      archivedSnapshot: false,
      websiteVariant: "desktopVkWebsite",
    });
  });

  it.each(["https://m.vk.ru/id1", "https://m.vk.com/id1"])(
    "supports mobile host %s",
    (url) => {
      expect(derivePageInfo(locationFromUrl(url))).toEqual({
        archivedSnapshot: false,
        websiteVariant: "mobileVkWebsite",
      });
    },
  );

  it.each([
    [
      "https://web.archive.org/web/20110101000000/http://vkontakte.ru/id1",
      "desktopVkWebsite",
    ],
    [
      "https://web.archive.org/web/20110101000000id_/http://m.vkontakte.ru/id1",
      "mobileVkWebsite",
    ],
    [
      "https://web.archive.org/web/20260101000000/https://vk.com/id1",
      "desktopVkWebsite",
    ],
  ] as const)("supports archived host %s", (url, websiteVariant) => {
    expect(derivePageInfo(locationFromUrl(url))).toEqual({
      archivedSnapshot: true,
      websiteVariant,
    });
  });

  it("does not support a historical alias directly", () => {
    expect(
      derivePageInfo(locationFromUrl("https://vkontakte.ru/id1")),
    ).toBeUndefined();
  });
});
