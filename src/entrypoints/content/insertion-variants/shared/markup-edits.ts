import { kebabCase, noop } from "es-toolkit";

import type { MarkupEdits } from "@/shared/@model/insertion-configs/shared/primitives";

import type { UnmountFunction } from "../../insertion-variant-typings";
import { resolveListSelector } from "./selector-resolution";

/**
 * Applies style patches to matching elements.
 * Returns a cleanup function that reverses the edits.
 */
export function applyMarkupEdits(
  rootElement: HTMLElement,
  markupEdits: MarkupEdits | undefined,
): UnmountFunction {
  if (!markupEdits || markupEdits.length === 0) {
    return noop;
  }

  const appliedMarkupEdits: Array<{
    element: HTMLElement;
    kebabCaseProperty: string;
    originalValue: string | null;
    value: string;
  }> = [];

  for (const edit of markupEdits) {
    const elements = resolveListSelector(rootElement, edit);
    if (!elements) {
      continue;
    }

    for (const element of elements) {
      for (const [property, value] of Object.entries(edit.style)) {
        const kebabCaseProperty = kebabCase(property);
        const originalValue = element.style.getPropertyValue(kebabCaseProperty);

        if (originalValue === value) {
          continue;
        }

        element.style.setProperty(kebabCaseProperty, value);

        appliedMarkupEdits.push({
          element,
          kebabCaseProperty,
          originalValue,
          value,
        });
      }
    }
  }

  return () => {
    for (const {
      element,
      kebabCaseProperty,
      originalValue,
      value,
    } of appliedMarkupEdits) {
      // Do not restore original value if the value has already been changed
      if (value !== element.style.getPropertyValue(kebabCaseProperty)) {
        continue;
      }

      if (originalValue) {
        element.style.setProperty(kebabCaseProperty, originalValue);
      } else {
        element.style.removeProperty(kebabCaseProperty);
      }
    }
  };
}
