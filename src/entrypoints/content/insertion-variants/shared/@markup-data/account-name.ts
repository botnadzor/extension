import type { StringDataSelector } from "@/shared/@model/insertion-configs/shared/primitives";

import { resolveStringDataSelector } from "../selector-resolution";

export async function extractAccountNameFromMarkup(
  rootElement: HTMLElement,
  accountNameSelector: StringDataSelector,
): Promise<string | undefined> {
  return resolveStringDataSelector(rootElement, accountNameSelector, (value) =>
    value.trim(),
  );
}
