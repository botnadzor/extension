import type { Logger } from "@logtape/logtape";

import type {
  ElementCountSelector,
  ElementListSelector,
  ElementPresenceSelector,
  ElementSelector,
  ImageUrlSelector,
  StringDataSelector,
  ValuePattern,
} from "@/shared/@model/insertion-configs/shared/primitives";

import { resolveReactPropValue } from "./react-fiber-bridge";

export function ensureArray<T>(value: T | readonly T[]): readonly T[] {
  return Array.isArray(value)
    ? value
    : // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- bypassing ts of Array.isArray
      [value as T];
}

/**
 * Finds closest ancestor element (if ancestorSelector is provided) and then finds child element
 */
export function resolveSelector(
  rootElement: HTMLElement,
  {
    ancestorSelector,
    selector,
  }: {
    ancestorSelector?: ElementSelector;
    selector: ElementSelector;
  },
): HTMLElement | undefined {
  if (selector.length === 0) {
    return rootElement;
  }

  const ancestorElement = ancestorSelector
    ? rootElement.closest(ancestorSelector)
    : rootElement;

  const element = ancestorElement?.querySelector(selector);

  return element instanceof HTMLElement ? element : undefined;
}

export function resolveListSelector(
  rootElement: HTMLElement,
  { selector }: { selector: ElementListSelector },
): HTMLElement[] | undefined {
  if (selector.length === 0) {
    return [rootElement];
  }

  return [...rootElement.querySelectorAll(selector)]
    .map((element) => (element instanceof HTMLElement ? element : undefined))
    .filter((element) => element !== undefined);
}

export function resolveElementCountSelector(
  rootElement: HTMLElement,
  elementCountSelector: ElementCountSelector,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- added for consistency with other resolvers
  instanceLogger: Logger,
): number {
  for (const selector of ensureArray(elementCountSelector)) {
    const list = resolveListSelector(
      rootElement,
      typeof selector === "string" ? { selector } : selector,
    );

    if (!list?.length) {
      continue;
    }

    return list.length;
  }

  return 0;
}

export function resolveElementPresenceSelector(
  rootElement: HTMLElement,
  elementPresenceSelector: ElementPresenceSelector,
  instanceLogger: Logger,
): boolean {
  return (
    resolveElementCountSelector(
      rootElement,
      elementPresenceSelector,
      instanceLogger,
    ) > 0
  );
}

const regExpCache = new Map<ValuePattern, RegExp | Error>();

function getRegExp(
  pattern: ValuePattern,
  instanceLogger: Logger,
): RegExp | undefined {
  let result = regExpCache.get(pattern);

  if (!result) {
    try {
      result = new RegExp(pattern);
    } catch (error) {
      instanceLogger
        .getChild(["selector-resolution"])
        .warn(`Invalid pattern: ${pattern}`, { error });
      result = new Error(`Invalid pattern: ${pattern}`, { cause: error });
    }
  }

  return result instanceof RegExp ? result : undefined;
}

function applyPattern(
  value: string,
  pattern: ValuePattern,
  instanceLogger: Logger,
): string | undefined {
  const match = getRegExp(pattern, instanceLogger)?.exec(value);
  return match?.[1] ?? match?.[0];
}

function substituteInSelector(
  selector: NormalizedSingleSelector,
  replacement: string,
): NormalizedSingleSelector {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- JSON roundtrip preserves shape
  return JSON.parse(
    JSON.stringify(selector, (_key, value: unknown) =>
      typeof value === "string" ? value.replaceAll("%", replacement) : value,
    ),
  );
}

type NormalizedSingleSelector = Exclude<
  StringDataSelector,
  string | readonly unknown[]
>;

function normalizeSingleSelector(
  selector: StringDataSelector,
): NormalizedSingleSelector {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ensureArray guarantees non-array element
  return (
    typeof selector === "string" ? { selector } : selector
  ) as NormalizedSingleSelector;
}

