const spacerRegExp = /\s/gu;
const numericTokenRegExp = /(\d(?:[\d\s.,]*\d)?)(?:\s*([kKmMкКмМ]))?/gu;

export type AccountListTotalCount = {
  approximation?: "K" | "M";
  displayText: string;
  value: number;
};

function normalizeSuffix(value: string | undefined): "K" | "M" | undefined {
  switch (value) {
    case undefined: {
      return;
    }

    case "K":
    case "k":
    case "К":
    case "к": {
      return "K";
    }

    case "M":
    case "m":
    case "М":
    case "м": {
      return "M";
    }

    default: {
      return;
    }
  }
}

function normalizeSourceToken(value: string): string | undefined {
  const sanitizedValue = value.trim();
  if (sanitizedValue.length === 0) {
    return;
  }

  const withoutQuery = sanitizedValue.replaceAll(/[?#].*$/g, "");
  if (!URL.canParse(withoutQuery, "https://vk.com")) {
    return withoutQuery;
  }

  const normalizedUrl = new URL(withoutQuery, "https://vk.com");
  return normalizedUrl.pathname || withoutQuery;
}

function getImageToken(element: HTMLElement): string | undefined {
  const candidates = [
    element.getAttribute("alt"),
    element.getAttribute("aria-label"),
    element.getAttribute("aria-roledescription"),
    element.getAttribute("title"),
    "currentSrc" in element && typeof element.currentSrc === "string"
      ? element.currentSrc
      : undefined,
    element.getAttribute("src"),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const normalizedCandidate =
      candidate.includes("/") || candidate.includes(":")
        ? normalizeSourceToken(candidate)
        : candidate.trim();

    if (!normalizedCandidate) {
      continue;
    }

    return normalizedCandidate;
  }

  return;
}

function serializeActiveTabNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  if (node.tagName === "BR") {
    return " ";
  }

  if (node.tagName === "IMG" || node.getAttribute("role") === "img") {
    const imageToken = getImageToken(node);
    return imageToken ? ` [${imageToken}] ` : "";
  }

  return [...node.childNodes]
    .map((childNode) => serializeActiveTabNode(childNode))
    .join("");
}

function parsePlainInteger(value: string): number | undefined {
  const digitsOnly = value.replaceAll(/\D/g, "");
  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseApproximateNumber(value: string): number | undefined {
  const compactValue = value.replaceAll(spacerRegExp, "");
  const separatorIndexes = [...compactValue.matchAll(/[.,]/g)].map(
    (match) => match.index,
  );

  if (separatorIndexes.length === 0) {
    return parsePlainInteger(compactValue);
  }

  const decimalSeparatorIndex = separatorIndexes.at(-1);
  if (decimalSeparatorIndex === undefined) {
    return parsePlainInteger(compactValue);
  }

  const integerPart = compactValue
    .slice(0, decimalSeparatorIndex)
    .replaceAll(/[.,]/g, "");
  const fractionalPart = compactValue
    .slice(decimalSeparatorIndex + 1)
    .replaceAll(/[.,]/g, "");

  const parsed = Number(
    fractionalPart
      ? `${integerPart || "0"}.${fractionalPart}`
      : integerPart || "0",
  );

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeActiveTabContent(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

export function extractActiveTabContent(
  activeTabElement: HTMLElement | undefined,
): string | undefined {
  if (!activeTabElement) {
    return;
  }

  const normalizedContent = normalizeActiveTabContent(
    serializeActiveTabNode(activeTabElement),
  );

  return normalizedContent.length > 0 ? normalizedContent : undefined;
}

export function extractTotalCountFromActiveTabContent(
  activeTabContent: string | undefined,
): AccountListTotalCount | undefined {
  if (!activeTabContent) {
    return;
  }

  const matches = [...activeTabContent.matchAll(numericTokenRegExp)];
  const lastMatch = matches.at(-1);
  if (!lastMatch) {
    return;
  }

  const rawNumber = lastMatch[1];
  if (!rawNumber) {
    return;
  }

  const normalizedSuffix = normalizeSuffix(lastMatch[2]);
  const multiplier =
    normalizedSuffix === "K" ? 1000 : normalizedSuffix === "M" ? 1_000_000 : 1;
  const parsedBaseValue =
    normalizedSuffix === undefined
      ? parsePlainInteger(rawNumber)
      : parseApproximateNumber(rawNumber);

  if (parsedBaseValue === undefined) {
    return;
  }

  const value = Math.round(parsedBaseValue * multiplier);

  return {
    ...(normalizedSuffix === undefined
      ? {}
      : { approximation: normalizedSuffix }),
    displayText: `${rawNumber}${lastMatch[2] ?? ""}`,
    value,
  };
}
