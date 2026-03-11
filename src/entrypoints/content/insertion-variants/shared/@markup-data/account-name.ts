import type { Logger } from "@logtape/logtape";

import type { StringDataSelector } from "@/shared/@model/insertion-configs/shared/primitives";

import { resolveStringDataSelector } from "../selector-resolution";

export async function extractAccountNameFromMarkup(
  rootElement: HTMLElement,
  accountNameSelector: StringDataSelector,
  instanceLogger: Logger,
): Promise<string | undefined> {
  return resolveStringDataSelector(
    rootElement,
    accountNameSelector,
    instanceLogger,
    (value) => value.trim(),
  );
}
