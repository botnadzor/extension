import type {
  ElementListSelector,
  ElementSelector,
  ImageUrlSelector,
  StringDataSelector,
  ValuePattern,
} from "@/shared/@model/insertion-configs/shared/primitives";
import { getContentLogger } from "@/shared/logging";

import { resolveReactPropValue } from "./react-fiber-bridge";

const logger = getContentLogger(["selector-resolution"]);

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

const regExpCache = new Map<ValuePattern, RegExp | Error>();

function getRegExp(pattern: ValuePattern): RegExp | undefined {
  let result = regExpCache.get(pattern);

  if (!result) {
    try {
      result = new RegExp(pattern);
    } catch (error) {
      logger.warn(`Invalid pattern: ${pattern}`, { error });
      result = new Error(`Invalid pattern: ${pattern}`, { cause: error });
    }
  }

  return result instanceof RegExp ? result : undefined;
}

function applyPattern(
  value: string,
  pattern: ValuePattern,
): string | undefined {
  const match = getRegExp(pattern)?.exec(value);
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

async function resolveSingleStringDataSelector(
  rootElement: HTMLElement,
  selector: NormalizedSingleSelector,
): Promise<string | undefined> {
  const element = resolveSelector(rootElement, selector);

  if (!element) {
    return;
  }

  const reactProp = "reactProp" in selector ? selector.reactProp : undefined;

  const rawValue = reactProp
    ? await resolveReactPropValue(element, reactProp)
    : selector.attribute
      ? (element.getAttribute(selector.attribute) ?? undefined)
      : element.textContent;

  if (rawValue === undefined) {
    return;
  }

  const patternMatchedRawValue = selector.valuePattern
    ? applyPattern(rawValue, selector.valuePattern)
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
