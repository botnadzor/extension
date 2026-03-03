/**
 * Runs in the page's main world (injected by content script).
 * Resolves React fiber prop values from DOM elements.
 *
 * Uses the same approach as React DevTools: reads __reactFiber$ /
 * __reactInternalInstance$ keys from DOM elements and walks the
 * component tree to find matching components and extract props.
 */
import { defineUnlistedScript } from "#imports";

function getFiberFromElement(element: HTMLElement): unknown {
  const keys = Object.keys(element);
  const key = keys.find(
    (k) =>
      k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"),
  );

  if (!key) {
    return undefined;
  }

  return Object.hasOwn(element, key)
    ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- react fiber key is not in the list of official HTMLElement keys
      (element as unknown as Record<string, unknown>)[key]
    : undefined;
}

function extractNestedValue(
  props: Record<string, unknown> | undefined,
  pathSegments: string[],
): unknown {
  const firstSegment = pathSegments[0];
  if (!props || !firstSegment) {
    return undefined;
  }

  let value: unknown = props[firstSegment];

  for (let i = 1; i < pathSegments.length; i += 1) {
    if (value === null || value === undefined || typeof value !== "object") {
      return undefined;
    }

    const segment = pathSegments[i];
    if (!segment) {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- drilling into nested prop object
    value = (value as Record<string, unknown>)[segment];
  }

  return value;
}

function stringifyExtractedValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return undefined;
}

const maxComponentLookupDepth = 16;

function resolveReactProp(
  element: HTMLElement,
  reactProp: string,
): string | undefined {
  const colonIndex = reactProp.indexOf(":");
  if (colonIndex === -1) {
    return undefined;
  }

  const componentName = reactProp.slice(0, colonIndex);
  const propPath = reactProp.slice(colonIndex + 1);
  const pathSegments = propPath.split("/");

  const fiber = getFiberFromElement(element);
  if (!fiber) {
    return undefined;
  }

  let current: unknown = fiber;
  let componentCount = 0;

  while (
    current &&
    typeof current === "object" &&
    componentCount < maxComponentLookupDepth
  ) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- navigating untyped React fiber tree
    const node = current as {
      return?: unknown;
      type?: unknown;
      memoizedProps?: Record<string, unknown>;
    };

    if (node.type && typeof node.type === "function") {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- reading displayName/name from React component type
      const type = node.type as { displayName?: string; name?: string };
      const name = type.displayName ?? type.name;

      if (componentName === "*" || name === componentName) {
        const stringified = stringifyExtractedValue(
          extractNestedValue(node.memoizedProps, pathSegments),
        );
        if (stringified !== undefined) {
          return stringified;
        }
      }

      componentCount += 1;
    }

    current = node.return;
  }

  return undefined;
}

export default defineUnlistedScript(() => {
  const script = document.currentScript;
  if (!script) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- EventListener type mismatch with CustomEvent
  script.addEventListener("bn-resolve-react-prop", ((event: CustomEvent) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- untyped event detail from content script
    const { requestId, reactProp } = event.detail as {
      requestId: string;
      reactProp: string;
    };

    const el = document.querySelector(
      `[data-bn-react-prop-request="${CSS.escape(requestId)}"]`,
    );
    if (!el || !(el instanceof HTMLElement)) {
      return;
    }

    try {
      const value = resolveReactProp(el, reactProp);
      if (value !== undefined) {
        el.dataset["bnReactPropResult"] = value;
      }
    } finally {
      delete el.dataset["bnReactPropRequest"];
    }
  }) as EventListener);
});
