function* walkErrorChain(
  error: unknown,
  seen = new Set(),
): Generator<unknown, void, unknown> {
  if (error === undefined || error === null || seen.has(error)) {
    return;
  }

  if (typeof error !== "object" && !(error instanceof Error)) {
    return;
  }

  seen.add(error);
  yield error;

  const candidate = error;
  const cause = "cause" in candidate ? candidate.cause : undefined;
  const inner = "inner" in candidate ? candidate.inner : undefined;
  const innerError =
    "innerError" in candidate ? candidate.innerError : undefined;
  const errors = "errors" in candidate ? candidate.errors : undefined;

  for (const nestedError of [cause, inner, innerError]) {
    yield* walkErrorChain(nestedError, seen);
  }

  if (Array.isArray(errors)) {
    for (const nestedError of errors) {
      yield* walkErrorChain(nestedError, seen);
    }
  }
}

function extractErrorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return undefined;
  }

  return typeof error.name === "string" ? error.name : undefined;
}

function extractErrorMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return undefined;
  }

  return typeof error.message === "string" ? error.message : undefined;
}

export function isQuotaExceededRemoteUpdateError(error: unknown): boolean {
  for (const currentError of walkErrorChain(error)) {
    const errorName = extractErrorName(currentError);
    if (errorName === "QuotaExceededError") {
      return true;
    }

    const errorMessage = extractErrorMessage(currentError)?.toLowerCase();
    if (!errorMessage) {
      continue;
    }

    if (
      errorMessage.includes("quota") ||
      errorMessage.includes("not enough space") ||
      errorMessage.includes("storage full") ||
      errorMessage.includes("remaining storage space")
    ) {
      return true;
    }
  }

  return false;
}
