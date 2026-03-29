import { describe, expect, it } from "vitest";

import { isQuotaExceededRemoteUpdateError } from "./remote-update-issue-helpers";

describe("isQuotaExceededRemoteUpdateError", () => {
  it("recognizes quota errors by name", () => {
    expect(
      isQuotaExceededRemoteUpdateError({
        message: "Failed to execute transaction",
        name: "QuotaExceededError",
      }),
    ).toBe(true);
  });

  it("recognizes quota errors nested in causes", () => {
    expect(
      isQuotaExceededRemoteUpdateError(
        new Error("Outer failure", {
          cause: { message: "There was not enough remaining storage space." },
        }),
      ),
    ).toBe(true);
  });

  it("does not treat unrelated errors as quota failures", () => {
    expect(
      isQuotaExceededRemoteUpdateError(
        new Error("Network request failed with 500"),
      ),
    ).toBe(false);
  });
});
