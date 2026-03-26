import { describe, expect, it } from "vitest";

import {
  extractTotalCountFromActiveTabContent,
  normalizeActiveTabContent,
} from "./active-tab";

describe("normalizeActiveTabContent", () => {
  it("collapses repeated whitespace", () => {
    expect(normalizeActiveTabContent("  Все \n 1,6K \t")).toBe("Все 1,6K");
  });
});

describe("extractTotalCountFromActiveTabContent", () => {
  it.each([
    ["Все 123 456", { displayText: "123 456", value: 123_456 }],
    ["Все 123,456", { displayText: "123,456", value: 123_456 }],
    ["Все 123.456", { displayText: "123.456", value: 123_456 }],
    ["Все 123\u00A0456", { displayText: "123\u00A0456", value: 123_456 }],
    ["Все 123\u202F456", { displayText: "123\u202F456", value: 123_456 }],
    ["Все 123\u2009456", { displayText: "123\u2009456", value: 123_456 }],
    ["❤️ 1,5K", { approximation: "K", displayText: "1,5K", value: 1500 }],
    ["❤️ 1.6M", { approximation: "M", displayText: "1.6M", value: 1_600_000 }],
    ["Все 2,5М", { approximation: "M", displayText: "2,5М", value: 2_500_000 }],
    ["Все 1,5к", { approximation: "K", displayText: "1,5к", value: 1500 }],
    ["Все 1.6m", { approximation: "M", displayText: "1.6m", value: 1_600_000 }],
    ["😆 26", { displayText: "26", value: 26 }],
  ])("parses %s", (activeTabText, expected) => {
    expect(extractTotalCountFromActiveTabContent(activeTabText)).toEqual(
      expected,
    );
  });

  it("uses the last numeric token from the label", () => {
    expect(extractTotalCountFromActiveTabContent("Реакции 12 из 1,5K")).toEqual(
      {
        approximation: "K",
        displayText: "1,5K",
        value: 1500,
      },
    );
  });

  it("returns undefined when no numeric token is present", () => {
    expect(extractTotalCountFromActiveTabContent("Все")).toBeUndefined();
  });
});