/**
 * Extracts human-visible text from an element.
 *
 * Treats `<br>` as a word separator and then collapses all whitespace to
 * single spaces. This keeps words that are visually separated on different
 * lines from being concatenated, e.g. `<div>Hello<br>World</div>` becomes
 * `"Hello World"`, while still returning a simple one-line string suitable
 * for downstream parsing and pattern matching.
 *
 * Treatment of <br> was needed for desktopDialogFollowersPreReact insertion variant.
 */
function extractTextContent(element: HTMLElement): string | undefined {
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  let rawText = "";
  let currentNode = walker.nextNode();

  while (currentNode !== null) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      rawText += currentNode.textContent ?? "";
    } else if (
      currentNode.nodeType === Node.ELEMENT_NODE &&
      currentNode instanceof HTMLElement &&
      currentNode.tagName === "BR"
    ) {
      rawText += " ";
    }

    currentNode = walker.nextNode();
  }

  const normalized = rawText.replaceAll(/\s+/g, " ").trim();

  return normalized.length === 0 ? undefined : normalized;
}

async function resolveSingleStringDataSelector(
  rootElement: HTMLElement,
  selector: NormalizedSingleSelector,
  instanceLogger: Logger,
): Promise<string | undefined> {
  const element = resolveSelector(rootElement, selector);

  if (!element) {
    return;
  }

  const reactProp = "reactProp" in selector ? selector.reactProp : undefined;

  const rawValue = reactProp
    ? await resolveReactPropValue({ element, instanceLogger, reactProp })
    : selector.attribute
      ? (element.getAttribute(selector.attribute) ?? undefined)
      : extractTextContent(element);

  if (rawValue === undefined) {
    return;
  }

  const patternMatchedRawValue = selector.valuePattern
    ? applyPattern(rawValue, selector.valuePattern, instanceLogger)
    : rawValue;
  if (patternMatchedRawValue === undefined) {
    return;
  }

  if (selector.pipe !== undefined) {
    for (const pipedSelector of ensureArray(selector.pipe)) {
      const normalized = normalizeSingleSelector(pipedSelector);

      const substituted = substituteInSelector(
        normalized,
        patternMatchedRawValue,
      );

      const result = await resolveSingleStringDataSelector(
        rootElement,
        substituted,
        instanceLogger,
      );

      if (result !== undefined) {
        return result;
      }
    }

    return;
  }

  return patternMatchedRawValue;
}

export async function resolveStringDataSelector<T>(
  rootElement: HTMLElement,
  stringDataSelector: StringDataSelector | undefined,
  instanceLogger: Logger,
  parse: (value: string) => T,
): Promise<T | undefined> {
  if (stringDataSelector === undefined) {
    return;
  }

  const singleSelectors = ensureArray(stringDataSelector).map((selector) =>
    normalizeSingleSelector(selector),
  );

  for (const selector of singleSelectors) {
    const resolvedValue = await resolveSingleStringDataSelector(
      rootElement,
      selector,
      instanceLogger,
    );

    if (resolvedValue === undefined) {
      continue;
    }

    const result = parse(resolvedValue);
    if (result !== undefined) {
      return result;
    }
  }

  return;
}

function extractBackgroundImageUrl(element: HTMLElement): string | undefined {
  const match = /url\(['"]?(.*?)['"]?\)/.exec(element.style.backgroundImage);

  return match?.[1];
}

export function resolveImageUrlSelector(
  root: HTMLElement,
  imageUrlSelector: ImageUrlSelector,
): string | undefined {
  const singleSelectors = ensureArray(imageUrlSelector).map((selector) =>
    typeof selector === "string" ? { selector } : selector,
  );

  for (const selector of singleSelectors) {
    const element = resolveSelector(root, selector);
    if (!element) {
      continue;
    }

    const src =
      element instanceof HTMLImageElement
        ? element.getAttribute("src")
        : extractBackgroundImageUrl(element);

    if (!src) {
      continue;
    }
    const trimmed = src.trim();

    if (trimmed.length === 0) {
      continue;
    }

    return trimmed;
  }

  return;
}
