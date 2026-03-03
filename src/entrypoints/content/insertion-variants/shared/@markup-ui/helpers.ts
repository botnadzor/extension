import { kebabCase } from "es-toolkit";
import type * as React from "react";
import type { JsonObject } from "type-fest";

import type {
  RenderFunction,
  UnmountFunction,
} from "@/entrypoints/content/insertion-variant-typings";
import type { SingleElementPlacement } from "@/shared/@model/insertion-configs/shared/primitives";
import { cn } from "@/shared/tailwindcss-helpers";

import { ensureArray, resolveSelector } from "../selector-resolution";

export type InsertionUi<
  RenderPayload extends Readonly<JsonObject> = Record<string, never>,
  ElementType extends HTMLElement = HTMLElement,
> = {
  element: ElementType;
  render: RenderFunction<RenderPayload>;
  unmount: UnmountFunction;
};

export function createInsertionUi<
  TagName extends keyof HTMLElementTagNameMap,
  SinglePlacement extends SingleElementPlacement = SingleElementPlacement,
>({
  className,
  dxLabel,
  placement,
  rootElement,
  style,
  tagName,
}: {
  className?: string | undefined;
  dxLabel: string;
  placement: SinglePlacement | readonly SinglePlacement[];
  rootElement: HTMLElement;
  style?: React.CSSProperties & Record<`--${string}`, string | number>;
  tagName: TagName;
}):
  | {
      element: HTMLElementTagNameMap[TagName];
      pickedPlacement: SinglePlacement;
    }
  | {
      element: undefined;
      pickedPlacement: undefined;
    } {
  for (const singlePlacement of ensureArray(placement)) {
    const selectedElement = resolveSelector(rootElement, singlePlacement);
    if (!selectedElement) {
      continue;
    }

    const element = document.createElement(tagName);
    element.dataset["bnInsertionUiElement"] = dxLabel;

    element.className = cn(
      "bn:box-border", // simplifies calculations of element dimensions
      className,
    );

    element.hidden = true; // hide by default to avoid layout shifts (we expect to toggle visibility in the render function)

    if (singlePlacement.style) {
      for (const [prop, val] of Object.entries(singlePlacement.style)) {
        if (prop.startsWith("--")) {
          element.style.setProperty(prop, val);
        } else {
          element.style.setProperty(kebabCase(prop), val);
        }
      }
    }

    if (style) {
      for (const [prop, val] of Object.entries(style)) {
        // Detect CSS custom property (starts with "--"), don't kebab-case
        if (prop.startsWith("--")) {
          element.style.setProperty(prop, String(val));
        } else {
          element.style.setProperty(kebabCase(prop), String(val));
        }
      }
    }

    selectedElement[singlePlacement.position](element);

    return {
      element,
      pickedPlacement: singlePlacement,
    };
  }

  return {
    element: undefined,
    pickedPlacement: undefined,
  };
}
